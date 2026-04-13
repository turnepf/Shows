export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    'SELECT slug, name FROM households ORDER BY name'
  ).all();
  return new Response(JSON.stringify({ households: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
