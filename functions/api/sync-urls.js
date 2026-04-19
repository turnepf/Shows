export async function onRequestGet(context) {
  const { env } = context;

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
      `UPDATE shows SET network_url = ?, updated_at = datetime('now')
       WHERE LOWER(title) = ? AND archived = 0
         AND (network_url IS NULL OR network_url LIKE '%/search%' OR network_url LIKE '%/s?%')`
    ).bind(source.network_url, source.ltitle).run();
    synced += result.meta.changes;
  }

  return new Response(JSON.stringify({ synced }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
