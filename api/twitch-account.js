export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const login = String(req.query.login || "").replace(/^@/, "").trim().toLowerCase();
  if (!/^[a-z0-9_]{1,25}$/.test(login)) return res.status(400).json({ isPartner: false });
  const query = `query { user(login: "${login}") { broadcasterType } }`;
  try {
    const response = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko" },
      body: JSON.stringify({ query })
    });
    if (!response.ok) return res.status(502).json({ isPartner: false });
    const payload = await response.json();
    const type = String(payload?.data?.user?.broadcasterType || "").toLowerCase();
    return res.status(200).json({ isPartner: type === "partner", broadcasterType: type || "unknown" });
  } catch (_) {
    return res.status(502).json({ isPartner: false });
  }
}
