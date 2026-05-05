export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.length < 2) return res.json({ documents: [] });

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) return res.json({ documents: [], error: 'KAKAO_REST_API_KEY not set' });

  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=7`,
      { headers: { Authorization: `KakaoAK ${apiKey}` } }
    );
    const data = await response.json();
    if (!response.ok) return res.json({ documents: [], kakao_error: data, status: response.status });
    res.json({ documents: data.documents || [] });
  } catch (err) {
    res.json({ documents: [], error: err.message });
  }
}
