export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    `SELECT h.slug, h.name, h.first_name, h.last_initial, COUNT(s.id) as show_count
     FROM members h
     LEFT JOIN shows s ON s.member_slug = h.slug AND s.archived = 0
     GROUP BY h.slug, h.name, h.first_name, h.last_initial
     ORDER BY RANDOM()`
  ).all();

  const firstNameCounts = {};
  for (const m of results) {
    const fn = m.first_name || m.name.split(' ')[0];
    firstNameCounts[fn] = (firstNameCounts[fn] || 0) + 1;
  }

  const members = results.map(m => {
    const fn = m.first_name || m.name.split(' ')[0];
    const displayName = firstNameCounts[fn] > 1 && m.last_initial
      ? `${fn} ${m.last_initial}`
      : fn;
    return {
      slug: m.slug,
      name: m.name,
      first_name: fn,
      display_name: displayName,
      show_count: m.show_count,
    };
  });

  return new Response(JSON.stringify({ members }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
