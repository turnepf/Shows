export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const title = url.searchParams.get('title');
  const member = url.searchParams.get('member');

  if (!title || !member) {
    return new Response(JSON.stringify({ exists: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const show = await env.DB.prepare(
    'SELECT id, list, archived FROM shows WHERE LOWER(title) = LOWER(?) AND member_slug = ?'
  ).bind(title, member).first();

  if (!show) {
    return new Response(JSON.stringify({ exists: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    exists: true,
    id: show.id,
    list: show.list,
    archived: !!show.archived,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
