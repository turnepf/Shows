export async function onRequestGet(context) {
  const { env } = context;

  const { results } = await env.DB.prepare(
    `SELECT LOWER(s.title) as ltitle, s.title, s.rating, s.network, s.network_url, s.movie,
       MIN(s.id) as id,
       COUNT(DISTINCT s.member_slug) as member_count,
       (SELECT COUNT(*) FROM actors a WHERE a.show_id = MIN(s.id)) as actor_count,
       GROUP_CONCAT(DISTINCT s.member_slug) as member_slugs
     FROM shows s
     WHERE s.archived = 0 AND s.list = 'watching'
     GROUP BY LOWER(s.title)
     HAVING COUNT(DISTINCT s.member_slug) >= 2
     ORDER BY member_count DESC, CAST(s.rating AS REAL) DESC
     LIMIT 10`
  ).all();

  // Get member names to map slugs to first names
  const { results: members } = await env.DB.prepare(
    'SELECT slug, name FROM members'
  ).all();
  const nameMap = {};
  for (const h of members) {
    nameMap[h.slug] = h.name.split(' ')[0];
  }

  // Add member names to each show
  for (const show of results) {
    show.members = (show.member_slugs || '').split(',').map(s => nameMap[s] || s).sort();
    delete show.member_slugs;
  }

  return new Response(JSON.stringify({ shows: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
