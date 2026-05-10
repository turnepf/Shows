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

export async function onRequestPost(context) {
  const { env, request } = context;
  const session = await getSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Find shows with "good" URLs (not generic search pages)
  const { results: withUrls } = await env.DB.prepare(
    `SELECT LOWER(title) as ltitle, network_url FROM shows
     WHERE archived = 0
       AND network_url IS NOT NULL
       AND network_url != '#'
       AND network_url NOT LIKE '%/search%'
       AND network_url NOT LIKE '%/s?%'
     GROUP BY LOWER(title)`
  ).all();

  if (withUrls.length === 0) {
    return new Response(JSON.stringify({ synced: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let synced = 0;
  for (const source of withUrls) {
    const result = await env.DB.prepare(
      `UPDATE shows SET network_url = ?, enriched_at = datetime('now')
       WHERE LOWER(title) = ? AND archived = 0
         AND (network_url IS NULL OR network_url LIKE '%/search%' OR network_url LIKE '%/s?%')`
    ).bind(source.network_url, source.ltitle).run();
    synced += result.meta.changes;
  }

  return new Response(JSON.stringify({ synced }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
