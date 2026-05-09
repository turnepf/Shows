// Members who should never be returned as someone else's match.
// Why: their lists aren't curated tightly enough to represent shared taste —
// they accumulate too many shows and drown out real matches.
const EXCLUDED_AS_MATCH = ['paula'];

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const member = url.searchParams.get('member');
  if (!member) {
    return new Response(JSON.stringify({ error: 'member required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Suppress the match for seed-only members: their list reflects the seeder's
  // taste, not theirs, so any "match" would be coincidental overlap of seeds.
  const engaged = await env.DB.prepare(
    `SELECT EXISTS(
       SELECT 1 FROM shows s
       WHERE s.member_slug = ?
         AND (COALESCE(s.added_by, '') != 'seed' OR s.archived = 1 OR s.updated_at IS NOT NULL)
     ) AS engaged`
  ).bind(member).first();
  if (!engaged || !engaged.engaged) {
    return new Response(JSON.stringify({ match: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const exclusions = [member, ...EXCLUDED_AS_MATCH.filter(s => s !== member)];
  const placeholders = exclusions.map(() => '?').join(',');

  // Find the other member with the largest overlap of active titles. Ignore
  // members with fewer than 5 active shows so a tiny library can't win by
  // accident.
  const top = await env.DB.prepare(
    `WITH my_titles AS (
       SELECT DISTINCT LOWER(title) AS t FROM shows
       WHERE member_slug = ? AND archived = 0
     ),
     other_counts AS (
       SELECT member_slug, COUNT(*) AS cnt FROM shows
       WHERE archived = 0 AND member_slug NOT IN (${placeholders})
       GROUP BY member_slug
     )
     SELECT s.member_slug,
            COUNT(DISTINCT LOWER(s.title)) AS match_count
     FROM shows s
     JOIN my_titles mt ON LOWER(s.title) = mt.t
     JOIN other_counts oc ON oc.member_slug = s.member_slug
     WHERE s.archived = 0 AND s.member_slug NOT IN (${placeholders}) AND oc.cnt >= 5
     GROUP BY s.member_slug
     ORDER BY match_count DESC
     LIMIT 1`
  ).bind(member, ...exclusions, ...exclusions).first();

  if (!top || !top.match_count) {
    return new Response(JSON.stringify({ match: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { results: titleRows } = await env.DB.prepare(
    `SELECT DISTINCT s.title FROM shows s
     WHERE s.member_slug = ? AND s.archived = 0
       AND LOWER(s.title) IN (
         SELECT LOWER(title) FROM shows WHERE member_slug = ? AND archived = 0
       )
     ORDER BY s.title COLLATE NOCASE`
  ).bind(top.member_slug, member).all();

  const { results: members } = await env.DB.prepare(
    `SELECT slug, name, first_name, last_initial FROM members`
  ).all();
  const firstNameCounts = {};
  for (const m of members) {
    const fn = m.first_name || m.name.split(' ')[0];
    firstNameCounts[fn] = (firstNameCounts[fn] || 0) + 1;
  }
  const matched = members.find(m => m.slug === top.member_slug);
  if (!matched) {
    return new Response(JSON.stringify({ match: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const fn = matched.first_name || matched.name.split(' ')[0];
  const displayName = firstNameCounts[fn] > 1 && matched.last_initial
    ? `${fn} ${matched.last_initial}`
    : fn;

  return new Response(JSON.stringify({
    match: {
      slug: matched.slug,
      first_name: fn,
      display_name: displayName,
      match_count: top.match_count,
      titles: titleRows.map(r => r.title),
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
