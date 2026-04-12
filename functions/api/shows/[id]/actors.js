function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const { results } = await env.DB.prepare(
    'SELECT name FROM actors WHERE show_id = ?'
  ).bind(params.id).all();
  return new Response(JSON.stringify({ actors: results.map(r => r.name) }), { headers: corsHeaders() });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
