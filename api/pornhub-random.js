export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const page = 1 + Math.floor(Math.random() * 8);
    const endpoint = "https://www.pornhub.com/webmasters/search?ordering=featured&period=alltime&thumbsize=large&page=" + page;
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36", "Accept": "application/json" }
    });
    if (!response.ok) return res.status(502).json({ error: "Pornhub video feed is unavailable" });
    const data = await response.json();
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const usable = videos.map(video => {
      const url = String(video.url || "");
      const key = url.match(/[?&]viewkey=([a-zA-Z0-9]+)/)?.[1] || url.match(/\/view_video\.php\/([a-zA-Z0-9]+)/)?.[1] || String(video.video_id || video.id || "");
      return key ? { title: String(video.title || "Random video").slice(0, 180), embed: "https://www.pornhub.com/embed/" + encodeURIComponent(key), url: url.startsWith("http") ? url : "https://www.pornhub.com" + url } : null;
    }).filter(Boolean);
    if (!usable.length) return res.status(502).json({ error: "No embeddable videos returned" });
    return res.status(200).json(usable[Math.floor(Math.random() * usable.length)]);
  } catch (_) {
    return res.status(502).json({ error: "Pornhub video lookup failed" });
  }
}