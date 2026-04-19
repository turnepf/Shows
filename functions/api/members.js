export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    `SELECT h.slug, h.name, COUNT(s.id) as show_count
     FROM members h
     LEFT JOIN shows s ON s.member_slug = h.slug AND s.archived = 0
     GROUP BY h.slug, h.name
     ORDER BY RANDOM()`
  ).all();
  return new Response(JSON.stringify({ members: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
