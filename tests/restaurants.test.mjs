import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/restaurants.js';

const ENV = {
  KAKAO_REST_API_KEY: 'kakao-test',
  GOOGLE_PLACES_API_KEY: 'places-test',
  TMAP_API_KEY: 'tmap-test',
};

async function request(station = '신촌(경의중앙)', method = 'GET') {
  const response = {
    headers: {}, code: 0,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
  await handler({ method, query: { station } }, response);
  return response;
}

function installMocks(context, fetch, env = ENV) {
  context.mock.method(globalThis, 'fetch', fetch);
  const original = Object.fromEntries(Object.keys(ENV).map(key => [key, process.env[key]]));
  for (const key of Object.keys(ENV)) {
    if (env[key]) process.env[key] = env[key];
    else delete process.env[key];
  }
  context.after(() => {
    for (const key of Object.keys(ENV)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
}

function exit(name, x = 127.02) {
  return {
    place_name: name, category_name: '교통,수송 > 지하철,전철 > 지하철출구',
    x: String(x), y: '37.5', address_name: '서울 서대문구',
  };
}

function place(id, overrides = {}) {
  return {
    id, displayName: { text: id }, location: { latitude: 37.5, longitude: 127.03 },
    rating: 4.7, userRatingCount: 50, businessStatus: 'OPERATIONAL',
    primaryTypeDisplayName: { text: '한식' },
    photos: [{
      name: 'places/' + id + '/photos/photo',
      googleMapsUri: 'https://www.google.com/maps/photos/' + id,
      authorAttributions: [{ displayName: '작성자', uri: 'https://www.google.com/maps/contrib/1' }],
    }],
    ...overrides,
  };
}

test('ranks verified restaurants, includes exactly 900 seconds and fetches photos for the final five only', async context => {
  const walks = [];
  const photos = [];
  const times = { tooFar: 901, a: 900, b: 670, c: 300, d: 421, e: 11, f: 660, g: 40 };
  installMocks(context, async (url, options = {}) => {
    const address = new URL(url);
    if (address.hostname === 'dapi.kakao.com') {
      assert.match(address.searchParams.get('query'), /신촌역 경의 1번출구/);
      return Response.json({ documents: [exit('신촌역 2호선 1번출구', 126.9), exit('신촌역 경의중앙선 1번출구')] });
    }
    if (address.pathname.endsWith('places:searchNearby')) {
      const request = JSON.parse(options.body);
      assert.equal(request.maxResultCount, 20);
      assert.equal(request.locationRestriction.circle.center.longitude, 127.02);
      return Response.json({ places: [
        place('closed', { businessStatus: 'CLOSED_PERMANENTLY', rating: 5 }),
        place('few', { userRatingCount: 19, rating: 5 }),
        place('tooFar', { rating: 5 }), place('a', { rating: 4.9 }), place('b', { userRatingCount: 90 }),
        place('c'), place('d'), place('e'), place('f'), place('g'),
      ] });
    }
    if (address.hostname === 'apis.openapi.sk.com') {
      const route = new URLSearchParams(options.body);
      assert.equal(route.get('startX'), '127.02');
      assert.equal(route.get('startName'), '신촌역 경의중앙선 1번 출구');
      const endName = route.get('endName');
      walks.push(endName);
      return Response.json({ features: [{ properties: { pointType: 'SP', totalTime: times[endName] } }] });
    }
    photos.push(address.pathname.split('/')[3]);
    return Response.json({ photoUri: 'https://lh3.googleusercontent.com/image' });
  });

  const result = await request();
  assert.equal(result.code, 200);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.equal(result.body.exit, '신촌역 경의중앙선 1번 출구');
  assert.deepEqual(result.body.restaurants.map(item => item.id), ['a', 'b', 'e', 'g', 'c']);
  assert.equal(result.body.restaurants[0].walkMinutes, 15);
  assert.equal(result.body.restaurants[0].photo.credits[0].name, '작성자');
  assert.equal(new URL(result.body.restaurants[0].mapUrl).searchParams.get('query_place_id'), 'a');
  assert.deepEqual(photos.sort(), ['a', 'b', 'c', 'e', 'g']);
  assert.ok(!walks.includes('closed') && !walks.includes('few'));
});

test('selects the lowest verified alternate exit and reports an empty result when routes are over the limit', async context => {
  installMocks(context, async url => {
    const address = new URL(url);
    if (address.hostname === 'dapi.kakao.com') {
      const documents = address.searchParams.get('query').includes('1번출구') ? []
        : [exit('옥수역 3호선 4번출구'), exit('옥수역 3호선 2번출구'), exit('금호역 3호선 1번출구')];
      return Response.json({ documents });
    }
    if (address.hostname === 'places.googleapis.com') return Response.json({ places: [place('far')] });
    return Response.json({ features: [{ properties: { totalTime: 901 } }] });
  });
  const result = await request('옥수');
  assert.equal(result.code, 200);
  assert.deepEqual(result.body, { exit: '옥수역 3호선 2번 출구', restaurants: [], partial: false });
});

test('returns a retryable error instead of an empty list when every walking lookup fails', async context => {
  installMocks(context, async url => {
    const address = new URL(url);
    if (address.hostname === 'dapi.kakao.com') return Response.json({ documents: [exit('옥수역 3호선 1번출구')] });
    if (address.hostname === 'places.googleapis.com') return Response.json({ places: [place('restaurant')] });
    return Response.json({}, { status: 503 });
  });
  const result = await request('옥수');
  assert.equal(result.code, 502);
  assert.equal(result.body.error, 'recommendation_unavailable');
});

test('validates requests and missing keys without spending API calls', async context => {
  installMocks(context, () => { throw new Error('unexpected provider request'); }, {});
  assert.equal((await request('옥수', 'POST')).code, 405);
  assert.equal((await request(['옥수'])).code, 400);
  const result = await request('옥수');
  assert.equal(result.code, 503);
  assert.equal(result.body.error, 'not_configured');
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});
