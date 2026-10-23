export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const login = String(req.query.login || "").replace(/^@/, "").trim().toLowerCase();
  const range = String(req.query.range || "7d");
  if (!/^[a-z0-9_]{1,25}$/.test(login) || !["7d", "24hr"].includes(range)) {
    return res.status(400).json({ clips: [] });
  }

  // Public Twitch web GraphQL endpoint; no user login or client secret is exposed.
  const filter = range === "24hr" ? "LAST_DAY" : "LAST_WEEK";
  const query = `query { user(login: "${login}") { clips(first: 20, criteria: { filter: ${filter} }) { edges { node { slug title viewCount createdAt } } } } }`;
  try {
    const response = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko"
      },
      body: JSON.stringify({ query })
    });
    if (!response.ok) return res.status(502).json({ clips: [] });
    const payload = await response.json();
    const edges = payload?.data?.user?.clips?.edges || [];
    const clips = edges
      .map(edge => edge?.node)
      .filter(clip => clip && clip.slug)
      .sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0))
      .map(clip => ({ slug: clip.slug, title: clip.title || "", viewCount: Number(clip.viewCount || 0), createdAt: clip.createdAt || "" }));
    return res.status(200).json({ clips });
  } catch (_) {
    return res.status(502).json({ clips: [] });
  }
}
