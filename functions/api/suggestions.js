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

export async function onRequestPost(context) {
  const { env, request } = context;
  const body = await request.json();
  const { title, network, recommended_by, notes, movie } = body;

  if (!title) {
    return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400, headers: corsHeaders() });
  }

  // Check for existing show (including archived)
  const existing = await env.DB.prepare(
    'SELECT id, list, archived FROM shows WHERE LOWER(title) = LOWER(?)'
  ).bind(title).first();

  if (existing) {
    if (existing.archived) {
      return new Response(JSON.stringify({ duplicate: true, archived: true }), { headers: corsHeaders() });
    }
    return new Response(JSON.stringify({ duplicate: true, archived: false, list: existing.list }), { headers: corsHeaders() });
  }

  const omdb = await fetchOMDB(title, env);
  const suggestionNote = notes
    ? `Suggested · ${notes}`
    : 'Suggested';

  const result = await env.DB.prepare(
    'INSERT INTO shows (title, network, recommended_by, rating, list, notes, movie) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(title, network || null, recommended_by || null, omdb.rating, 'next', suggestionNote, movie || 0).run();

  const showId = result.meta.last_row_id;
  if (omdb.actors.length > 0) {
    const stmt = env.DB.prepare('INSERT INTO actors (show_id, name) VALUES (?, ?)');
    await env.DB.batch(omdb.actors.map(actor => stmt.bind(showId, actor)));
  }

  return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders() });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
