function parseStationList(names) {
  if (!Array.isArray(names) || names.length < 2 || names.length > 10) return null;
  if (names.some(name => typeof name !== 'string' || !name.trim() || name.length > 80)) return null;
  return names.map((name, i) => ({ id: i + 1, value: name.trim() }));
}

const MEETING_PLACE_LIMIT = 60;
const meetingTimeFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric',
  weekday: 'short', hour: 'numeric', minute: '2-digit',
});

function meetingDetails(at, place) {
  const wallTime = /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at || '')
    ? new Date(at + 'Z') : null;
  const validTime = Number.isFinite(wallTime?.getTime()) && wallTime.toISOString().slice(0, 16) === at;
  const normalizedPlace = (place || '').trim().replace(/\s+/g, ' ');
  return {
    at: validTime ? at : '',
    place: normalizedPlace.length <= MEETING_PLACE_LIMIT ? normalizedPlace : '',
  };
}

function formatMeetingTime(at) {
  // Display the entered Korean wall time consistently on devices in any time zone.
  return meetingTimeFormat.format(new Date(at + 'Z'));
}

function createResultLink(stations, destination, meeting) {
  const url = new URL('/', location.origin);
  if (location.hostname === 'ddak-middle.com') url.hostname = 'www.ddak-middle.com';
  for (const station of stations) url.searchParams.append('from', station);
  url.searchParams.set('meet', destination);
  if (meeting?.at) url.searchParams.set('at', meeting.at);
  if (meeting?.place) url.searchParams.set('place', meeting.place);
  return url.href;
}

async function loadSharedSearch(params, signal) {
  if (params.has('from') || params.has('meet')) {
    const spots = parseStationList(params.getAll('from'));
    const destination = params.get('meet');
    if (!spots || !destination || destination.length > 80) throw new Error('invalid share link');
    return { spots, destination, meeting: meetingDetails(params.get('at'), params.get('place')) };
  }

  const id = params.get('s');
  if (!id || !/^[a-z0-9]{1,32}$/i.test(id)) throw new Error('invalid share id');
  const response = await fetch('/api/share?id=' + encodeURIComponent(id), { signal });
  if (!response.ok) throw new Error('share link unavailable');
  const { spots: names } = await response.json();
  const spots = parseStationList(names);
  if (!spots) throw new Error('invalid shared stations');
  return { spots, destination: null };
}

function openKakaoShare(url, station, description) {
  const kakao = window.Kakao;
  const key = window.ENV?.KAKAO_JS_KEY;
  if (!kakao || !key) throw new Error('Kakao SDK unavailable');
  if (!kakao.isInitialized()) kakao.init(key);
  if (!kakao.Share) throw new Error('Kakao Share unavailable');
  const taggedUrl = new URL(url);
  taggedUrl.searchParams.set('utm_source', 'kakaotalk');
  taggedUrl.searchParams.set('utm_medium', 'social');
  taggedUrl.searchParams.set('utm_campaign', 'result_share');
  const link = { mobileWebUrl: taggedUrl.href, webUrl: taggedUrl.href };
  return kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: '우리 딱중간은 ' + station,
      description: description || '출발역별 예상 소요시간과 다른 추천역도 확인해 보세요.',
      imageUrl: 'https://www.ddak-middle.com/share-card.png',
      imageWidth: 1200,
      imageHeight: 630,
      link,
    },
    buttons: [{ title: '추천 결과 보기', link }],
    installTalk: true,
  });
}

async function copyShareText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  const previousFocus = document.activeElement;
  (previousFocus?.closest('dialog[open]') || document.body).appendChild(field);
  field.select();
  try {
    if (!document.execCommand('copy')) throw new Error('clipboard unavailable');
  } finally {
    field.remove();
    previousFocus?.focus();
  }
}

function saveResultImage(result) {
  const canvas = document.createElement('canvas');
  canvas.width = 840;
  canvas.height = 365 + result.times.length * 60;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#F4F4F4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(0, 0, canvas.width, 218);
  ctx.fillStyle = '#AADC00';
  ctx.font = '700 34px sans-serif';
  ctx.fillText('딱중간', 42, 64);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 58px sans-serif';
  ctx.fillText(result.name, 42, 149, 760);
  ctx.font = '500 24px sans-serif';
  ctx.fillText('공평도 ' + result.score + ' · 지하철 예상 소요시간', 42, 193, 760);
  ctx.fillStyle = '#1A1A1A';
  ctx.font = '600 29px sans-serif';
  result.times.forEach((time, index) => {
    const y = 275 + index * 60;
    ctx.textAlign = 'left';
    const participants = time.people > 1 ? ' (' + time.people + '명)' : '';
    ctx.fillText(time.from + participants, 42, y, 410);
    ctx.textAlign = 'right';
    ctx.fillText(time.mins + '분 · 환승 ' + time.transfers + '회', 798, y, 300);
  });
  ctx.textAlign = 'left';
  ctx.font = '400 24px sans-serif';
  ctx.fillText('ddak-middle.com', 42, canvas.height - 42);
  const href = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = href;
  link.download = '딱중간-' + result.name + '.png';
  link.click();
}
