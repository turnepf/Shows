function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
}

const MAX_FAILS = 5;
const WINDOW_MIN = 15;

async function failureCount(env, ip) {
  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString();
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM failed_logins WHERE ip = ? AND created_at > ?'
  ).bind(ip, since).first();
  return row?.cnt || 0;
}

async function recordFailure(env, ip, member) {
  await env.DB.prepare(
    'INSERT INTO failed_logins (ip, member_slug, created_at) VALUES (?, ?, ?)'
  ).bind(ip, member || null, new Date().toISOString()).run();
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (await failureCount(env, ip) >= MAX_FAILS) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { ...corsHeaders(), 'Retry-After': String(WINDOW_MIN * 60) },
    });
  }

  let code, member;
  try {
    const body = await request.json();
    code = body.code;
    member = body.member;
  } catch (e) {
    return new Response(JSON.stringify({ error: 'invalid_body' }), { status: 400, headers: corsHeaders() });
  }

  if (!code || !member) {
    return new Response(JSON.stringify({ error: 'missing' }), { status: 400, headers: corsHeaders() });
  }

  const match = await env.DB.prepare(
    'SELECT editor_name, member_slug FROM member_codes WHERE code = ? AND member_slug = ?'
  ).bind(code, member).first();

  if (!match) {
    await recordFailure(env, ip, member);
    return new Response(JSON.stringify({ error: 'invalid' }), { status: 401, headers: corsHeaders() });
  }

  const sessionId = crypto.randomUUID();
  const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await env.DB.prepare(
    'INSERT INTO sessions (id, email, member_slug, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(sessionId, match.editor_name, match.member_slug, sessionExpires.toISOString(), new Date().toISOString()).run();

  return new Response(JSON.stringify({ success: true, slug: match.member_slug }), {
    status: 200,
    headers: {
      ...corsHeaders(),
      'Set-Cookie': `session=${sessionId}; Path=/; Expires=${sessionExpires.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
