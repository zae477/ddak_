// api/share.js — 공유 링크 저장/조회
// POST /api/share  { spots: ["강남", "신촌"] }  → { id: "abc123" }
// GET  /api/share?id=abc123                     → { spots: ["강남", "신촌"] }

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvSet(key, value, exSeconds = 60 * 60 * 24 * 30) {
  const res = await fetch(`${KV_URL}/set/${key}/${encodeURIComponent(JSON.stringify(value))}?ex=${exSeconds}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  return res.ok;
}

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  if (!data.result) return null;
  return JSON.parse(decodeURIComponent(data.result));
}

function makeId() {
  return Math.random().toString(36).slice(2, 8);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { spots } = req.body;
    if (!spots || spots.length < 2) return res.status(400).json({ error: 'spots required' });
    const id = makeId();
    await kvSet(`share:${id}`, spots);
    return res.status(200).json({ id });
  }

  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const spots = await kvGet(`share:${id}`);
    if (!spots) return res.status(404).json({ error: 'not found' });
    return res.status(200).json({ spots });
  }

  res.status(405).end();
}
