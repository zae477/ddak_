import { findStationExit, validStationName } from '../server/kakao-local.js';

const PLACES_BASE = 'https://places.googleapis.com/v1/';
const TMAP_PEDESTRIAN = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1';
const MAX_RESULTS = 5;
const MAX_WALK_SECONDS = 15 * 60;
const MIN_REVIEWS = 20;
const CANDIDATE_FIELDS = [
  'id', 'displayName', 'location', 'rating', 'userRatingCount', 'businessStatus',
  'primaryTypeDisplayName', 'priceRange', 'photos', 'attributions',
].map(field => 'places.' + field).join(',');

function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function signedPhotoUrl(value) {
  const url = httpsUrl(value);
  return url && new URL(url).hostname.endsWith('.googleusercontent.com') ? url : null;
}

function compareRating(a, b) {
  return b.rating - a.rating || b.userRatingCount - a.userRatingCount;
}

function placeMapUrl(place) {
  const params = new URLSearchParams({ api: '1', query: place.displayName.text, query_place_id: place.id });
  return 'https://www.google.com/maps/search/?' + params;
}

async function candidatesAt(exit, key, signal) {
  const response = await fetch(PLACES_BASE + 'places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': CANDIDATE_FIELDS,
    },
    signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
    body: JSON.stringify({
      includedTypes: ['restaurant'],
      excludedPrimaryTypes: ['cafe', 'bar', 'meal_delivery', 'meal_takeaway'],
      maxResultCount: 20,
      rankPreference: 'POPULARITY',
      languageCode: 'ko',
      regionCode: 'KR',
      locationRestriction: {
        circle: { center: { latitude: exit.latitude, longitude: exit.longitude }, radius: 1200 },
      },
    }),
  });
  if (!response.ok) throw new Error('restaurant search failed');
  const { places = [] } = await response.json();
  return [...new Map(places.filter(place =>
    typeof place.id === 'string' && place.id && place.displayName?.text &&
    place.businessStatus === 'OPERATIONAL' && Number.isFinite(place.rating) &&
    place.rating > 0 && place.rating <= 5 && Number.isInteger(place.userRatingCount) &&
    place.userRatingCount >= MIN_REVIEWS && Number.isFinite(place.location?.latitude) &&
    Number.isFinite(place.location?.longitude)
  ).map(place => [place.id, place])).values()].sort(compareRating);
}

async function walkSeconds(exit, place, key, signal) {
  const response = await fetch(TMAP_PEDESTRIAN, {
    method: 'POST',
    headers: { Accept: 'application/json', appKey: key },
    signal: AbortSignal.any([signal, AbortSignal.timeout(2500)]),
    body: new URLSearchParams({
      startX: exit.longitude,
      startY: exit.latitude,
      endX: place.location.longitude,
      endY: place.location.latitude,
      startName: exit.label,
      endName: place.displayName.text,
      reqCoordType: 'WGS84GEO',
      resCoordType: 'WGS84GEO',
      searchOption: '10',
    }),
  });
  if (!response.ok) throw new Error('walk route unavailable');
  const { features } = await response.json();
  const start = features?.find(feature => feature.properties?.pointType === 'SP') || features?.[0];
  const seconds = start?.properties?.totalTime;
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('walk time missing');
  return seconds;
}

async function rankedWalks(places, exit, key, signal) {
  const qualified = [];
  let failures = 0;
  for (let i = 0; i < places.length && !signal.aborted; i += 5) {
    const batch = places.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map(async place => ({
      place, seconds: await walkSeconds(exit, place, key, signal),
    })));
    for (const result of results) {
      if (result.status === 'rejected') failures += 1;
      else if (result.value.seconds <= MAX_WALK_SECONDS) qualified.push(result.value);
    }
    qualified.sort((a, b) => compareRating(a.place, b.place)
      || a.seconds - b.seconds || a.place.id.localeCompare(b.place.id));
    const next = places[i + batch.length];
    if (qualified.length >= MAX_RESULTS &&
      (!next || compareRating(qualified[MAX_RESULTS - 1].place, next) < 0)) break;
  }
  if (qualified.length === 0 && (failures || signal.aborted)) throw new Error('walk routes unavailable');
  return { walks: qualified.slice(0, MAX_RESULTS), partial: failures > 0 || signal.aborted };
}

async function photoFor(place, key, signal) {
  const photo = place.photos?.find(item => /^places\/[\w-]+\/photos\/[\w-]+$/.test(item.name)
    && httpsUrl(item.googleMapsUri));
  if (!photo || signal.aborted) return null;
  try {
    const url = new URL(PLACES_BASE + photo.name + '/media');
    url.search = new URLSearchParams({ maxWidthPx: '560', maxHeightPx: '365', skipHttpRedirect: 'true', key });
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
    });
    if (!response.ok) return null;
    const src = signedPhotoUrl((await response.json()).photoUri);
    if (!src) return null;
    return {
      src,
      source: httpsUrl(photo.googleMapsUri),
      credits: (photo.authorAttributions || []).filter(item => item.displayName).map(item => ({
        name: item.displayName, url: httpsUrl(item.uri), avatar: signedPhotoUrl(item.photoUri),
      })),
    };
  } catch { return null; }
}

function koreanPriceRange(priceRange) {
  const start = priceRange?.startPrice;
  const end = priceRange?.endPrice;
  if (start?.currencyCode !== 'KRW' || !/^[1-9]\d{0,7}$/.test(start.units)) return null;
  const startWon = Number(start.units);
  const format = won => won.toLocaleString('ko-KR') + '원';
  if (end?.currencyCode === 'KRW' && /^[1-9]\d{0,7}$/.test(end.units) && Number(end.units) > startWon) {
    return format(startWon) + '~' + format(Number(end.units));
  }
  return format(startWon) + '부터';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  const { station } = req.query;
  if (!validStationName(station)) return res.status(400).json({ error: 'invalid_station' });

  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  const tmapKey = process.env.TMAP_API_KEY;
  if (!kakaoKey || !placesKey || !tmapKey) return res.status(503).json({ error: 'not_configured' });

  const signal = AbortSignal.timeout(10500);
  try {
    const exit = await findStationExit(station.trim(), kakaoKey,
      AbortSignal.any([signal, AbortSignal.timeout(3000)]));
    if (!exit) return res.status(404).json({ error: 'exit_unavailable' });
    const eligible = await candidatesAt(exit, placesKey, signal);
    const { walks, partial } = await rankedWalks(eligible, exit, tmapKey, signal);
    const restaurants = await Promise.all(walks.map(async ({ place, seconds }) => ({
      id: place.id,
      name: place.displayName.text,
      category: place.primaryTypeDisplayName?.text || '음식점',
      price: koreanPriceRange(place.priceRange),
      rating: place.rating,
      reviews: place.userRatingCount,
      walkMinutes: Math.ceil(seconds / 60),
      mapUrl: placeMapUrl(place),
      photo: await photoFor(place, placesKey, signal),
      attributions: (place.attributions || []).filter(item => item.provider).map(item => ({
        name: item.provider, url: httpsUrl(item.providerUri),
      })),
    })));
    return res.status(200).json({ exit: exit.label, restaurants, partial });
  } catch {
    return res.status(signal.aborted ? 504 : 502).json({ error: 'recommendation_unavailable' });
  }
}
