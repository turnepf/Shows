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

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const user = await verifyAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() });
  }

  const body = await request.json();
  const { list } = body;
  const validLists = ['watching', 'waiting', 'recommending', 'next'];
  if (!validLists.includes(list)) {
    return new Response(JSON.stringify({ error: 'Invalid list' }), { status: 400, headers: corsHeaders() });
  }

  await env.DB.prepare(
    "UPDATE shows SET list = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(list, params.id).run();

  const show = await env.DB.prepare('SELECT * FROM shows WHERE id = ?').bind(params.id).first();
  return new Response(JSON.stringify({ show }), { headers: corsHeaders() });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
