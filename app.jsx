// app.jsx — 지하철 중간지점 찾기 (Toss-style)

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── Tokens ────────────────────────────────────────────────────
const T = {
  bg: '#F8F8F8',
  card: '#FFFFFF',
  primary: '#3182F6',
  primarySoft: '#E8F2FE',
  ink: '#191F28',
  ink2: '#4E5968',
  ink3: '#8B95A1',
  line: '#F2F4F6',
  accent: '#F9FAFB',
};

// ── API helpers ───────────────────────────────────────────────
const KAKAO_KEY = () => window.ENV && window.ENV.KAKAO_REST_API_KEY;

// 카카오 키워드 검색 — 지하철역 자동완성
async function searchKakaoStation(query) {
  if (!query.trim()) return [];
  const key = KAKAO_KEY();
  if (!key) return [];
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query + ' 역')}&category_group_code=SW8&size=7`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.documents || []).map(d => ({
      name: d.place_name,
      address: d.road_address_name || d.address_name,
      x: parseFloat(d.x),
      y: parseFloat(d.y),
      id: d.id,
      // 호선 파싱: place_name에서 "2호선" 등 추출
      line: parseLineFromName(d.place_name, d.category_name),
      color: getLineColor(parseLineFromName(d.place_name, d.category_name)),
    }));
  } catch { return []; }
}

// 역명에서 호선 파싱
function parseLineFromName(placeName, categoryName) {
  const cat = categoryName || '';
  const m = cat.match(/(\d+)호선/) || placeName.match(/(\d+)호선/);
  if (m) return m[1];
  if (cat.includes('신분당') || placeName.includes('신분당')) return '신분당';
  if (cat.includes('경의') || cat.includes('중앙')) return '경의중앙';
  if (cat.includes('공항')) return '공항';
  if (cat.includes('분당')) return '분당';
  if (cat.includes('수인')) return '수인';
  if (cat.includes('경춘')) return '경춘';
  if (cat.includes('우이') || cat.includes('신설')) return '우이신설';
  if (cat.includes('GTX')) return 'GTX';
  return '';
}

function getLineColor(line) {
  const map = {
    '1': '#0052A4', '2': '#00A84D', '3': '#EF7C1C', '4': '#00A5DE',
    '5': '#996CAC', '6': '#CD7C2F', '7': '#747F00', '8': '#E6186C',
    '9': '#BDB092', '신분당': '#BE0B30', '경의중앙': '#77C4A3',
    '공항': '#4696CD', '분당': '#F5A200', '수인': '#F5A200',
    '경춘': '#0C8E72', '우이신설': '#B0CE18', 'GTX': '#6200EE',
  };
  return map[line] || '#8B95A1';
}

// 카카오 좌표 조회 (역명으로 정확한 위치 가져오기)
async function getStationCoord(stationName) {
  const key = KAKAO_KEY();
  if (!key) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(stationName)}&category_group_code=SW8&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const d = data.documents && data.documents[0];
    if (!d) return null;
    return { x: parseFloat(d.x), y: parseFloat(d.y), name: d.place_name, id: d.id };
  } catch { return null; }
}

// 카카오 카테고리 장소 수 조회 (반경 500m)
async function getVenueCount(x, y, categoryCode) {
  const key = KAKAO_KEY();
  if (!key) return 0;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${categoryCode}&x=${x}&y=${y}&radius=500&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.meta ? data.meta.total_count : 0;
  } catch { return 0; }
}

// 공공데이터포털 — 지하철 경로 소요시간 조회
// ws.bus.go.kr 은 CORS 제한이 있어 직접 호출이 불가능한 경우가 많음
// fallback: 직선거리 기반 추정치 사용
async function getSubwayRoute(startCoord, endCoord, _time) {
  const key = window.ENV && window.ENV.PUBLIC_DATA_API_KEY;
  if (!key || !startCoord || !endCoord) return estimateTime(startCoord, endCoord);

  try {
    const params = new URLSearchParams({
      ServiceKey: decodeURIComponent(key),
      startX: startCoord.x.toFixed(6),
      startY: startCoord.y.toFixed(6),
      endX: endCoord.x.toFixed(6),
      endY: endCoord.y.toFixed(6),
      format: 'json',
      count: 1,
    });
    const url = `https://ws.bus.go.kr/api/rest/pathinfo/getPathInfoBySubway?${params}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const item = data.msgBody && data.msgBody.itemList && data.msgBody.itemList[0];
    if (!item) throw new Error('no result');
    return {
      mins: Math.round(parseInt(item.totalTime || 30, 10)),
      transfers: parseInt(item.transferCount || 0, 10),
      noTrain: false,
    };
  } catch {
    return estimateTime(startCoord, endCoord);
  }
}

// 직선거리 기반 소요시간 추정 (API 실패 fallback)
function estimateTime(from, to) {
  if (!from || !to) return { mins: 30, transfers: 0, noTrain: false };
  const dx = (from.x - to.x) * 88.8;  // 1도 ≈ 88.8km (경도, 서울 위도 기준)
  const dy = (from.y - to.y) * 111.0; // 1도 ≈ 111km (위도)
  const km = Math.sqrt(dx * dx + dy * dy);
  const mins = Math.max(5, Math.round(km * 2.5 + 3)); // 지하철 평균속도 고려
  const transfers = km > 15 ? 2 : km > 7 ? 1 : 0;
  return { mins, transfers, noTrain: false };
}

// 두 좌표 사이 거리(km)
function distKm(a, b) {
  const dx = (a.x - b.x) * 88.8;
  const dy = (a.y - b.y) * 111.0;
  return Math.sqrt(dx * dx + dy * dy);
}

// 무게중심 계산
function centroid(coords) {
  const n = coords.length;
  return {
    x: coords.reduce((s, c) => s + c.x, 0) / n,
    y: coords.reduce((s, c) => s + c.y, 0) / n,
  };
}

// 후보역 목록 (카카오 검색 기반으로 보강된 수도권 주요역)
// 실제로는 무게중심 기준 카카오 카테고리 검색으로 후보 생성
async function getCandidateStations(center, radiusKm = 5) {
  const key = KAKAO_KEY();
  if (!key) return FALLBACK_STATIONS;
  try {
    const radiusM = radiusKm * 1000;
    // 카카오 SW8(지하철역) 카테고리로 근처 역 탐색
    const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=SW8&x=${center.x}&y=${center.y}&radius=${Math.min(radiusM, 20000)}&size=15&sort=distance`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (!data.documents || data.documents.length === 0) {
      if (radiusKm < 10) return getCandidateStations(center, 10);
      return FALLBACK_STATIONS;
    }
    return data.documents.map(d => ({
      name: d.place_name,
      x: parseFloat(d.x),
      y: parseFloat(d.y),
      line: parseLineFromName(d.place_name, d.category_name),
      color: getLineColor(parseLineFromName(d.place_name, d.category_name)),
      expanded: radiusKm > 5,
    }));
  } catch {
    return FALLBACK_STATIONS;
  }
}

// fallback 후보역 (API 실패 시)
const FALLBACK_STATIONS = [
  { name: '서울역', line: '1', color: '#0052A4', x: 126.9723, y: 37.5547 },
  { name: '공덕역', line: '5', color: '#996CAC', x: 126.9516, y: 37.5444 },
  { name: '을지로3가', line: '2', color: '#00A84D', x: 126.9934, y: 37.5663 },
  { name: '종로3가', line: '1', color: '#0052A4', x: 126.9916, y: 37.5703 },
  { name: '충무로', line: '3', color: '#EF7C1C', x: 126.9939, y: 37.5612 },
  { name: '왕십리', line: '2', color: '#00A84D', x: 127.0369, y: 37.5613 },
  { name: '신촌', line: '2', color: '#00A84D', x: 126.9369, y: 37.5550 },
  { name: '합정역', line: '2', color: '#00A84D', x: 126.9148, y: 37.5496 },
];

// ── Icons ─────────────────────────────────────────────────────
const Icon = {
  plus: (c = T.primary, size = 18) => (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M9 3v12M3 9h12" stroke={c} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  ),
  minus: (c = T.ink2, size = 18) => (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M3 9h12" stroke={c} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  ),
  close: (c = T.ink3) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 3l8 8M11 3l-8 8" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  back: (c = T.ink) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M15 5l-7 7 7 7" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  chevronDown: (c = T.ink2) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 6l4 4 4-4" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  trophy: (rank) => {
    const colors = { 1: '#FFB800', 2: '#C4C9D1', 3: '#E8874C' };
    return (
      <div style={{
        width: 28, height: 28, borderRadius: 999,
        background: colors[rank] || '#E5E8EB', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, letterSpacing: -0.3,
      }}>{rank}</div>
    );
  },
  subway: (color, line) => (
    <div style={{
      width: 22, height: 22, borderRadius: 999, background: color,
      color: '#fff', fontSize: 11, fontWeight: 800,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>{line}</div>
  ),
  share: (c = '#fff') => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 10V2M8 2L5 5M8 2l3 3M3 9v3a1 1 0 001 1h8a1 1 0 001-1V9" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  refresh: (c = T.ink) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M13 8a5 5 0 11-1.5-3.5M13 2v3h-3" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  clock: (c = T.ink3) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke={c} strokeWidth="1.5"/>
      <path d="M7 4v3.5l2 1.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

// ── Status bar & home bar ─────────────────────────────────────
function StatusBar() {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 54, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px', paddingTop: 18, pointerEvents: 'none',
    }}>
      <span style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.5" fill={T.ink}/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.5" fill={T.ink}/><rect x="9" y="2" width="3" height="9" rx="0.5" fill={T.ink}/><rect x="13.5" y="0" width="3" height="11" rx="0.5" fill={T.ink}/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={T.ink} fill="none"/><rect x="2" y="2" width="18" height="8" rx="1.5" fill={T.ink}/><rect x="22.5" y="4" width="1.5" height="4" rx="0.5" fill={T.ink}/></svg>
      </div>
    </div>
  );
}

function HomeBar({ dark = false }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 60,
      height: 34, display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
      paddingBottom: 8, pointerEvents: 'none',
    }}>
      <div style={{
        width: 139, height: 5, borderRadius: 100,
        background: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
      }} />
    </div>
  );
}

// ── Face Icons ────────────────────────────────────────────────
const FACE_PALETTE = [
  { bg: '#FFD66B', skin: '#FFB800', name: 'happy' },
  { bg: '#FF8A7A', skin: '#FF6F61', name: 'wink' },
  { bg: '#B5A6FF', skin: '#8E7CFF', name: 'cool' },
  { bg: '#6ED9C3', skin: '#00C4A7', name: 'chill' },
  { bg: '#FFD48E', skin: '#FF9500', name: 'excited' },
  { bg: '#FF8FB5', skin: '#FF4D8D', name: 'love' },
  { bg: '#7FD3FF', skin: '#00B2FF', name: 'surprise' },
  { bg: '#C1E18A', skin: '#8BC34A', name: 'smile' },
  { bg: '#D5A6E0', skin: '#AB47BC', name: 'playful' },
  { bg: '#FFB092', skin: '#FF7043', name: 'sleepy' },
];

function FaceIcon({ index = 0, size = 28 }) {
  const p = FACE_PALETTE[index % FACE_PALETTE.length];
  const s = size;
  const renderFace = () => {
    const eyeY = s * 0.42, mouthY = s * 0.62;
    const eyeR = s * 0.055;
    const stroke = '#2B1F00';
    const sw = Math.max(1.2, s * 0.055);
    const lEye = <circle cx={s * 0.36} cy={eyeY} r={eyeR} fill={stroke}/>;
    const rEye = <circle cx={s * 0.64} cy={eyeY} r={eyeR} fill={stroke}/>;
    switch (p.name) {
      case 'happy': return <>{lEye}{rEye}<path d={`M ${s*0.34} ${mouthY} Q ${s*0.5} ${s*0.76}, ${s*0.66} ${mouthY}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"/></>;
      case 'wink': return <><path d={`M ${s*0.30} ${eyeY} L ${s*0.42} ${eyeY}`} stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>{rEye}<path d={`M ${s*0.36} ${mouthY} Q ${s*0.5} ${s*0.74}, ${s*0.64} ${mouthY}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"/></>;
      case 'cool': return <><rect x={s*0.24} y={s*0.36} width={s*0.22} height={s*0.14} rx={s*0.04} fill={stroke}/><rect x={s*0.54} y={s*0.36} width={s*0.22} height={s*0.14} rx={s*0.04} fill={stroke}/><path d={`M ${s*0.38} ${mouthY+s*0.04} L ${s*0.62} ${mouthY+s*0.04}`} stroke={stroke} strokeWidth={sw} strokeLinecap="round"/></>;
      case 'chill': return <><path d={`M ${s*0.30} ${eyeY} Q ${s*0.36} ${eyeY-s*0.06}, ${s*0.42} ${eyeY}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"/><path d={`M ${s*0.58} ${eyeY} Q ${s*0.64} ${eyeY-s*0.06}, ${s*0.70} ${eyeY}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"/><path d={`M ${s*0.40} ${mouthY+s*0.02} Q ${s*0.5} ${mouthY+s*0.10}, ${s*0.60} ${mouthY+s*0.02}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"/></>;
      case 'excited': return <>{lEye}{rEye}<ellipse cx={s*0.5} cy={mouthY+s*0.06} rx={s*0.12} ry={s*0.10} fill={stroke}/></>;
      case 'love': return <><path d={`M ${s*0.30} ${eyeY} Q ${s*0.36} ${eyeY+s*0.08}, ${s*0.42} ${eyeY} Q ${s*0.36} ${eyeY-s*0.04}, ${s*0.30} ${eyeY}`} fill={stroke}/><path d={`M ${s*0.58} ${eyeY} Q ${s*0.64} ${eyeY+s*0.08}, ${s*0.70} ${eyeY} Q ${s*0.64} ${eyeY-s*0.04}, ${s*0.58} ${eyeY}`} fill={stroke}/><path d={`M ${s*0.36} ${mouthY} Q ${s*0.5} ${s*0.76}, ${s*0.64} ${mouthY}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"/></>;
      case 'surprise': return <>{lEye}{rEye}<circle cx={s*0.5} cy={mouthY+s*0.06} r={s*0.09} fill={stroke}/></>;
      case 'smile': return <>{lEye}{rEye}<path d={`M ${s*0.36} ${mouthY+s*0.02} Q ${s*0.5} ${s*0.72}, ${s*0.64} ${mouthY+s*0.02}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"/></>;
      case 'playful': return <>{lEye}{rEye}<path d={`M ${s*0.36} ${mouthY} Q ${s*0.5} ${s*0.76}, ${s*0.64} ${mouthY}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"/><path d={`M ${s*0.50} ${s*0.70} L ${s*0.50} ${s*0.80}`} stroke="#FF4D8D" strokeWidth={sw*1.4} strokeLinecap="round"/></>;
      case 'sleepy': return <><path d={`M ${s*0.30} ${eyeY} L ${s*0.42} ${eyeY}`} stroke={stroke} strokeWidth={sw} strokeLinecap="round"/><path d={`M ${s*0.58} ${eyeY} L ${s*0.70} ${eyeY}`} stroke={stroke} strokeWidth={sw} strokeLinecap="round"/><ellipse cx={s*0.5} cy={mouthY+s*0.06} rx={s*0.06} ry={s*0.04} fill="none" stroke={stroke} strokeWidth={sw*0.8}/></>;
      default: return null;
    }
  };
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ flexShrink: 0, display: 'block' }}>
      <circle cx={s/2} cy={s/2} r={s/2} fill={p.bg}/>
      <circle cx={s/2} cy={s/2} r={s/2 - 1} fill="none" stroke={p.skin} strokeWidth="1.2" opacity="0.5"/>
      {renderFace()}
    </svg>
  );
}

// ── Recent search label formatter ─────────────────────────────
function formatRecentLabel(stations) {
  if (!stations || stations.length === 0) return '';
  if (stations.length <= 3) return stations.join(' + ');
  return stations.slice(0, 3).join(' + ') + ' + ...';
}

// ── Home screen ───────────────────────────────────────────────
function HomeScreen({ spots, setSpots, onSearch, focused, setFocused, timeSetting, setTimeSetting, recentSearches, onRecentClick }) {
  const addSpot = () => {
    if (spots.length >= 10) return;
    setSpots([...spots, { id: Date.now(), value: '', coord: null }]);
    setTimeout(() => setFocused(spots.length), 50);
  };
  const removeSpot = (id) => {
    if (spots.length <= 2) return;
    setSpots(spots.filter(s => s.id !== id));
  };
  const updateSpot = (id, patch) => {
    setSpots(spots.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const filledCount = spots.filter(s => s.value.trim()).length;
  const canSearch = filledCount >= 2;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: T.bg, fontFamily: 'Pretendard', paddingTop: 54,
    }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 120 }}>
        {/* Header */}
        <div style={{ padding: '14px 24px 20px', textAlign: 'center' }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: T.ink, margin: 0,
            letterSpacing: -1.0, lineHeight: 1.2,
          }}>
            <span style={{ color: T.primary }}>딱중간</span>, 어디서 만날까?
          </h1>
          <p style={{
            margin: '10px 0 0', fontSize: 14, color: T.ink2,
            letterSpacing: -0.3, lineHeight: 1.5,
          }}>출발지 2~10곳을 입력하면<br/>모두에게 공평한 중간지점을 찾아드려요.</p>
        </div>

        {/* Input cards */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {spots.map((spot, i) => (
            <InputCard
              key={spot.id}
              index={i}
              spot={spot}
              focused={focused === i}
              onFocus={() => setFocused(i)}
              onBlur={() => setFocused(null)}
              onChange={(v, coord) => updateSpot(spot.id, { value: v, coord: coord || null })}
              onRemove={spots.length > 2 ? () => removeSpot(spot.id) : null}
            />
          ))}

          {spots.length < 10 && (
            <button onClick={addSpot} style={{
              marginTop: 2, height: 54, borderRadius: 16,
              border: `1.5px dashed ${T.primary}40`,
              background: 'transparent', color: T.primary,
              fontSize: 15, fontWeight: 600, letterSpacing: -0.3,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {Icon.plus(T.primary)}
              <span>출발지 추가 ({spots.length}/10)</span>
            </button>
          )}
        </div>

        {/* Time setting */}
        <div style={{ padding: '16px 20px 0' }}>
          <TimePicker value={timeSetting} onChange={setTimeSetting}/>
        </div>

        {/* Recent searches */}
        <div style={{ padding: '24px 24px 0' }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: T.ink3,
            marginBottom: 10, letterSpacing: -0.2,
          }}>최근 검색</div>
          {recentSearches.length === 0 ? (
            <div style={{ padding: '10px 0' }}>
              <span style={{ fontSize: 13, color: T.ink3, fontWeight: 500, letterSpacing: -0.2 }}>
                딱중간을 찾아보세요
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recentSearches.slice(0, 3).map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onRecentClick && onRecentClick(item)}
                  style={{
                    padding: '8px 12px', background: T.card, borderRadius: 999,
                    fontSize: 13, color: T.ink2, fontWeight: 500, letterSpacing: -0.2,
                    border: `1px solid ${T.line}`,
                    display: 'flex', alignItems: 'center', gap: 5,
                    cursor: 'pointer', fontFamily: 'inherit',
                    maxWidth: 210, overflow: 'hidden',
                  }}
                >
                  {Icon.clock(T.ink3)}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatRecentLabel(item)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fixed CTA */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 20px 28px',
        background: `linear-gradient(to top, ${T.bg} 70%, ${T.bg}00)`,
      }}>
        <button
          onClick={canSearch ? onSearch : undefined}
          disabled={!canSearch}
          style={{
            width: '100%', height: 56, borderRadius: 100,
            background: canSearch ? T.primary : '#D1D6DB',
            color: '#fff', border: 'none',
            fontSize: 17, fontWeight: 700, letterSpacing: -0.4,
            fontFamily: 'inherit',
            cursor: canSearch ? 'pointer' : 'not-allowed',
            boxShadow: canSearch ? '0 6px 16px rgba(49,130,246,0.25)' : 'none',
          }}
        >
          {canSearch ? '딱 맞는 중간 지점 찾기' : `출발지를 ${2 - filledCount}곳 더 입력해주세요`}
        </button>
      </div>
    </div>
  );
}

// ── Time picker ───────────────────────────────────────────────
function TimePicker({ value, onChange }) {
  const toggle = () => onChange({ ...value, useNow: !value.useNow });
  const fmt = (d) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const days = ['일','월','화','수','목','금','토'];
    return `${mm}월 ${dd}일 (${days[d.getDay()]})`;
  };
  return (
    <div style={{ background: T.card, borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>현재 시간 기준</div>
          <div style={{ fontSize: 12, color: T.ink3, marginTop: 2, letterSpacing: -0.2 }}>
            {value.useNow ? '지금 출발 기준으로 계산해요' : '선택한 시간으로 계산해요'}
          </div>
        </div>
        <button onClick={toggle} style={{
          marginLeft: 'auto', width: 50, height: 30, borderRadius: 999,
          background: value.useNow ? T.primary : '#D1D6DB',
          border: 'none', cursor: 'pointer', padding: 0, position: 'relative', transition: 'background 0.2s',
        }}>
          <div style={{
            position: 'absolute', top: 3, left: value.useNow ? 23 : 3,
            width: 24, height: 24, borderRadius: 999, background: '#fff',
            transition: 'left 0.2s cubic-bezier(.2,.8,.2,1)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          }}/>
        </button>
      </div>
      {!value.useNow && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}`, display: 'flex', gap: 8, animation: 'fadeIn 0.25s ease' }}>
          <DateField label="날짜" display={fmt(new Date(value.date))} value={value.date} type="date" onChange={(v) => onChange({ ...value, date: v })}/>
          <DateField label="시간" display={value.time} value={value.time} type="time" onChange={(v) => onChange({ ...value, time: v })}/>
        </div>
      )}
    </div>
  );
}

function DateField({ label, display, value, type, onChange }) {
  return (
    <label style={{ flex: 1, background: T.accent, borderRadius: 12, padding: '10px 12px', border: `1px solid ${T.line}`, cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.ink3, letterSpacing: -0.2 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: -0.3 }}>
        {display} {Icon.chevronDown(T.ink2)}
      </span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', border: 'none' }}/>
    </label>
  );
}

// ── Input card — 카카오 자동완성 ─────────────────────────────
function InputCard({ index, spot, focused, onFocus, onBlur, onChange, onRemove }) {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const value = spot.value || '';

  // 카카오 API 자동완성 (디바운스 300ms)
  useEffect(() => {
    if (!focused || !value.trim()) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await searchKakaoStation(value);
      setSuggestions(results);
      setLoading(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [value, focused]);

  const selectStation = (s) => {
    onChange(s.name, { x: s.x, y: s.y, name: s.name, line: s.line, color: s.color });
    setSuggestions([]);
    setSuggestOpen(false);
  };

  const selectedStation = spot.coord ? { line: spot.coord.line, color: spot.coord.color } : null;

  return (
    <div style={{
      background: T.card, borderRadius: 16, padding: '14px 14px',
      border: focused ? `2px solid ${T.primary}` : '2px solid transparent',
      boxShadow: focused
        ? `0 0 0 4px ${T.primary}15, 0 4px 14px rgba(49,130,246,0.12)`
        : '0 1px 3px rgba(0,0,0,0.03)',
      transition: 'all 0.18s cubic-bezier(.2,.8,.2,1)',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {selectedStation
          ? Icon.subway(selectedStation.color, selectedStation.line)
          : <FaceIcon index={index} size={32}/>
        }

        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value, null)}
            onFocus={() => { onFocus(); setSuggestOpen(true); }}
            onBlur={() => { setTimeout(() => { setSuggestOpen(false); setSuggestions([]); }, 180); onBlur(); }}
            placeholder={`${index + 1}번째 출발지 (지하철역)`}
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontSize: 16, fontWeight: 600, color: T.ink,
              fontFamily: 'inherit', letterSpacing: -0.4, background: 'transparent',
            }}
          />
        </div>

        {loading && (
          <div style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${T.primary}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', flexShrink: 0 }}/>
        )}

        {value ? (
          <button onClick={() => { onChange('', null); setSuggestions([]); }} style={{
            width: 20, height: 20, borderRadius: 999, background: T.line,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0,
          }}>
            {Icon.close(T.ink2)}
          </button>
        ) : onRemove && (
          <button onClick={onRemove} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, color: T.ink3, fontWeight: 500, fontFamily: 'inherit',
            padding: '4px 2px', flexShrink: 0,
          }}>삭제</button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {focused && suggestOpen && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20,
          background: '#fff', borderRadius: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
          border: `1px solid ${T.line}`, overflow: 'hidden',
        }}>
          {suggestions.map((s, i) => (
            <div key={s.id || s.name}
              onMouseDown={(e) => { e.preventDefault(); selectStation(s); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                borderBottom: i < suggestions.length - 1 ? `1px solid ${T.line}` : 'none',
                cursor: 'pointer',
              }}>
              {Icon.subway(s.color, s.line || '?')}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, letterSpacing: -0.3 }}>{s.name}</div>
                {s.address && (
                  <div style={{ fontSize: 11, color: T.ink3, marginTop: 1, letterSpacing: -0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.address}
                  </div>
                )}
              </div>
              {s.line && (
                <span style={{ fontSize: 11, color: T.ink3, fontWeight: 600, flexShrink: 0 }}>
                  {s.line.length <= 2 ? s.line + '호선' : s.line}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  HomeScreen, StatusBar, HomeBar, T, Icon, FaceIcon, FACE_PALETTE,
  formatRecentLabel, getStationCoord, getVenueCount, getSubwayRoute,
  getCandidateStations, centroid, distKm, estimateTime, FALLBACK_STATIONS,
  parseLineFromName, getLineColor,
});
