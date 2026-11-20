const BASE = 'https://dapi.kakao.com/v2/local/search/';
const SUBWAY_REGION = /^(서울|인천|경기|강원|충남|충청남도)/;
const UPDATED_NAMES = new Map([['당고개', '불암산'], ['신길온천', '능길'], ['뚝섬유원지', '자양']]);
const STATION_NAME = /^[\p{L}\p{N} ().·-]{1,40}$/u;

export function validStationName(value) {
  return typeof value === 'string' && STATION_NAME.test(value.trim());
}

export async function searchKakao(endpoint, params, key, signal) {
  const response = await fetch(BASE + endpoint + '.json?' + new URLSearchParams(params), {
    headers: { Authorization: 'KakaoAK ' + key },
    signal,
  });
  return { status: response.status, body: await response.json() };
}

export function stationLookup(station) {
  const base = station.replace(/\(경의중앙\)$/, '');
  const name = UPDATED_NAMES.get(base) || base;
  const tag = name.endsWith('역') ? name : name + '역';
  const line = station.endsWith('(경의중앙)') ? '경의'
    : name === '신촌' ? '2호선' : name === '양평' ? '5호선' : '';
  return { tag, line };
}

export function matchesStation(item, tag, line) {
  const name = item.place_name;
  return typeof name === 'string' && (name === tag || name.startsWith(tag + ' '))
    && (!line || (name + ' ' + (item.category_name || '')).includes(line))
    && SUBWAY_REGION.test(item.address_name || item.road_address_name || '');
}

export async function findStationExit(station, key, signal) {
  const { tag, line } = stationLookup(station);
  const label = tag + (line ? ' ' + line : '');
  for (const suffix of [' 1번출구', ' 출구']) {
    const { status, body } = await searchKakao('keyword', { query: label + suffix, size: 15 }, key, signal);
    if (status !== 200 || !Array.isArray(body.documents)) throw new Error('exit search unavailable');
    const exits = body.documents
      .filter(item => matchesStation(item, tag, line) && item.category_name?.endsWith('지하철출구'))
      .map(item => ({
        label: item.place_name.replace(/(\d+)번\s*출구$/, '$1번 출구'),
        number: Number(item.place_name.match(/(\d{1,2})번\s*출구$/)?.[1]),
        latitude: Number.parseFloat(item.y),
        longitude: Number.parseFloat(item.x),
      }))
      .filter(item => item.number > 0 && Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
      .sort((a, b) => a.number - b.number);
    const verified = suffix === ' 1번출구' ? exits.find(item => item.number === 1) : exits[0];
    if (verified) return verified;
  }
  return null;
}
