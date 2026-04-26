export async function onRequestGet(context) {
  const { env, request } = context;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);

  if (match) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(match[1]).run();
  }

  const referer = request.headers.get('Referer');
  let redirect = '/';
  if (referer) {
    try {
      const url = new URL(referer);
      redirect = url.pathname + url.hash;
    } catch {}
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirect,
      'Set-Cookie': 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
    },
  });
}
