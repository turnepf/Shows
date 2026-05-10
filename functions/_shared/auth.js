export async function getSession(request, env) {
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
