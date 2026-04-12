export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Missing code', { status: 400 });
  }

  let user = null;
  if (code === env.LOGIN_CODE_PATRICK) user = 'Patrick';
  else if (code === env.LOGIN_CODE_ALI) user = 'Ali';

  if (!user) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/?error=invalid' },
    });
  }

  const sessionId = crypto.randomUUID();
  const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await env.DB.prepare(
    'INSERT INTO sessions (id, email, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionId, user, sessionExpires.toISOString()).run();

  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': `session=${sessionId}; Path=/; Expires=${sessionExpires.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
