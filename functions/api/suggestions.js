import { getSession } from '../_shared/auth.js';

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
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
  const session = await getSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() });
  }

  const body = await request.json();
  const { title, network, recommended_by, notes, movie, full_series, member } = body;

  if (!title || !member) {
    return new Response(JSON.stringify({ error: 'Title and member are required' }), { status: 400, headers: corsHeaders() });
  }

  // Check for existing show (including archived)
  const existing = await env.DB.prepare(
    'SELECT id, list, archived FROM shows WHERE LOWER(title) = LOWER(?) AND member_slug = ?'
  ).bind(title, member).first();

  if (existing) {
    if (existing.archived) {
      return new Response(JSON.stringify({ duplicate: true, archived: true }), { headers: corsHeaders() });
    }
    return new Response(JSON.stringify({ duplicate: true, archived: false, list: existing.list }), { headers: corsHeaders() });
  }

  const omdb = await fetchOMDB(title, env);
  const finalTitle = omdb.canonicalTitle || title;

  // Check again with canonical title
  if (finalTitle.toLowerCase() !== title.toLowerCase()) {
    const dupeCheck = await env.DB.prepare(
      'SELECT id, list, archived FROM shows WHERE LOWER(title) = LOWER(?) AND member_slug = ?'
    ).bind(finalTitle, member).first();
    if (dupeCheck) {
      if (dupeCheck.archived) {
        return new Response(JSON.stringify({ duplicate: true, archived: true }), { headers: corsHeaders() });
      }
      return new Response(JSON.stringify({ duplicate: true, archived: false, list: dupeCheck.list }), { headers: corsHeaders() });
    }
  }

  const suggestionNote = notes ? `Suggested · ${notes}` : 'Suggested';

  const result = await env.DB.prepare(
    'INSERT INTO shows (title, network, recommended_by, rating, list, notes, movie, full_series, member_slug, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(finalTitle, network || null, recommended_by || null, omdb.rating, 'next', suggestionNote, movie || 0, full_series || 0, member, recommended_by || 'Anonymous').run();

  const showId = result.meta.last_row_id;
  if (omdb.actors.length > 0) {
    const stmt = env.DB.prepare('INSERT INTO actors (show_id, name) VALUES (?, ?)');
    await env.DB.batch(omdb.actors.map(actor => stmt.bind(showId, actor)));
  }

  // Backfill network/URL from other members if missing
  if (!network) {
    const match = await env.DB.prepare(
      `SELECT network, network_url FROM shows
       WHERE LOWER(title) = LOWER(?) AND archived = 0
         AND id != ?
         AND network IS NOT NULL
         AND network_url IS NOT NULL
         AND network_url NOT LIKE '%/search%'
         AND network_url NOT LIKE '%/s?%'
       LIMIT 1`
    ).bind(finalTitle, showId).first();
    if (match) {
      await env.DB.prepare(
        "UPDATE shows SET network = ?, network_url = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(match.network, match.network_url, showId).run();
    }
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
