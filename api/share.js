// The legacy short-link endpoint remains available for existing messages.
import { randomBytes } from 'node:crypto';

function validSpots(spots) {
  return Array.isArray(spots) && spots.length >= 2 && spots.length <= 10
    && spots.every(name => typeof name === 'string' && name.trim() && name.length <= 80);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }
  const id = req.method === 'GET' ? req.query.id : randomBytes(7).toString('hex');
  if (typeof id !== 'string' || !/^[a-z0-9]{1,32}$/i.test(id)) {
    return res.status(400).json({ error: 'invalid id' });
  }
  const spots = req.body?.spots;
  if (req.method === 'POST' && !validSpots(spots)) {
    return res.status(400).json({ error: 'invalid stations' });
  }

  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return res.status(503).json({ error: 'legacy sharing unavailable' });

  try {
    const base = url.replace(/\/$/, '');
    const key = 'share:' + id;
    const options = {
      headers: { Authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(4000),
    };
    if (req.method === 'POST') {
      const value = encodeURIComponent(JSON.stringify(spots));
      const response = await fetch(base + '/set/' + key + '/' + value + '?ex=2592000', options);
      if (!response.ok || (await response.json()).result !== 'OK') throw new Error('legacy store failed');
      return res.status(200).json({ id });
    }
    const response = await fetch(base + '/get/' + key, options);
    if (!response.ok) throw new Error('legacy lookup failed');
    const { result } = await response.json();
    if (!result) return res.status(404).json({ error: 'not found' });
    let names;
    try { names = JSON.parse(result); }
    catch { names = JSON.parse(decodeURIComponent(result)); }
    if (!validSpots(names)) return res.status(404).json({ error: 'not found' });
    return res.status(200).json({ spots: names });
  } catch {
    return res.status(502).json({ error: 'legacy sharing unavailable' });
  }
}
