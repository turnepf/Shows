const NETWORK_URLS = {
  'Netflix': 'https://www.netflix.com/search?q=',
  'HBO': 'https://www.max.com/search?q=',
  'Apple TV': 'https://tv.apple.com/search?term=',
  'Hulu': 'https://www.hulu.com/search?q=',
  'Paramount': 'https://www.paramountplus.com/search/',
  'Peacock': 'https://www.peacocktv.com/search?q=',
  'Amazon': 'https://www.amazon.com/s?i=instant-video&k=',
  'Bravo': 'https://www.peacocktv.com/search?q=',
};

function generateNetworkUrl(network, title) {
  if (!network) return null;
  const base = NETWORK_URLS[network];
  if (!base) return null;
  return base + encodeURIComponent(title);
}

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

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  const { results } = await db.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM actors a WHERE a.show_id = s.id) as actor_count
     FROM shows s WHERE s.archived = 0 ORDER BY s.title COLLATE NOCASE`
  ).all();
  return new Response(JSON.stringify({ shows: results }), { headers: corsHeaders() });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await verifyAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() });
  }

  const body = await request.json();
  const { title, network, recommended_by, list, notes, network_url, movie } = body;
  if (!title || !list) {
    return new Response(JSON.stringify({ error: 'Title and list are required' }), { status: 400, headers: corsHeaders() });
  }

  const url = cleanUrl(network_url) || generateNetworkUrl(network, title);
  const omdb = await fetchOMDB(title, env);

  const result = await env.DB.prepare(
    'INSERT INTO shows (title, network, network_url, recommended_by, rating, list, notes, movie) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(title, network || null, url, recommended_by || null, omdb.rating, list, notes || null, movie || 0).run();

  const showId = result.meta.last_row_id;

  if (omdb.actors.length > 0) {
    const stmt = env.DB.prepare('INSERT INTO actors (show_id, name) VALUES (?, ?)');
    await env.DB.batch(omdb.actors.map(actor => stmt.bind(showId, actor)));
  }

  const show = await env.DB.prepare('SELECT * FROM shows WHERE id = ?').bind(showId).first();
  return new Response(JSON.stringify({ show }), { status: 201, headers: corsHeaders() });
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
