// api/kakao.js — Vercel serverless function: Kakao Local API proxy
// Kakao REST API key is kept server-side; browser never sees it.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
  if (!KAKAO_KEY) return res.status(500).json({ error: 'KAKAO_REST_API_KEY not set' });

  // Forward all query params to Kakao, but choose endpoint via ?_endpoint=
  const { _endpoint, ...params } = req.query;

  const ALLOWED = {
    keyword:  'https://dapi.kakao.com/v2/local/search/keyword.json',
    category: 'https://dapi.kakao.com/v2/local/search/category.json',
  };

  const kakaoUrl = ALLOWED[_endpoint];
  if (!kakaoUrl) return res.status(400).json({ error: 'unknown endpoint' });

  const qs = new URLSearchParams(params).toString();
  const url = `${kakaoUrl}?${qs}`;

  try {
    const kakaoRes = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    });
    const body = await kakaoRes.json();
    res.status(kakaoRes.status).json(body);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
