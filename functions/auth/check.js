export async function onRequestGet(context) {
  const { env, request } = context;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);

  if (!match) {
    return new Response(JSON.stringify({ authenticated: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = await env.DB.prepare(
    'SELECT email, member_slug, expires_at FROM sessions WHERE id = ?'
  ).bind(match[1]).first();

  if (!session || new Date(session.expires_at) < new Date()) {
    return new Response(JSON.stringify({ authenticated: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    authenticated: true,
    email: session.email,
    member: session.member_slug,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
