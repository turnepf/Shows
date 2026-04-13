function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };
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
  const finalTitle = omdb.canonicalTitle || title;
  const suggestionNote = notes
    ? `Suggested · ${notes}`
    : 'Suggested';

  const result = await env.DB.prepare(
    'INSERT INTO shows (title, network, recommended_by, rating, list, notes, movie) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(finalTitle, network || null, recommended_by || null, omdb.rating, 'next', suggestionNote, movie || 0).run();

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
