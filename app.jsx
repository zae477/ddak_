// app.jsx — 지하철 중간지점 찾기 (Toss-style)

const { useState } = React;

// ── Tokens ────────────────────────────────────────────────────
const T = {
  bg: '#F4F4F4',
  paper: '#FFFFFF',
  card: '#FFFFFF',
  primary: '#3182F6',
  primarySoft: '#EEF4FF',
  pink: '#FF2D87',
  pinkSoft: '#FFE9F2',
  lime: '#AADC00',
  ink: '#1A1A1A',
  inkSoft: '#3D3935',
  ink2: '#3D3935',
  ink3: '#8A8A8A',
  body: '#5A554E',
  muted: '#8A8A8A',
  mutedSoft: '#B4B4B4',
  line: '#ECECEC',
  hairline: '#ECECEC',
  hairline2: '#D9D9D9',
  info: '#3182F6',
  infoBg: '#EEF4FF',
  accent: '#F7F7F7',
  MONO: "'DM Mono', ui-monospace, SFMono-Regular, monospace",
};

// ── Brand components ──────────────────────────────────────────
function BrandPin({ color = '#FF2D87', mirror = false, size = 48, style: s = {} }) {
  const accent = color.toLowerCase() === '#ff2d87' ? '#AADC00' : '#FF2D87';
  return (
    <svg width={size} height={Math.round(size * 1.1)} viewBox="0 0 60 66"
      style={{ display: 'block', transform: mirror ? 'scaleX(-1)' : 'none', flexShrink: 0, ...s }}
      aria-hidden="true">
      <path d="M 22 60 C 18 50, 10 44, 10 24 C 10 12, 20 4, 32 4 C 44 4, 54 12, 54 24 C 54 42, 42 50, 32 56 L 22 60 Z" fill={color}/>
      <circle cx="34" cy="22" r="5.5" fill="#fff"/>
      <circle cx="34" cy="22" r="2.4" fill={accent}/>
      <path d="M 28 32 Q 34 36 40 32" stroke={accent} strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

const CHAR_VARIANTS = [
  { img: 'assets/char-default.png', hue:   0 },
  { img: 'assets/char-banzai.png',  hue:   0 },
  { img: 'assets/char-wink.png',    hue:  60 },
  { img: 'assets/char-love.png',    hue: 180 },
  { img: 'assets/char-shy.png',     hue: 240 },
  { img: 'assets/char-sleepy.png',  hue: 120 },
  { img: 'assets/char-default.png', hue: 300 },
  { img: 'assets/char-banzai.png',  hue: 200 },
  { img: 'assets/char-wink.png',    hue: 280 },
  { img: 'assets/char-shy.png',     hue:  40 },
];

function StationAvatar({ index = 0, filled = false, lineColor, lineNumber = '?', size = 32 }) {
  if (filled) {
    return (
      <span style={{
        width: size, height: size, borderRadius: '50%',
        background: lineColor || T.ink3,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: Math.round(size * 0.38), fontWeight: 800,
        fontFamily: 'inherit', flexShrink: 0,
      }}>{lineNumber}</span>
    );
  }
  const v = CHAR_VARIANTS[index % CHAR_VARIANTS.length];
  return (
    <span style={{
      width: size, height: size,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <img src={v.img} alt="" style={{
        width: size, height: size, display: 'block',
        filter: v.hue ? `hue-rotate(${v.hue}deg)` : 'none',
      }}/>
    </span>
  );
}

function MonoTag({ children, color, style: s = {} }) {
  return (
    <span style={{
      fontFamily: T.MONO, fontSize: 11, letterSpacing: '0.16em',
      color: color || T.muted, textTransform: 'uppercase',
      fontWeight: 500, whiteSpace: 'nowrap', ...s,
    }}>{children}</span>
  );
}

// ── Station and place data ─────────────────────────────────────
function getLineColor(line) {
  const colors = {
    '1': '#0052A4', '2': '#00A84D', '3': '#EF7C1C', '4': '#00A5DE',
    '5': '#996CAC', '6': '#CD7C2F', '7': '#747F00', '8': '#E6186C',
    '9': '#81754F', '신분당': '#BE0B30', '경의중앙': '#348A6C', '공항': '#377791',
    '수인분당': '#946800', '경춘': '#0C8E72', '우이신설': '#627600', 'GTX-A': '#6200EE',
    '인천1': '#46729E', '경강': '#0054A6', '신림': '#4C7613',
    '용인경전철': '#548000', '김포도시': '#89610E', '서해': '#567317',
  };
  return colors[line] || '#737D89';
}

function stationsFor(query) {
  const item = query.trim();
  if (!item) return [];
  const exact = SubwayGraph.matchStation(item);
  const search = SubwayGraph.normalizeStationName(item);
  if (!search) return [];
  const matches = SubwayGraph.ALL_STATIONS.filter(name => name !== exact && name.includes(search));
  matches.sort((a, b) => Number(!a.startsWith(search)) - Number(!b.startsWith(search)) || a.localeCompare(b, 'ko'));
  return (exact ? [exact, ...matches] : matches).slice(0, 6);
}

async function loadNearbyPlaces(station, signal) {
  const response = await fetch('/api/kakao?_endpoint=nearby&station=' + encodeURIComponent(station), { signal });
  if (!response.ok) throw new Error('nearby search failed');
  return response.json();
}

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
    const bg = rank === 1 ? T.pink : rank === 2 ? '#C4C9D1' : rank === 3 ? '#E8874C' : '#E5E8EB';
    return (
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: bg, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, letterSpacing: -0.3, flexShrink: 0,
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
function HomeScreen({ spots, setSpots, onSearch, focused, setFocused, recentSearches, onRecentClick, notice }) {
  const addSpot = () => {
    if (spots.length >= 10) return;
    setSpots([...spots, { id: Date.now(), value: '' }]);
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
      background: T.paper, fontFamily: 'Pretendard', position: 'relative',
      paddingTop: 'calc(46px + env(safe-area-inset-top, 0px))',
    }}>
      {/* Mini wordmark */}
      <div style={{
        position: 'absolute', top: 'calc(16px + env(safe-area-inset-top, 0px))', left: 20,
        display: 'flex', alignItems: 'center', gap: 6, zIndex: 10,
      }}>
        <img src="assets/char-default.png" alt="" style={{ width: 22, height: 22 }}/>
        <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.04em', color: T.ink, whiteSpace: 'nowrap' }}>딱중간</span>
      </div>

      {/* Mascot */}
      <div style={{
        position: 'absolute', right: 22, top: 'calc(12px + env(safe-area-inset-top, 0px))',
        width: 43, height: 43, transform: 'rotate(-6deg)',
        pointerEvents: 'none', zIndex: 1,
      }}>
        <img src="assets/char-default.png" alt="" style={{ width: '100%', height: '100%' }}/>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 120 }}>
        {/* Hero */}
        <div style={{ padding: '28px 24px 20px', textAlign: 'center' }}>
          <h1 style={{
            fontSize: 27, fontWeight: 800, color: T.ink, margin: 0,
            letterSpacing: '-0.035em', lineHeight: 1.25,
          }}>
            <span style={{ color: T.pink }}>딱중간</span>, 어디서 만날까?
          </h1>
          <p style={{
            margin: '12px 0 0', fontSize: 14, color: T.body,
            letterSpacing: '-0.015em', lineHeight: 1.6, fontWeight: 500,
          }}>
            출발역 2~10곳을 입력하면<br/>지하철 이동이 공평한 만남 장소를 찾아요.
          </p>
        </div>

        {/* Input cards */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {spots.map((spot, i) => (
            <InputCard
              key={spot.id} index={i} spot={spot}
              focused={focused === i}
              onFocus={() => setFocused(i)}
              onBlur={() => setFocused(null)}
              onChange={value => updateSpot(spot.id, { value })}
              onRemove={spots.length > 2 ? () => removeSpot(spot.id) : null}
            />
          ))}

          {spots.length < 10 && (
            <button onClick={addSpot} style={{
              marginTop: 2, height: 54, borderRadius: 14,
              border: `1.5px dashed ${T.pink}`,
              background: 'transparent', color: T.pink,
              fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path d="M7 2v10M2 7h10" stroke={T.pink} strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span style={{ whiteSpace: 'nowrap' }}>
                출발지 추가 <span style={{ color: T.muted, fontWeight: 500 }}>({spots.length}/10)</span>
              </span>
            </button>
          )}
        </div>

        {notice && <p role="alert" style={{ margin: '16px 20px 0', padding: '12px 14px', background: T.pinkSoft, borderRadius: 12, color: T.ink, fontSize: 14 }}>{notice}</p>}
        <p style={{ margin: '16px 20px 0', fontSize: 12, color: T.body, lineHeight: 1.6 }}>
          지원되는 수도권 지하철역의 예상 소요시간을 비교해요. 막차는 출발 전에 확인해 주세요.
        </p>
        <a href="/service-info.html" target="_blank" rel="noopener"
          style={{ display: 'inline-block', margin: '7px 20px 0', fontSize: 12, color: T.body }}>이용 안내 · 개인정보 처리</a>

        {/* Recent searches */}
        {recentSearches.length > 0 && <div style={{ padding: '24px 20px 0' }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: T.inkSoft,
            marginBottom: 10, letterSpacing: '-0.02em',
          }}>최근 검색</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recentSearches.slice(0, 3).map((item, idx) => (
                <button key={idx} onClick={() => onRecentClick && onRecentClick(item)} style={{
                  padding: '8px 14px', background: T.card, borderRadius: 100, border: 'none',
                  fontSize: 12.5, fontWeight: 500, color: T.inkSoft, letterSpacing: '-0.01em',
                  boxShadow: '0 1px 3px rgba(60,40,15,0.05), 0 0 0 1px rgba(60,40,15,0.05)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  cursor: 'pointer', fontFamily: 'inherit',
                  maxWidth: 210, overflow: 'hidden',
                }}>
                  <svg width="13" height="13" viewBox="0 0 14 14">
                    <circle cx="7" cy="7" r="5.5" stroke={T.muted} strokeWidth="1.2" fill="none"/>
                    <path d="M7 4v3l2 1.5" stroke={T.muted} strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatRecentLabel(item)}
                  </span>
                </button>
              ))}
            </div>
        </div>}
      </div>

      {/* Fixed CTA */}
      <div className="bottom-actions" style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingTop: 14, paddingLeft: 20, paddingRight: 20,
        background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 24%)',
      }}>
        <button
          onClick={canSearch ? onSearch : undefined}
          disabled={!canSearch}
          style={{
            width: '100%', height: 56, borderRadius: 14, border: 'none',
            background: canSearch ? T.ink : '#D1D6DB',
            color: canSearch ? '#fff' : T.ink2,
            fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
            fontFamily: 'inherit',
            cursor: canSearch ? 'pointer' : 'not-allowed',
            boxShadow: canSearch ? '0 10px 28px -10px rgba(0,0,0,0.45)' : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {canSearch ? '딱 맞는 중간 지점 찾기' : `출발지를 ${2 - filledCount}곳 더 입력해주세요`}
        </button>
      </div>
    </div>
  );
}

// ── Input card ──────────────────────────────────────────────
function InputCard({ index, spot, focused, onFocus, onBlur, onChange, onRemove }) {
  const [suggestOpen, setSuggestOpen] = useState(true);
  const [active, setActive] = useState(-1);
  const value = spot.value;
  const station = SubwayGraph.matchStation(value);
  const line = station ? SubwayGraph.linesAt(station)[0] : null;
  const suggestions = focused && suggestOpen ? stationsFor(value) : [];
  const listId = 'station-list-' + spot.id;

  const selectStation = name => {
    onChange(name);
    setActive(-1);
    setSuggestOpen(false);
  };

  return (
    <div style={{
      background: T.card, borderRadius: 14, padding: '14px 14px',
      boxShadow: focused
        ? `0 0 0 1.5px ${T.ink}, 0 4px 14px rgba(0,0,0,0.08)`
        : '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.06)',
      transition: 'all 0.18s cubic-bezier(.2,.8,.2,1)',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <StationAvatar
          index={index}
          filled={!!line}
          lineColor={getLineColor(line)}
          lineNumber={line || '?'}
          size={32}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={value}
            role="combobox"
            aria-label={`출발역 ${index + 1}`}
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
            aria-controls={suggestions.length ? listId : undefined}
            aria-activedescendant={active >= 0 && suggestions[active] ? listId + '-' + active : undefined}
            autoComplete="off"
            maxLength={80}
            onChange={(e) => { onChange(e.target.value); setSuggestOpen(true); setActive(-1); }}
            onFocus={() => { onFocus(); setSuggestOpen(true); setActive(-1); }}
            onBlur={onBlur}
            onKeyDown={event => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === 'Escape') { setSuggestOpen(false); return; }
              if (!suggestions.length) return;
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const step = event.key === 'ArrowDown' ? 1 : -1;
                setActive(current => current < 0 && step < 0 ? suggestions.length - 1 : (current + step + suggestions.length) % suggestions.length);
              }
              if (event.key === 'Enter' && active >= 0) selectStation(suggestions[active]);
            }}
            placeholder="역 이름을 입력해 주세요"
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontSize: 16, fontWeight: 600, color: T.ink,
              fontFamily: 'inherit', letterSpacing: -0.4, background: 'transparent',
            }}
          />
        </div>

        {value ? (
          <button aria-label={`출발역 ${index + 1} 입력 지우기`} onClick={() => onChange('')} style={{
            width: 20, height: 20, borderRadius: 999, background: T.line,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0,
          }}>
            {Icon.close(T.ink2)}
          </button>
        ) : null}
        {onRemove && (
          <button aria-label={`출발역 ${index + 1} 삭제`} onClick={onRemove} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, color: T.ink3, fontWeight: 500, fontFamily: 'inherit',
            padding: '4px 2px', flexShrink: 0,
          }}>삭제</button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {suggestions.length > 0 && (
        <div id={listId} role="listbox" aria-label="역 검색 결과" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20,
          background: '#fff', borderRadius: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
          border: `1px solid ${T.line}`, overflow: 'hidden',
        }}>
          {suggestions.map((name, i) => {
            const lines = SubwayGraph.linesAt(name);
            return <div key={name} id={listId + '-' + i} role="option" aria-selected={i === active}
              onPointerDown={event => event.preventDefault()}
              onClick={() => selectStation(name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                borderBottom: i < suggestions.length - 1 ? `1px solid ${T.line}` : 'none',
                cursor: 'pointer', background: i === active ? T.primarySoft : '#fff',
              }}>
              {Icon.subway(getLineColor(lines[0]), lines[0])}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, letterSpacing: -0.3 }}>{name}</div>
              </div>
              <span style={{ fontSize: 11, color: T.body, fontWeight: 600, flexShrink: 0 }}>
                {lines.map(line => /^\d+$/.test(line) ? line + '호선' : line).join(' · ')}
              </span>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { HomeScreen, T, Icon, FaceIcon, FACE_PALETTE, getLineColor });
