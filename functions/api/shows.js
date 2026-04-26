const NETWORK_SEARCH = {
  'Netflix': { base: 'https://www.netflix.com/search' },
  'HBO': { base: 'https://play.max.com/search', param: 'q' },
  'Apple TV': { base: 'https://tv.apple.com/search', param: 'term' },
  'Hulu': { base: 'https://www.hulu.com/search' },
  'Paramount': { base: 'https://www.paramountplus.com/search' },
  'Peacock': { base: 'https://www.peacocktv.com/watch/search' },
  'Amazon': { base: 'https://www.amazon.com/s', param: 'k', extra: 'i=instant-video' },
  'Bravo': { base: 'https://www.peacocktv.com/watch/search' },
  'Disney+': { base: 'https://www.disneyplus.com/browse/search' },
  'NBC': { base: 'https://www.nbc.com/search' },
  'Starz': { base: 'https://www.starz.com/search', param: 'q' },
  'Showtime': { base: 'https://www.sho.com/search', param: 'q' },
};

function generateNetworkUrl(network, title) {
  if (!network) return null;
  const cfg = NETWORK_SEARCH[network];
  if (!cfg) return null;
  if (!cfg.param) return cfg.base;
  const params = new URLSearchParams();
  if (cfg.extra) cfg.extra.split('&').forEach(p => { const [k,v] = p.split('='); params.set(k,v); });
  params.set(cfg.param, title);
  return cfg.base + '?' + params.toString();
}

function cleanUrl(url) {
  if (!url) return url;
  url = url.split('?')[0];
  if (url.includes('amazon.com/')) url = url.split('ref=')[0];
  return url.replace(/\/+$/, '/');
}

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
}

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  try {
    const session = await env.DB.prepare(
      'SELECT email, member_slug, expires_at FROM sessions WHERE id = ?'
    ).bind(match[1]).first();
    if (session && new Date(session.expires_at) > new Date()) return session;
  } catch (e) {}
  return null;
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
      const detailRes = await fetch(`https://www.omdbapi.com/?i=${data.Search[0].imdbID}&apikey=${apiKey}`);
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

async function fetchOMDB(title, env) {
  const apiKey = env.OMDB_API_KEY;
  if (!apiKey) return { canonicalTitle: null, rating: null, actors: [] };
  let result = await tryOMDB(title, apiKey);
  if (result) return result;
  result = await tryOMDB('The ' + title, apiKey);
  if (result) return result;
  if (title.toLowerCase().startsWith('the ')) {
    result = await tryOMDB(title.slice(4), apiKey);
    if (result) return result;
  }
  const collapsed = title.replace(/\s+/g, '');
  if (collapsed !== title) {
    result = await tryOMDB(collapsed, apiKey);
    if (result) return result;
  }
  result = await searchOMDB(title, apiKey);
  if (result) return result;
  return { canonicalTitle: null, rating: null, actors: [] };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const member = url.searchParams.get('member');
  if (!member) {
    return new Response(JSON.stringify({ error: 'member required' }), { status: 400, headers: corsHeaders() });
  }
  const { results } = await env.DB.prepare(
    `SELECT s.*,
       (SELECT GROUP_CONCAT(name, ', ') FROM actors a WHERE a.show_id = s.id) as actors
     FROM shows s WHERE s.archived = 0 AND s.member_slug = ? ORDER BY s.title COLLATE NOCASE`
  ).bind(member).all();
  return new Response(JSON.stringify({ shows: results }), { headers: corsHeaders() });
}

async function backfillFromOtherMembers(env, showId, title) {
  // Check if this show exists on another member with a network/URL we can copy
  const match = await env.DB.prepare(
    `SELECT network, network_url FROM shows
     WHERE LOWER(title) = LOWER(?) AND archived = 0
       AND id != ?
       AND network IS NOT NULL
       AND network_url IS NOT NULL
       AND network_url NOT LIKE '%/search%'
       AND network_url NOT LIKE '%/s?%'
     LIMIT 1`
  ).bind(title, showId).first();

  if (match) {
    const show = await env.DB.prepare('SELECT network, network_url FROM shows WHERE id = ?').bind(showId).first();
    const updates = [];
    if (!show.network && match.network) updates.push({ field: 'network', value: match.network });
    if (!show.network_url && match.network_url) updates.push({ field: 'network_url', value: match.network_url });
    if (updates.length > 0) {
      const sets = updates.map(u => `${u.field} = ?`).join(', ');
      const values = updates.map(u => u.value);
      await env.DB.prepare(
        `UPDATE shows SET ${sets}, updated_at = datetime('now') WHERE id = ?`
      ).bind(...values, showId).run();
    }
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await getSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() });
  }

  const body = await request.json();
  const { title, network, recommended_by, list, notes, network_url, movie, full_series, watching_with } = body;
  if (!title || !list) {
    return new Response(JSON.stringify({ error: 'Title and list are required' }), { status: 400, headers: corsHeaders() });
  }

  const omdb = await fetchOMDB(title, env);
  const finalTitle = omdb.canonicalTitle || title;

  const existing = await env.DB.prepare(
    'SELECT id, list, archived FROM shows WHERE LOWER(title) = LOWER(?) AND member_slug = ?'
  ).bind(finalTitle, session.member_slug).first();
  if (existing) {
    if (existing.archived) {
      return new Response(JSON.stringify({ error: 'exists_archived', id: existing.id, title: finalTitle }), { status: 409, headers: corsHeaders() });
    }
    return new Response(JSON.stringify({ error: 'exists_active', list: existing.list, title: finalTitle }), { status: 409, headers: corsHeaders() });
  }

  const url = cleanUrl(network_url) || generateNetworkUrl(network, finalTitle);

  const result = await env.DB.prepare(
    'INSERT INTO shows (title, network, network_url, recommended_by, rating, list, notes, movie, full_series, watching_with, member_slug, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(finalTitle, network || null, url, recommended_by || null, omdb.rating, list, notes || null, movie || 0, full_series || 0, watching_with || null, session.member_slug, session.email).run();

  const showId = result.meta.last_row_id;
  if (omdb.actors.length > 0) {
    const stmt = env.DB.prepare('INSERT INTO actors (show_id, name) VALUES (?, ?)');
    await env.DB.batch(omdb.actors.map(actor => stmt.bind(showId, actor)));
  }

  // Backfill network/URL from other members if missing
  if (!network || !network_url) {
    await backfillFromOtherMembers(env, showId, finalTitle);
  }

  const show = await env.DB.prepare('SELECT * FROM shows WHERE id = ?').bind(showId).first();
  return new Response(JSON.stringify({ show }), { status: 201, headers: corsHeaders() });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
