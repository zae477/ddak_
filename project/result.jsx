// result.jsx — 결과 화면 (실제 API 연동)

const { useState: useState2, useMemo: useMemo2, useRef: useRef2, useEffect: useEffect2 } = React;

// ── 공평도 점수 계산 (PRD 2-2) ────────────────────────────────
const WEIGHT_A = 1.2;  // 편차 페널티 가중치
const WEIGHT_B = 0.8;  // 총합 페널티 가중치

function calcFairScore(times) {
  if (!times || times.length === 0) return 0;
  const mins = times.map(t => t.mins * (t.transfers > 0 ? 1 + t.transfers * 0.5 : 1));
  const maxT = Math.max(...mins);
  const minT = Math.min(...mins);
  const sumT = mins.reduce((a, b) => a + b, 0);
  const normBase = Math.max(sumT, 1);
  const devPenalty = (maxT - minT) * WEIGHT_A;
  const sumPenalty = (sumT / normBase) * 100 * WEIGHT_B * 0.3;
  return Math.max(0, Math.min(100, Math.round(100 - devPenalty - sumPenalty)));
}

// ── 번화함 점수 계산 (PRD 2-3) ────────────────────────────────
function calcVibeScore(venues, allVenues) {
  const raw = (venues.restaurant * 0.4 + venues.cafe * 0.4 + venues.bar * 0.2);
  const maxRaw = Math.max(...allVenues.map(v => v.restaurant * 0.4 + v.cafe * 0.4 + v.bar * 0.2), 1);
  return Math.round((raw / maxRaw) * 100);
}

// ── 최종 점수 (PRD 2-4) ──────────────────────────────────────
function calcFinalScore(fairScore, vibeScore) {
  return Math.round(fairScore * 0.7 + vibeScore * 0.3);
}

// ── 실제 API 기반 결과 계산 ───────────────────────────────────
async function fetchResults(spots, timeSetting) {
  const filled = spots.filter(s => s.value.trim());
  if (filled.length < 2) throw new Error('not enough spots');

  // 1. 좌표 확보 (InputCard에서 coord가 있으면 재사용, 없으면 카카오 검색)
  const coordResults = await Promise.all(
    filled.map(async (s) => {
      if (s.coord && s.coord.x) return { ...s, coord: s.coord };
      const coord = await getStationCoord(s.value);
      return { ...s, coord };
    })
  );

  // 좌표 없는 출발지 필터 (에러 대상)
  const validSpots = coordResults.filter(s => s.coord);
  const failedSpots = coordResults.filter(s => !s.coord).map(s => s.value);

  if (validSpots.length < 2) throw new Error('no-coords');

  // 2. 무게중심 계산
  const center = centroid(validSpots.map(s => s.coord));

  // 3. 후보역 탐색 (5km, 없으면 10km)
  let candidates = await getCandidateStations(center, 5);
  let expanded = false;
  if (!candidates || candidates.length === 0) {
    candidates = await getCandidateStations(center, 10);
    expanded = true;
  } else {
    expanded = candidates.some(c => c.expanded);
  }
  if (!candidates || candidates.length === 0) return { results: [], expanded, failedSpots };

  // 중복 제거 (같은 이름)
  const seen = new Set();
  const uniqueCandidates = candidates.filter(c => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });

  // 4. 각 후보역별 소요시간 계산 (병렬)
  const timeStr = timeSetting.useNow
    ? new Date().toTimeString().slice(0, 5)
    : timeSetting.time;

  const candidateData = await Promise.all(
    uniqueCandidates.slice(0, 12).map(async (cand) => {
      const times = await Promise.all(
        validSpots.map(async (spot, i) => {
          const route = await getSubwayRoute(spot.coord, cand, timeStr);
          return { from: spot.value, idx: i, ...route };
        })
      );
      return { ...cand, times };
    })
  );

  // 5. no-train 체크: 1명이라도 noTrain이면 전체 no-train
  const hasNoTrain = candidateData.some(c => c.times.some(t => t.noTrain));

  // 6. 장소 카운트 (카카오 카테고리) — 병렬
  const venueData = await Promise.all(
    candidateData.map(async (cand) => {
      if (!cand.x || !cand.y) return { restaurant: 0, cafe: 0, bar: 0 };
      const [restaurant, cafe, bar] = await Promise.all([
        getVenueCount(cand.x, cand.y, 'FD6'),
        getVenueCount(cand.x, cand.y, 'CE7'),
        getVenueCount(cand.x, cand.y, 'PO3'),
      ]);
      return { restaurant, cafe, bar };
    })
  );

  // 7. 점수 계산
  const allVenues = venueData;
  const scored = candidateData.map((cand, idx) => {
    const fairScore = calcFairScore(cand.times);
    const vibeScore = calcVibeScore(venueData[idx], allVenues);
    const finalScore = calcFinalScore(fairScore, vibeScore);
    return { ...cand, venues: venueData[idx], fairScore, vibeScore, finalScore };
  });

  // 8. 최종점수 내림차순 정렬, TOP 10
  const sorted = scored
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 10)
    .map((r, idx) => ({ ...r, rank: idx + 1, score: r.fairScore }));

  return { results: sorted, expanded, failedSpots, hasNoTrain };
}

// ── ResultScreen ──────────────────────────────────────────────
function ResultScreen({ spots, onBack, phase, timeSetting, onNoTrain }) {
  const [state, setState] = useState2({ status: 'idle', results: [], expanded: false, failedSpots: [] });
  const [selected, setSelected] = useState2(0);
  const [showAll, setShowAll] = useState2(false);
  const [closedBanners, setClosedBanners] = useState2([]);
  const filled = spots.filter(s => s.value.trim());

  useEffect2(() => {
    if (phase !== 'result') return;
    setState({ status: 'loading', results: [], expanded: false, failedSpots: [] });
    fetchResults(spots, timeSetting)
      .then(({ results, expanded, failedSpots, hasNoTrain }) => {
        if (hasNoTrain) {
          onNoTrain && onNoTrain();
          return;
        }
        if (!results || results.length === 0) {
          setState({ status: 'no-result', results: [], expanded, failedSpots });
        } else {
          setState({ status: 'ok', results, expanded, failedSpots });
          setSelected(0);
        }
      })
      .catch(() => {
        setState({ status: 'api-error', results: [], expanded: false, failedSpots: [] });
      });
  }, [phase]);

  const { status, results, expanded, failedSpots } = state;
  const visibleResults = showAll ? results : results.slice(0, 3);

  if (status === 'loading' || status === 'idle') {
    return <LoadingScreen/>;
  }
  if (status === 'no-result') {
    return <NoResultScreen onRetry={onBack}/>;
  }
  if (status === 'api-error') {
    return <APIErrorScreen onRetry={onBack}/>;
  }

  const pick = results[selected] || results[0];

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: T.bg, fontFamily: 'Pretendard', paddingTop: 54,
    }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px 14px' }}>
        <button onClick={onBack} style={{
          width: 40, height: 40, borderRadius: 999, border: 'none',
          background: 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        }}>{Icon.back(T.ink)}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: T.ink3, fontWeight: 500, marginBottom: 2 }}>
            {filled.length}곳의 중간지점
          </div>
          <div style={{
            fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: -0.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {filled.map(s => s.value).join(' · ')}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 130 }}>
        {/* Map */}
        <div style={{ padding: '0 20px' }}>
          <SubwayMap results={results} selected={selected} spots={filled}/>
        </div>

        {/* Banners */}
        <div style={{ padding: '12px 20px 0' }}>
          {expanded && <RadiusExpandBanner/>}
          {failedSpots.filter(n => !closedBanners.includes(n)).map(name => (
            <PartialFailBanner key={name} stationName={name}
              onClose={() => setClosedBanners(p => [...p, name])}/>
          ))}
        </div>

        {/* Headline */}
        <div style={{ padding: '10px 24px 8px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.primary, marginBottom: 4, letterSpacing: -0.2 }}>
            추천 만남 장소 TOP {results.length}
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.ink, letterSpacing: -0.6, lineHeight: 1.3 }}>
            <span style={{ color: T.primary }}>{pick.name}</span>이<br/>
            가장 공평한 중간이에요
          </h2>
        </div>

        {/* Result cards */}
        <div style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleResults.map((r, i) => (
            <ResultCard key={r.name} r={r} selected={selected === i}
              onClick={() => setSelected(i)} delay={i * 70}/>
          ))}
          {!showAll && results.length > 3 && (
            <button onClick={() => setShowAll(true)} style={{
              marginTop: 4, height: 52, borderRadius: 16,
              background: T.card, border: `1px solid ${T.line}`,
              fontSize: 14, fontWeight: 600, color: T.ink, letterSpacing: -0.2,
              fontFamily: 'inherit', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <span>더보기 ({results.length - 3}곳 더)</span>
              {Icon.chevronDown(T.ink2)}
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '12px 20px 28px',
        background: `linear-gradient(to top, ${T.bg} 70%, ${T.bg}00)`,
        display: 'flex', gap: 8,
      }}>
        <button onClick={onBack} style={{
          height: 56, padding: '0 20px', borderRadius: 100,
          background: T.card, border: `1px solid ${T.line}`, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: 'inherit', letterSpacing: -0.3,
        }}>
          {Icon.refresh(T.ink)}
          <span>다시 검색</span>
        </button>
        <button style={{
          flex: 1, height: 56, borderRadius: 100,
          background: T.primary, color: '#fff', border: 'none',
          fontSize: 16, fontWeight: 700, letterSpacing: -0.4,
          fontFamily: 'inherit', cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(49,130,246,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {Icon.share('#fff')}
          <span>친구에게 공유하기</span>
        </button>
      </div>
    </div>
  );
}

// ── Result card ───────────────────────────────────────────────
function ResultCard({ r, selected, onClick, delay = 0 }) {
  return (
    <div onClick={onClick} style={{
      background: T.card, borderRadius: 16, padding: '18px 18px',
      cursor: 'pointer',
      border: selected ? `2px solid ${T.primary}` : '2px solid transparent',
      boxShadow: selected
        ? `0 0 0 4px ${T.primary}12, 0 6px 18px rgba(49,130,246,0.10)`
        : '0 1px 3px rgba(0,0,0,0.03)',
      transition: 'all 0.2s cubic-bezier(.2,.8,.2,1)',
      animation: `slideUp 0.45s cubic-bezier(.2,.8,.2,1) ${delay}ms both`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {Icon.trophy(r.rank)}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 19, fontWeight: 700, color: T.ink, letterSpacing: -0.5 }}>{r.name}</span>
          {r.line && Icon.subway(r.color || '#8B95A1', r.line)}
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 999,
          background: selected ? T.primarySoft : T.line,
          fontSize: 12, fontWeight: 700, color: selected ? T.primary : T.ink2, letterSpacing: -0.2,
        }}>
          공평도 {r.score}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {r.times.map((t, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 10, background: T.accent,
          }}>
            <FaceIcon index={t.idx} size={22}/>
            <span style={{ fontSize: 13, color: T.ink2, fontWeight: 600, letterSpacing: -0.2 }}>{t.from}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {t.transfers > 0 && (
                <span style={{ fontSize: 11, color: T.ink3, fontWeight: 600 }}>환승 {t.transfers}회</span>
              )}
              <span style={{ fontSize: 14, color: T.ink, fontWeight: 700, letterSpacing: -0.2 }}>{t.mins}분</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 14, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
        <VenueStat emoji="🍽" label="식당" count={r.venues.restaurant}/>
        <VenueStat emoji="☕" label="카페" count={r.venues.cafe}/>
        <VenueStat emoji="🍺" label="주점" count={r.venues.bar}/>
      </div>
    </div>
  );
}

function VenueStat({ emoji, label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 14 }}>{emoji}</span>
      <span style={{ fontSize: 12, color: T.ink3, fontWeight: 500, letterSpacing: -0.2 }}>{label}</span>
      <span style={{ fontSize: 13, color: T.ink, fontWeight: 700, letterSpacing: -0.2 }}>{count}곳</span>
    </div>
  );
}

// ── SVG 노선도 지도 — 중간역 정중앙, 핀치 줌 ────────────────
function SubwayMap({ results, selected, spots }) {
  const containerRef = useRef2(null);
  const [transform, setTransform] = useState2({ scale: 1, tx: 0, ty: 0 });
  const transformRef = useRef2(transform);
  transformRef.current = transform;
  const pinchRef = useRef2(null);
  const MIN_SCALE = 0.5, MAX_SCALE = 4;
  const W = 340, H = 220;

  const n = Math.max(spots.length, 1);
  const originPositions = useMemo2(() =>
    Array.from({ length: n }, (_, i) => {
      const a = (-Math.PI / 2) + (i / n) * Math.PI * 2;
      return { x: 0.5 + Math.cos(a) * 0.38, y: 0.5 + Math.sin(a) * 0.38 * 0.82 };
    }), [n]);

  const pick = results[selected] || results[0];
  const centerX = W / 2, centerY = H / 2;

  useEffect2(() => {
    setTransform({ scale: 1, tx: 0, ty: 0 });
  }, [selected]);

  useEffect2(() => {
    const el = containerRef.current;
    if (!el) return;
    const getCenter = (t1, t2) => ({ x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 });
    const dist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchRef.current = {
          startDist: dist(e.touches[0], e.touches[1]),
          startScale: transformRef.current.scale,
          startCenter: getCenter(e.touches[0], e.touches[1]),
          startTx: transformRef.current.tx,
          startTy: transformRef.current.ty,
        };
      } else if (e.touches.length === 1) {
        pinchRef.current = {
          pan: true,
          startX: e.touches[0].clientX, startY: e.touches[0].clientY,
          startTx: transformRef.current.tx, startTy: transformRef.current.ty,
          startScale: transformRef.current.scale,
        };
      }
    };
    const onTouchMove = (e) => {
      const p = pinchRef.current;
      if (!p) return;
      if (e.touches.length === 2 && !p.pan) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, p.startScale * (d / p.startDist)));
        const rect = el.getBoundingClientRect();
        const center = getCenter(e.touches[0], e.touches[1]);
        const cx = center.x - rect.left, cy = center.y - rect.top;
        const sd = newScale / p.startScale;
        setTransform({ scale: newScale, tx: cx - sd * (cx - p.startTx), ty: cy - sd * (cy - p.startTy) });
      } else if (e.touches.length === 1 && p.pan && p.startScale > 1.05) {
        e.preventDefault();
        setTransform(t => ({ ...t, tx: p.startTx + e.touches[0].clientX - p.startX, ty: p.startTy + e.touches[0].clientY - p.startY }));
      }
    };
    const onTouchEnd = () => { pinchRef.current = null; };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const { scale, tx, ty } = transform;

  return (
    <div ref={containerRef} style={{
      background: T.card, borderRadius: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      overflow: 'hidden', position: 'relative', touchAction: 'none', userSelect: 'none',
    }}>
      <div style={{
        position: 'absolute', top: 10, right: 12, zIndex: 5,
        fontSize: 10, fontWeight: 600, color: T.ink3,
        background: 'rgba(255,255,255,0.85)', borderRadius: 999, padding: '3px 8px',
        pointerEvents: 'none',
      }}>핀치로 확대·축소</div>
      {scale !== 1 && (
        <button onClick={() => setTransform({ scale: 1, tx: 0, ty: 0 })} style={{
          position: 'absolute', bottom: 10, right: 12, zIndex: 5,
          fontSize: 11, fontWeight: 700, color: T.primary,
          background: T.primarySoft, border: 'none', borderRadius: 999,
          padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit',
        }}>초기화</button>
      )}
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#F2F4F6" strokeWidth="1"/>
          </pattern>
          <clipPath id="mapClip"><rect width={W} height={H}/></clipPath>
        </defs>
        <rect width={W} height={H} fill="url(#grid)"/>
        <g clipPath="url(#mapClip)" transform={`translate(${tx},${ty}) scale(${scale})`} style={{ transformOrigin: `${centerX}px ${centerY}px` }}>
          {/* 한강 */}
          <path d={`M 0 ${H*0.62} Q ${W*0.3} ${H*0.56}, ${W*0.55} ${H*0.64} T ${W} ${H*0.6}`}
            stroke="#C7E8F5" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.7"/>
          {/* 노선 */}
          <path d={`M ${W*0.05} ${H*0.35} L ${W*0.95} ${H*0.40}`} stroke="#0052A4" strokeWidth="3" strokeLinecap="round"/>
          <path d={`M ${W*0.1} ${H*0.75} Q ${W*0.5} ${H*0.3}, ${W*0.9} ${H*0.75}`} stroke="#00A84D" strokeWidth="3" fill="none" strokeLinecap="round"/>
          <path d={`M ${W*0.5} ${H*0.05} L ${W*0.5} ${H*0.95}`} stroke="#EF7C1C" strokeWidth="3" strokeLinecap="round"/>
          <path d={`M ${W*0.05} ${H*0.55} L ${W*0.95} ${H*0.5}`} stroke="#996CAC" strokeWidth="3" strokeLinecap="round"/>
          <path d={`M ${W*0.15} ${H*0.2} L ${W*0.85} ${H*0.8}`} stroke="#BE0B30" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
          <path d={`M ${W*0.85} ${H*0.2} L ${W*0.15} ${H*0.8}`} stroke="#747F00" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
          {/* 역 점 */}
          {[{x:W*0.2,y:H*0.36},{x:W*0.4,y:H*0.37},{x:W*0.6,y:H*0.38},{x:W*0.8,y:H*0.39},{x:W*0.25,y:H*0.55},{x:W*0.5,y:H*0.42},{x:W*0.75,y:H*0.51}]
            .map((pt,i) => <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#fff" stroke="#CDD2D8" strokeWidth="1.5"/>)}
          {/* 출발지→중간역 점선 */}
          {spots.map((s, i) => {
            const p = originPositions[i]; if (!p) return null;
            return <line key={`l-${i}`} x1={p.x*W} y1={p.y*H} x2={centerX} y2={centerY}
              stroke={FACE_PALETTE[i%10].skin} strokeWidth="2" strokeDasharray="5 4" opacity="0.6"
              style={{ animation: 'dashFlow 1.4s linear infinite' }}/>;
          })}
          {/* 출발지 마커 */}
          {spots.map((s, i) => {
            const p = originPositions[i]; if (!p) return null;
            const x = p.x*W, y = p.y*H;
            return (
              <g key={`o-${i}`}>
                <circle cx={x} cy={y} r="18" fill="#fff" stroke={FACE_PALETTE[i%10].skin} strokeWidth="2" opacity="0.9"/>
                <g transform={`translate(${x-12},${y-12})`}><FaceIcon index={i} size={24}/></g>
                <text x={x} y={y+28} textAnchor="middle" fontSize="9" fontWeight="700"
                  fill={T.ink2} fontFamily="Pretendard"
                  style={{ paintOrder:'stroke', stroke:'#fff', strokeWidth:3 }}>{s.value}</text>
              </g>
            );
          })}
          {/* 중간역 핀 — 항상 정중앙 */}
          <g>
            <circle cx={centerX} cy={centerY} r="32" fill={T.primary} opacity="0.08" style={{ animation:'pulse 2s ease-in-out infinite' }}/>
            <circle cx={centerX} cy={centerY} r="22" fill={T.primary} opacity="0.15" style={{ animation:'pulse 2s ease-in-out infinite 0.3s' }}/>
            <path d="M 0 -18 C -11 -18, -16 -10, -16 -2 C -16 9, 0 22, 0 22 C 0 22, 16 9, 16 -2 C 16 -10, 11 -18, 0 -18 Z"
              fill={T.primary} transform={`translate(${centerX},${centerY})`}/>
            <circle cx={centerX} cy={centerY-4} r="5.5" fill="#fff"/>
            <rect x={centerX-44} y={centerY+27} width="88" height="22" rx="11" fill={T.ink}/>
            <text x={centerX} y={centerY+42} textAnchor="middle" fontSize="11" fontWeight="700"
              fill="#fff" fontFamily="Pretendard">{pick ? pick.name : ''}</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

Object.assign(window, { ResultScreen });
