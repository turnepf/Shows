function cleanUrl(url) {
  if (!url) return url;
  url = url.split('?')[0];
  if (url.includes('amazon.com/')) url = url.split('ref=')[0];
  return url.replace(/\/+$/, '/');
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };
}

async function fetchOMDB(title, env) {
  const apiKey = env.OMDB_API_KEY;
  if (!apiKey) return { rating: null, actors: [] };
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

async function verifyAuth(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  try {
    const session = await env.DB.prepare(
      'SELECT email, expires_at FROM sessions WHERE id = ?'
    ).bind(match[1]).first();
    if (session && new Date(session.expires_at) > new Date()) return session.email;
  } catch (e) {}
  return null;
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
  const user = await verifyAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() });
  }

  const existing = await env.DB.prepare('SELECT * FROM shows WHERE id = ?').bind(params.id).first();
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders() });
  }

  const body = await request.json();
  const title = body.title ?? existing.title;
  const network = body.network ?? existing.network;
  const network_url = body.network_url !== undefined ? cleanUrl(body.network_url) : existing.network_url;
  const recommended_by = body.recommended_by ?? existing.recommended_by;
  const list = body.list ?? existing.list;
  const notes = body.notes ?? existing.notes;
  const movie = body.movie ?? existing.movie;

  // Refresh rating and actors from OMDB
  const omdb = await fetchOMDB(title, env);
  const rating = omdb.rating || existing.rating;

  await env.DB.prepare(
    'UPDATE shows SET title = ?, network = ?, network_url = ?, recommended_by = ?, list = ?, notes = ?, movie = ?, rating = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(title, network, network_url, recommended_by, list, notes, movie, rating, params.id).run();

  // Refresh actors if OMDB returned any
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
  const user = await verifyAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() });
  }

  await env.DB.prepare('DELETE FROM shows WHERE id = ?').bind(params.id).run();
  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders() });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cf-Access-Jwt-Assertion',
    },
  });
}
