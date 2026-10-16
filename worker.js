// Only runs for /assets/*.mp4 (run_worker_first in wrangler.jsonc); every other path is served by static assets directly.
// Static assets answer Range requests with the full file (200), and Safari on iPhone/iPad needs 206 partial content to play video.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.endsWith(".mp4")) return env.ASSETS.fetch(request);

    const res = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
    if (!res.ok) return res;
    const body = await res.arrayBuffer();
    const size = body.byteLength;

    const headers = new Headers(res.headers);
    headers.set("Content-Type", "video/mp4");
    headers.set("Accept-Ranges", "bytes");
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
    headers.delete("Content-Encoding");

    const range = request.headers.get("Range");
    const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) {
      headers.set("Content-Length", String(size));
      return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
    }

    let start, end;
    if (m[1] === "") { start = Math.max(0, size - Number(m[2])); end = size - 1; } // suffix range: last N bytes
    else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
    if (start >= size || start > end) {
      headers.set("Content-Range", "bytes */" + size);
      return new Response(null, { status: 416, headers });
    }

    headers.set("Content-Range", "bytes " + start + "-" + end + "/" + size);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(request.method === "HEAD" ? null : body.slice(start, end + 1), { status: 206, headers });
  },
};
