import { EXCLUDED_FROM_TASTE } from '../_shared/excluded-members.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const EXCLUDED_SQL = EXCLUDED_FROM_TASTE.map(s => `'${s}'`).join(',');
const QUEUE_FILTER = `
  s.archived = 0
  AND s.member_slug NOT IN (${EXCLUDED_SQL})
  AND (s.network_url IS NULL
       OR s.network_url LIKE '%search%'
       OR s.network_url LIKE '%/s?%'
       OR s.network_url LIKE '%?q=%'
       OR s.network_url LIKE '%?query=%')
`;

async function fetchQueue(env) {
  // One row per distinct title (case-insensitive), with all the member labels
  // for shows sharing that title.
  const { results } = await env.DB.prepare(`
    SELECT
      LOWER(s.title) AS ltitle,
      MIN(s.id) AS id,
      MIN(s.title) AS title,
      (SELECT s2.network FROM shows s2
        WHERE LOWER(s2.title) = LOWER(s.title) AND s2.archived = 0
          AND s2.network IS NOT NULL AND s2.network != ''
        ORDER BY s2.id LIMIT 1) AS network,
      (SELECT s3.network_url FROM shows s3
        WHERE LOWER(s3.title) = LOWER(s.title) AND s3.archived = 0
        ORDER BY s3.id LIMIT 1) AS network_url,
      COUNT(*) AS member_count,
      GROUP_CONCAT(
        COALESCE(
          CASE WHEN m.first_name IS NOT NULL AND m.last_initial IS NOT NULL
               THEN m.first_name || ' ' || m.last_initial
               ELSE m.first_name END,
          s.member_slug),
        ', ') AS members
    FROM shows s
    LEFT JOIN members m ON m.slug = s.member_slug
    WHERE ${QUEUE_FILTER}
    GROUP BY LOWER(s.title)
    ORDER BY LOWER(COALESCE(network, 'zzz')), LOWER(s.title)
  `).all();

  return results.map(r => ({
    id: r.id,
    title: r.title,
    network: r.network,
    network_url: r.network_url,
    member_count: r.member_count,
    members: r.members,
  }));
}

async function fetchNetworks(env) {
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT network FROM shows WHERE network IS NOT NULL AND network != '' ORDER BY network COLLATE NOCASE"
  ).all();
  return results.map(r => r.network);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ADMIN_SECRET) {
    return json({ error: 'ADMIN_SECRET not configured' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (body.secret !== env.ADMIN_SECRET) {
    return json({ error: 'Invalid secret' }, 401);
  }

  const action = body.action || 'list';

  if (action === 'save') {
    const id = parseInt(body.id, 10);
    const network = (body.network || '').trim();
    const url = (body.network_url || '').trim();

    if (!Number.isInteger(id)) return json({ error: 'id required' }, 400);
    if (!network) return json({ error: 'network required' }, 400);
    if (!url) return json({ error: 'URL required' }, 400);

    const lower = url.toLowerCase();
    const looksLikeSearch =
      lower.includes('/search') || lower.includes('/s?') ||
      lower.includes('?q=') || lower.includes('?query=');
    if (looksLikeSearch) {
      return json({ error: 'That still looks like a search URL — paste the direct show URL.' }, 400);
    }

    const titleRow = await env.DB.prepare('SELECT title FROM shows WHERE id = ?').bind(id).first();
    if (!titleRow) return json({ error: 'Show not found' }, 404);

    // Apply to every active row sharing this title — across all members.
    const result = await env.DB.prepare(
      "UPDATE shows SET network = ?, network_url = ?, enriched_at = datetime('now') WHERE LOWER(title) = LOWER(?) AND archived = 0"
    ).bind(network, url, titleRow.title).run();

    return json({ ok: true, updated: result.meta.changes });
  }

  const shows = await fetchQueue(env);
  const networks = await fetchNetworks(env);
  return json({ shows, networks });
}
