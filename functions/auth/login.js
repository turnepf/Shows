export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const household = url.searchParams.get('household');

  if (!code || !household) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': `/${household || ''}?error=missing` },
    });
  }

  // Look up code in the database
  const match = await env.DB.prepare(
    'SELECT editor_name, household_slug FROM household_codes WHERE code = ? AND household_slug = ?'
  ).bind(code, household).first();

  if (!match) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': `/${household}?error=invalid` },
    });
  }

  const sessionId = crypto.randomUUID();
  const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await env.DB.prepare(
    'INSERT INTO sessions (id, email, household_slug, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, match.editor_name, match.household_slug, sessionExpires.toISOString()).run();

  return new Response(null, {
    status: 302,
    headers: {
      'Location': `/${match.household_slug}`,
      'Set-Cookie': `session=${sessionId}; Path=/; Expires=${sessionExpires.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
