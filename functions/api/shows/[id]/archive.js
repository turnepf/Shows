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

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const session = await getSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() });
  }

  await env.DB.prepare(
    "UPDATE shows SET archived = 1, updated_at = datetime('now') WHERE id = ? AND member_slug = ?"
  ).bind(params.id, session.member_slug).run();

  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders() });
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
