export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { x, y } = req.query;
  if (!x || !y) return res.status(400).end();

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) return res.status(500).end();

  const mapUrl = `https://smap.kakao.com/staticmap/v2.png?appkey=${apiKey}&width=280&height=160&center=${x},${y}&markers=TYPE_A,RED,${x},${y}&level=3`;

  try {
    const response = await fetch(mapUrl, {
      headers: { Referer: 'https://gansulhero.vercel.app' }
    });
    if (!response.ok) return res.status(response.status).end();
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch {
    res.status(500).end();
  }
}
