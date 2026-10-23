export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    // Avgle documents a public video-list API and embeddable_url values.
    // Randomize the page as well as the chosen video to avoid always showing recent results.
    const page = Math.floor(Math.random() * 500);
    const response = await fetch("https://api.avgle.com/v1/videos/" + page + "?limit=50&o=mr&t=a&type=public", {
      headers: { "Accept": "application/json" }
    });
    if (!response.ok) return res.status(502).json({ error: "Video source is unavailable" });
    const data = await response.json();
    const videos = data && data.success && data.response && Array.isArray(data.response.videos) ? data.response.videos : [];
    const usable = videos.filter(v => typeof v.embedded_url === "string" && /^https:\/\/avgle\.com\/embed\/[a-zA-Z0-9]+/.test(v.embedded_url))
      .map(v => ({ title: String(v.title || "Random video").slice(0, 180), embed: v.embedded_url, url: v.video_url || "https://avgle.com/" }));
    if (!usable.length) return res.status(502).json({ error: "No embeddable videos returned" });
    return res.status(200).json(usable[Math.floor(Math.random() * usable.length)]);
  } catch (_) {
    return res.status(502).json({ error: "Random video lookup failed" });
  }
}