// The REST API key is configured in Vercel and is never sent to the browser.
import { matchesStation, searchKakao, stationLookup, validStationName } from '../server/kakao-local.js';

const ALLOWED_ARGS = ['query', 'category_group_code', 'x', 'y', 'radius', 'size', 'page', 'sort', 'rect'];

async function nearbyPlaces(station, key, signal) {
  const { tag, line } = stationLookup(station);
  const { status, body } = await searchKakao('keyword', {
    query: tag, category_group_code: 'SW8', size: '15',
  }, key, signal);
  if (status !== 200) throw new Error('station lookup failed');
  const target = (body.documents || []).find(item => matchesStation(item, tag, line));
  if (!target || !Number.isFinite(Number(target.x)) || !Number.isFinite(Number(target.y))) return null;

  const area = { x: target.x, y: target.y, radius: '500', size: '1', sort: 'distance' };
  const sources = [
    ['restaurant', 'category', { category_group_code: 'FD6' }],
    ['cafe', 'category', { category_group_code: 'CE7' }],
    ['bar', 'keyword', { query: '술집' }],
  ];
  const entries = await Promise.allSettled(sources.map(async ([label, endpoint, params]) => {
    const result = await searchKakao(endpoint, { ...area, ...params }, key, signal);
    const count = result.body.meta?.total_count;
    if (result.status !== 200 || !Number.isInteger(count)) throw new Error('place count unavailable');
    return [label, count];
  }));
  const counts = Object.fromEntries(entries.filter(item => item.status === 'fulfilled').map(item => item.value));
  if (Object.keys(counts).length === 0) throw new Error('place counts unavailable');
  return counts;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  const { _endpoint: endpoint, station } = req.query;
  if (!['nearby', 'keyword', 'category'].includes(endpoint)) {
    return res.status(400).json({ error: 'unknown endpoint' });
  }
  if (endpoint === 'nearby' && !validStationName(station)) {
    return res.status(400).json({ error: 'invalid station' });
  }
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return res.status(503).json({ error: 'place search unavailable' });
  const signal = AbortSignal.timeout(4000);

  try {
    if (endpoint === 'nearby') {
      const counts = await nearbyPlaces(station.trim(), key, signal);
      if (!counts) return res.status(404).json({ error: 'station not found' });
      if (Object.keys(counts).length === 3) {
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800');
      }
      return res.status(200).json(counts);
    }
    const params = Object.fromEntries(ALLOWED_ARGS.filter(name => typeof req.query[name] === 'string')
      .map(name => [name, req.query[name]]));
    const { status, body } = await searchKakao(endpoint, params, key, signal);
    return res.status(status).json(body);
  } catch {
    return res.status(502).json({ error: 'place search unavailable' });
  }
}
