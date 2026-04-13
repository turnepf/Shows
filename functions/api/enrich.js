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

async function fetchOMDB(title, apiKey) {
  try {
    const res = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`);
    const data = await res.json();
    if (data.Response === 'True') {
      return {
        rating: data.imdbRating !== 'N/A' ? data.imdbRating : null,
        actors: data.Actors && data.Actors !== 'N/A' ? data.Actors.split(', ') : [],
      };
    }
  } catch (e) {}
  return { rating: null, actors: [] };
}

export async function onRequestGet(context) {
  const { env } = context;
  const apiKey = env.OMDB_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ enriched: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Find up to 5 shows missing rating or actors or URL
  const { results: needsRating } = await env.DB.prepare(
    `SELECT s.id, s.title, s.network, s.network_url
     FROM shows s
     WHERE s.archived = 0
       AND (s.rating IS NULL
         OR s.network_url IS NULL
         OR NOT EXISTS (SELECT 1 FROM actors a WHERE a.show_id = s.id))
     LIMIT 5`
  ).all();

  let enriched = 0;

  for (const show of needsRating) {
    const omdb = await fetchOMDB(show.title, apiKey);

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
