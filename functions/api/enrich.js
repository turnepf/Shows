const NETWORK_SEARCH = {
  'Netflix': { base: 'https://www.netflix.com/search' },
  'HBO': { base: 'https://play.max.com/search', param: 'q' },
  'Apple TV': { base: 'https://tv.apple.com/search', param: 'term' },
  'Hulu': { base: 'https://www.hulu.com/search' },
  'Paramount': { base: 'https://www.paramountplus.com/search' },
  'Peacock': { base: 'https://www.peacocktv.com/watch/search' },
  'Amazon': { base: 'https://www.amazon.com/s', param: 'k', extra: 'i=instant-video' },
  'Bravo': { base: 'https://www.peacocktv.com/watch/search' },
  'Disney+': { base: 'https://www.disneyplus.com/search' },
  'NBC': { base: 'https://www.nbc.com/search' },
  'Starz': { base: 'https://www.starz.com/search', param: 'q' },
  'Showtime': { base: 'https://www.sho.com/search', param: 'q' },
};

function generateSearchUrl(network, title) {
  if (!network) return null;
  const cfg = NETWORK_SEARCH[network];
  if (!cfg) return null;
  if (!cfg.param) return cfg.base;
  const params = new URLSearchParams();
  if (cfg.extra) cfg.extra.split('&').forEach(p => { const [k,v] = p.split('='); params.set(k,v); });
  params.set(cfg.param, title);
  return cfg.base + '?' + params.toString();
}

async function tryOMDB(title, apiKey) {
  try {
    const res = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`);
    const data = await res.json();
    if (data.Response === 'True') {
      return {
        canonicalTitle: data.Title,
        rating: data.imdbRating !== 'N/A' ? data.imdbRating : null,
        actors: data.Actors && data.Actors !== 'N/A' ? data.Actors.split(', ') : [],
      };
    }
  } catch (e) {}
  return null;
}

async function searchOMDB(title, apiKey) {
  try {
    const res = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(title)}&apikey=${apiKey}`);
    const data = await res.json();
    if (data.Response === 'True' && data.Search && data.Search.length > 0) {
      // Fetch full details for the first result
      const id = data.Search[0].imdbID;
      const detailRes = await fetch(`https://www.omdbapi.com/?i=${id}&apikey=${apiKey}`);
      const detail = await detailRes.json();
      if (detail.Response === 'True') {
        return {
          canonicalTitle: detail.Title,
          rating: detail.imdbRating !== 'N/A' ? detail.imdbRating : null,
          actors: detail.Actors && detail.Actors !== 'N/A' ? detail.Actors.split(', ') : [],
        };
      }
    }
  } catch (e) {}
  return null;
}

async function fetchOMDB(title, apiKey) {
  // Try exact title
  let result = await tryOMDB(title, apiKey);
  if (result) return result;

  // Try with "The " prepended
  result = await tryOMDB('The ' + title, apiKey);
  if (result) return result;

  // Try without "The " prefix
  if (title.toLowerCase().startsWith('the ')) {
    result = await tryOMDB(title.slice(4), apiKey);
    if (result) return result;
  }

  // Try collapsing spaces (e.g. "Land Man" -> "Landman")
  const collapsed = title.replace(/\s+/g, '');
  if (collapsed !== title) {
    result = await tryOMDB(collapsed, apiKey);
    if (result) return result;
  }

  // Fall back to search endpoint
  result = await searchOMDB(title, apiKey);
  if (result) return result;

  return { canonicalTitle: null, rating: null, actors: [] };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const apiKey = env.OMDB_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ enriched: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const household = url.searchParams.get('household');

  // Find up to 5 shows missing rating or actors or URL
  let query = `SELECT s.id, s.title, s.network, s.network_url
     FROM shows s
     WHERE s.archived = 0
       AND (s.rating IS NULL
         OR s.network_url IS NULL
         OR NOT EXISTS (SELECT 1 FROM actors a WHERE a.show_id = s.id))`;
  if (household) query += ` AND s.household_slug = '${household}'`;

  const { results: needsRating } = await env.DB.prepare(query).all();

  let enriched = 0;

  for (const show of needsRating) {
    const omdb = await fetchOMDB(show.title, apiKey);

    // Update canonical title if OMDB returned a different one
    if (omdb.canonicalTitle && omdb.canonicalTitle !== show.title) {
      // Check if canonical title already exists in DB
      const dupe = await env.DB.prepare(
        'SELECT id FROM shows WHERE LOWER(title) = LOWER(?) AND id != ?'
      ).bind(omdb.canonicalTitle, show.id).first();
      if (dupe) {
        // Duplicate — archive this one instead of renaming
        await env.DB.prepare(
          "UPDATE shows SET archived = 1, updated_at = datetime('now') WHERE id = ?"
        ).bind(show.id).run();
        enriched++;
        continue;
      }
      await env.DB.prepare(
        "UPDATE shows SET title = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(omdb.canonicalTitle, show.id).run();
    }

    // Update rating if missing
    if (omdb.rating) {
      await env.DB.prepare(
        "UPDATE shows SET rating = ?, updated_at = datetime('now') WHERE id = ? AND rating IS NULL"
      ).bind(omdb.rating, show.id).run();
    }

    // Update actors if missing
    if (omdb.actors.length > 0) {
      const { results: existing } = await env.DB.prepare(
        'SELECT COUNT(*) as c FROM actors WHERE show_id = ?'
      ).bind(show.id).all();
      if (existing[0].c === 0) {
        const stmt = env.DB.prepare('INSERT INTO actors (show_id, name) VALUES (?, ?)');
        await env.DB.batch(omdb.actors.map(actor => stmt.bind(show.id, actor)));
      }
    }

    // Generate search URL if no URL at all
    if (!show.network_url && show.network) {
      const searchUrl = generateSearchUrl(show.network, show.title);
      if (searchUrl) {
        await env.DB.prepare(
          "UPDATE shows SET network_url = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(searchUrl, show.id).run();
      }
    }

    enriched++;
  }

  return new Response(JSON.stringify({ enriched }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
