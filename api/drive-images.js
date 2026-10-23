export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const folder = "1fCSROI-qGb0cRHLPH15mZcrOGOupw9ac";
  try {
    const response = await fetch("https://drive.google.com/embeddedfolderview?id=" + folder + "#grid", {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok) return res.status(502).json({ images: [], error: "Drive folder could not be read" });
    const html = await response.text();
    const found = new Map();
    // Google Drive's embedded folder view exposes file IDs and image MIME types in its item markup.
    for (const match of html.matchAll(/<[^>]*(?:data-id|data-target)[^>]*>/gi)) {
      const tag = match[0];
      const id = (tag.match(/data-id=["']([a-zA-Z0-9_-]{10,})["']/i) || tag.match(/data-target=["']([a-zA-Z0-9_-]{10,})["']/i) || [])[1];
      if (!id || id === folder) continue;
      const mime = (tag.match(/data-mime-type=["']([^"']+)["']/i) || [])[1] || "";
      if (mime && !mime.toLowerCase().startsWith("image/")) continue;
      found.set(id, { id, url: "https://drive.google.com/thumbnail?id=" + id + "&sz=w1200" });
    }
    // Some Drive page versions keep the MIME type adjacent to the ID instead of on the same element.
    if (!found.size) {
      for (const m of html.matchAll(/(?:data-id|data-target)=["']([a-zA-Z0-9_-]{10,})["']/gi)) {
        const id = m[1], context = html.slice(Math.max(0, m.index - 500), Math.min(html.length, m.index + 800));
        if (id !== folder && /image\/(?:jpeg|png|gif|webp|avif)/i.test(context)) {
          found.set(id, { id, url: "https://drive.google.com/thumbnail?id=" + id + "&sz=w1200" });
        }
      }
    }
    return res.status(200).json({ images: [...found.values()] });
  } catch (_) {
    return res.status(502).json({ images: [], error: "Drive folder request failed" });
  }
}