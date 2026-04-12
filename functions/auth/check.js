// Check if the user has a valid session cookie.
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
    'SELECT email, expires_at FROM sessions WHERE id = ?'
  ).bind(match[1]).first();

  if (!session || new Date(session.expires_at) < new Date()) {
    return new Response(JSON.stringify({ authenticated: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ authenticated: true, email: session.email }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
