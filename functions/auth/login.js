export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const member = url.searchParams.get('member');

  if (!code || !member) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': `/${member || ''}?error=missing` },
    });
  }

  // Look up code in the database
  const match = await env.DB.prepare(
    'SELECT editor_name, member_slug FROM member_codes WHERE code = ? AND member_slug = ?'
  ).bind(code, member).first();

  if (!match) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': `/${member}?error=invalid` },
    });
  }

  const sessionId = crypto.randomUUID();
  const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await env.DB.prepare(
    'INSERT INTO sessions (id, email, member_slug, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(sessionId, match.editor_name, match.member_slug, sessionExpires.toISOString(), new Date().toISOString()).run();

  return new Response(null, {
    status: 302,
    headers: {
      'Location': `/${match.member_slug}`,
      'Set-Cookie': `session=${sessionId}; Path=/; Expires=${sessionExpires.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
