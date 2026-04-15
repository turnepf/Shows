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
      'SELECT email, household_slug, expires_at FROM sessions WHERE id = ?'
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
  const { env, params } = context;
  const show = await env.DB.prepare('SELECT * FROM shows WHERE id = ?').bind(params.id).first();
  if (!show) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders() });
  }
  return new Response(JSON.stringify({ show }), { headers: corsHeaders() });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const session = await getSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() });
  }

  const existing = await env.DB.prepare('SELECT * FROM shows WHERE id = ? AND household_slug = ?').bind(params.id, session.household_slug).first();
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders() });
  }

  const body = await request.json();
  const val = (key) => body[key] !== undefined ? body[key] : existing[key];
  const title = val('title');
  const network = val('network');
  const network_url = body.network_url !== undefined ? cleanUrl(body.network_url) : existing.network_url;
  const recommended_by = val('recommended_by');
  const list = val('list');
  const notes = val('notes');
  const movie = val('movie');
  const full_series = val('full_series');
  const watching_with = val('watching_with');
  const archived = val('archived');

  const omdb = await fetchOMDB(title, env);
  const rating = omdb.rating || existing.rating;

  await env.DB.prepare(
    "UPDATE shows SET title = ?, network = ?, network_url = ?, recommended_by = ?, list = ?, notes = ?, movie = ?, full_series = ?, watching_with = ?, rating = ?, archived = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(title, network, network_url, recommended_by, list, notes, movie, full_series, watching_with, rating, archived, params.id).run();

  if (omdb.actors.length > 0) {
    await env.DB.prepare('DELETE FROM actors WHERE show_id = ?').bind(params.id).run();
    const stmt = env.DB.prepare('INSERT INTO actors (show_id, name) VALUES (?, ?)');
    await env.DB.batch(omdb.actors.map(actor => stmt.bind(params.id, actor)));
  }

  const show = await env.DB.prepare('SELECT * FROM shows WHERE id = ?').bind(params.id).first();
  return new Response(JSON.stringify({ show }), { headers: corsHeaders() });
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const session = await getSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() });
  }
  await env.DB.prepare('DELETE FROM shows WHERE id = ? AND household_slug = ?').bind(params.id, session.household_slug).run();
  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders() });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
