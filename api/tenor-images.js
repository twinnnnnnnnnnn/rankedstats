export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const response = await fetch("https://tenor.com/search/anime-boobs-gifs", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36" }
    });
    if (!response.ok) return res.status(502).json({ images: [], error: "Tenor search could not be read" });
    const html = (await response.text()).replace(/\\u0026/g, "&").replace(/\\\//g, "/").replace(/&amp;/g, "&");
    const found = new Set();
    for (const m of html.matchAll(/https?:\/\/media\.tenor\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(?:gif|webp|png|jpg)(?:\?[^"'\\\s<>]*)?/gi)) {
      const url = m[0].replace(/\\u0026/g, "&");
      if (!/\/preview\//i.test(url)) found.add(url);
    }
    // Tenor sometimes stores the animation URL in escaped JSON fields.
    for (const m of html.matchAll(/media\.tenor\.com\\?\/[a-zA-Z0-9_-]+\\?\/[a-zA-Z0-9_-]+\.(?:gif|webp|png|jpg)/gi)) {
      found.add("https://" + m[0].replace(/\\\//g, "/").replace(/^https?:\/\//, ""));
    }
    return res.status(200).json({ images: [...found].slice(0, 80).map(url => ({ url })) });
  } catch (_) {
    return res.status(502).json({ images: [], error: "Tenor request failed" });
  }
}