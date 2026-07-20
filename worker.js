const MAX_BYTES = 100 * 1024 * 1024;
const safe = (value, limit = 200) => String(value || '').replace(/[\r\n]/g, ' ').slice(0, limit);

function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header || '');
  if (!match) return null;
  let start = match[1] === '' ? 0 : Number(match[1]);
  let end = match[2] === '' ? size - 1 : Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= size) return 'invalid';
  end = Math.min(end, size - 1);
  return { offset: start, length: end - start + 1 };
}

async function listLibrary(env) {
  const listed = await env.MUSIC.list({ prefix: 'tracks/' });
  const albums = new Map();
  for (const object of listed.objects) {
    const m = object.customMetadata || {};
    const albumId = m.albumId || 'singles';
    if (!albums.has(albumId)) albums.set(albumId, { id: albumId, name: m.albumName || 'Singles', emoji: m.albumEmoji || '🎵', tracks: [] });
    albums.get(albumId).tracks.push({
      id: object.key.slice(7), name: m.trackName || object.key.slice(7), size: object.size,
      duration: Number(m.duration || 0), streamUrl: `/api/file/${encodeURIComponent(object.key.slice(7))}`,
      downloadUrl: `/api/file/${encodeURIComponent(object.key.slice(7))}?download=1`
    });
  }
  return Response.json({ albums: [...albums.values()] }, { headers: { 'Cache-Control': 'no-store' } });
}

async function upload(request, env) {
  if (!env.UPLOAD_TOKEN || request.headers.get('X-Upload-Token') !== env.UPLOAD_TOKEN) return new Response('Unauthorized', { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.size || file.size > MAX_BYTES) return new Response('Audio file must be 1–100 MB.', { status: 400 });
  if (!file.type.startsWith('audio/')) return new Response('Only audio files are allowed.', { status: 400 });
  const ext = (file.name.match(/\.[a-z0-9]{1,10}$/i) || [''])[0];
  const id = `${crypto.randomUUID()}${ext}`;
  await env.MUSIC.put(`tracks/${id}`, file.stream(), {
    httpMetadata: { contentType: file.type, contentDisposition: `inline; filename="${safe(file.name)}"` },
    customMetadata: { albumId: safe(form.get('albumId'), 80), albumName: safe(form.get('albumName')), albumEmoji: safe(form.get('albumEmoji'), 8), trackName: safe(file.name) }
  });
  return Response.json({ id }, { status: 201 });
}

async function serveFile(request, env, id) {
  if (!/^[a-f0-9-]{36}(\.[a-z0-9]{1,10})?$/i.test(id)) return new Response('Not found', { status: 404 });
  const key = `tracks/${id}`;
  const head = await env.MUSIC.head(key);
  if (!head) return new Response('Not found', { status: 404 });
  const range = byteRange(request.headers.get('Range'), head.size);
  if (range === 'invalid') return new Response('Range not satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } });
  const object = await env.MUSIC.get(key, range ? { range } : undefined);
  const headers = new Headers();
  object.writeHttpMetadata(headers); headers.set('ETag', object.httpEtag); headers.set('Accept-Ranges', 'bytes');
  if (range) headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
  if (new URL(request.url).searchParams.has('download')) headers.set('Content-Disposition', `attachment; filename="${object.customMetadata?.trackName || id}"`);
  return new Response(object.body, { headers, status: range ? 206 : 200 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/library' && request.method === 'GET') return listLibrary(env);
    if (url.pathname === '/api/upload' && request.method === 'POST') return upload(request, env);
    const file = /^\/api\/file\/([^/]+)$/.exec(url.pathname);
    if (file && request.method === 'GET') return serveFile(request, env, decodeURIComponent(file[1]));
    return env.ASSETS.fetch(request);
  }
};
