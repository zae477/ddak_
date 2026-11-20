// result.jsx — 중간역 계산과 결과 화면
const { useState: useState2, useRef: useRef2, useEffect: useEffect2 } = React;
const DEVIATION_WEIGHT = 2;
const TRAVEL_WEIGHT = 0.67;

function calcFairScore(times) {
  const adjusted = times.map(time => time.mins * (1 + 0.5 * time.transfers));
  const people = times.reduce((sum, time) => sum + time.weight, 0);
  const mean = adjusted.reduce((sum, mins, i) => sum + mins * times[i].weight, 0) / people;
  const spread = Math.max(...adjusted) - Math.min(...adjusted);
  const score = 100 - spread * DEVIATION_WEIGHT - Math.max(0, mean - 10) * TRAVEL_WEIGHT;
  return { score: Math.max(0, Math.min(100, Math.round(score))), raw: score, mean };
}

function calculateResults(spots, preferred) {
  const origins = new Map();
  const failedSpots = [];
  const stations = [];
  for (const spot of spots) {
    const name = SubwayGraph.matchStation(spot.value);
    if (!name) {
      failedSpots.push(spot.value);
      continue;
    }
    origins.set(name, (origins.get(name) || 0) + 1);
    stations.push(name);
  }
  if (stations.length < 2) return { results: [], stations, failedSpots };

  const candidates = SubwayGraph.findMiddleStations(stations.map(value => ({ value })));
  const ranked = candidates.map(candidate => {
    const times = candidate.times.map(time => ({
      ...time, people: origins.get(time.from), weight: Math.min(2, origins.get(time.from)),
    }));
    const score = calcFairScore(times);
    return { name: candidate.name, times, ...score };
  }).sort((a, b) => b.raw - a.raw || a.mean - b.mean || a.name.localeCompare(b.name, 'ko'));

  const visible = ranked.slice(0, 10);
  const preferredIndex = ranked.findIndex(candidate => candidate.name === preferred);
  if (preferredIndex >= 10) visible[visible.length - 1] = ranked[preferredIndex];
  const results = visible.map(candidate => ({
    ...candidate,
    rank: ranked.indexOf(candidate) + 1,
    lines: SubwayGraph.linesAt(candidate.name),
  }));
  return { results, stations, failedSpots };
}

function ResultScreen({ search, onBack }) {
  const [attempt, setAttempt] = useState2(0);
  const [state, setState] = useState2(null);
  const [selected, setSelected] = useState2(0);
  const [showAll, setShowAll] = useState2(false);
  const [shareOpen, setShareOpen] = useState2(false);
  const [closedBanners, setClosedBanners] = useState2([]);
  const shareButton = useRef2(null);
  const filled = search.spots;

  useEffect2(() => {
    const timer = setTimeout(() => {
      try {
        const output = calculateResults(filled, search.destination);
        const preferredIndex = output.results.findIndex(item => item.name === search.destination);
        setSelected(Math.max(0, preferredIndex));
        setShowAll(preferredIndex >= 3);
        setState({ status: output.results.length ? 'ok' : 'no-result', ...output });
        track(output.results.length ? 'view_results' : 'search_no_result', {
          station_count: output.stations.length,
          result_count: output.results.length,
          source: search.source,
        });
      } catch (err) {
        console.error('[딱중간] 결과 계산 실패', err);
        setState({ status: 'error' });
        track('search_error', { source: search.source });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [search, attempt]);

  if (!state) return <LoadingScreen/>;
  if (state.status === 'error') {
    return <APIErrorScreen onRetry={() => { setState(null); setAttempt(value => value + 1); }} onBack={onBack}/>;
  }
  if (state.status === 'no-result') return <NoResultScreen onRetry={onBack}/>;

  const { results, failedSpots, stations } = state;
  const visibleResults = showAll ? results : results.slice(0, 3);
  const pick = results[selected] || results[0];
  const destinationUnavailable = search.destination && pick.name !== search.destination && !results.some(r => r.name === search.destination);
  const closeShare = () => {
    setShareOpen(false);
    shareButton.current?.focus();
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: T.bg, fontFamily: 'Pretendard', paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px 14px' }}>
        <button aria-label="출발역 입력으로 돌아가기" onClick={onBack} style={{
          width: 40, height: 40, borderRadius: 999, border: 'none',
          background: 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        }}>{Icon.back(T.ink)}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: T.ink3, fontWeight: 500, marginBottom: 2 }}>
            출발역 {new Set(stations).size}곳 · {stations.length}명
          </div>
          <div style={{
            fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: -0.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {[...new Set(stations)].join(' · ')}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 130 }}>
        <div style={{ padding: '0 20px' }}>
          {destinationUnavailable && <p role="status" style={{ fontSize: 13 }}>공유한 역을 다시 계산할 수 없어 현재 추천 결과를 보여드려요.</p>}
          {[...new Set(failedSpots)].filter(n => !closedBanners.includes(n)).map(name => (
            <PartialFailBanner key={name} stationName={name}
              onClose={() => setClosedBanners(p => [...p, name])}/>
          ))}
        </div>

        {/* Headline */}
        <div style={{ padding: '10px 24px 8px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.pink, marginBottom: 6, letterSpacing: '-0.02em' }}>
            {search.destination && !destinationUnavailable ? '공유받은 추천 결과' : '추천 만남 장소'}
          </div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.ink, letterSpacing: '-0.04em', lineHeight: 1.2 }}>
            딱중간은 <span style={{ color: T.pink }}>{pick.name}</span>
          </h2>
          <p style={{ margin: '10px 0 0', fontSize: 13.5, color: T.body, fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.6 }}>
            이동시간과 환승을 바탕으로 계산한 예상값이에요.<br/>열차 대기시간과 막차는 카카오맵에서 확인해 주세요.
          </p>
        </div>
        <div style={{ padding: '4px 20px 0' }}>
          <NearbyPlaces key={pick.name} station={pick.name}/>
        </div>

        {/* Result cards */}
        <div style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleResults.map((r, i) => (
            <ResultCard key={r.name} r={r} selected={selected === i}
              onClick={() => {
                setSelected(i);
                track('select_station', { rank: r.rank });
              }} delay={i * 70}/>
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
      <div className="bottom-actions" style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingTop: 12, paddingLeft: 20, paddingRight: 20,
        background: `linear-gradient(to top, ${T.bg} 70%, ${T.bg}00)`,
        display: 'flex', gap: 8,
      }}>
        <button onClick={onBack} style={{
          height: 52, padding: '0 14px', borderRadius: 14,
          background: T.card, border: `1px solid ${T.hairline2}`, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: 'inherit', letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
        }}>
          {Icon.refresh(T.ink)}
          <span>다시 검색</span>
        </button>
        <button ref={shareButton} aria-haspopup="dialog" onClick={() => {
          setShareOpen(true);
          track('share_sheet_open', { rank: pick.rank });
        }} style={{
          flex: 1, minWidth: 0, height: 52, borderRadius: 14,
          background: T.ink, color: '#fff', border: 'none',
          fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em',
          fontFamily: 'inherit', cursor: 'pointer',
          boxShadow: '0 10px 28px -10px rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          whiteSpace: 'nowrap',
        }}>
          {Icon.share('#fff')}
          <span>친구에게 공유하기</span>
        </button>
      </div>
      {shareOpen && <ShareSheet onClose={closeShare} result={pick} url={createResultLink(stations, pick.name)}/>}
    </div>
  );
}

// ── Result card ───────────────────────────────────────────────

function ResultCard({ r, selected, onClick, delay = 0 }) {
  return (
    <div role="button" tabIndex={0} aria-pressed={selected} onClick={onClick}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); }
      }} style={{
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
        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 19, fontWeight: 800, color: T.ink, letterSpacing: '-0.035em' }}>{r.name}</span>
          {r.lines.map(line => <React.Fragment key={line}>{Icon.subway(getLineColor(line), line)}</React.Fragment>)}
        </div>
        <span style={{
          fontFamily: T.MONO, fontSize: 11, color: T.info,
          background: T.infoBg, padding: '5px 11px', borderRadius: 100,
          letterSpacing: '0.02em', fontWeight: 500, whiteSpace: 'nowrap',
        }}>공평도 {r.score}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 0 }}>
        {r.times.map((t, i) => {
          const pinColor = i === 0 ? T.pink : i === 1 ? T.lime : T.muted;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
              <BrandPin color={pinColor} size={24} mirror={i % 2 === 1}/>
              <span style={{
                fontSize: 14, color: T.ink, fontWeight: 600, letterSpacing: '-0.025em',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{t.from}{t.people > 1 ? ` · ${t.people}명` : ''}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: T.body, fontWeight: 500 }}>{t.transfers ? `환승 ${t.transfers}회` : '환승 없음'}</span>
                <span style={{ fontSize: 15, color: T.ink, fontWeight: 700, letterSpacing: '-0.02em' }}>{t.mins}분</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

function NearbyPlaces({ station }) {
  const [places, setPlaces] = useState2(null);
  const [failed, setFailed] = useState2(false);
  const [restaurantsOpen, setRestaurantsOpen] = useState2(false);
  const restaurantsId = React.useId();
  useEffect2(() => {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 5000);
    let active = true;
    loadNearbyPlaces(station, controller.signal)
      .then(counts => { if (active) setPlaces(counts); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => clearTimeout(deadline));
    return () => {
      active = false;
      clearTimeout(deadline);
      controller.abort();
    };
  }, [station]);

  const stationName = station.replace(/\(경의중앙\)$/, '');
  const mapQuery = stationName + (stationName.endsWith('역') ? '' : '역')
    + (station.endsWith('(경의중앙)') ? ' 경의중앙선' : '');
  const mapUrl = 'https://map.kakao.com/?q=' + encodeURIComponent(mapQuery);
  const counts = [
    ['음식점', places?.restaurant], ['카페', places?.cafe], ['술집 검색', places?.bar],
  ].filter(([, count]) => Number.isInteger(count));
  return (
    <section aria-label="역 주변 장소" style={{ padding: '14px 16px', background: T.card, borderRadius: 14, fontSize: 13 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong>역 주변 500m</strong>
        <a href={mapUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#195CAF', fontWeight: 700 }}>카카오맵에서 보기</a>
      </div>
      <p role="status" style={{ margin: '8px 0 0', color: T.body, lineHeight: 1.5 }}>
        {counts.length > 0 ? counts.map(([label, count]) => `${label} ${count.toLocaleString('ko-KR')}곳`).join(' · ')
          : failed || places ? '주변 장소 수를 불러오지 못했어요.' : '주변 장소를 확인 중이에요.'}
      </p>
      <button type="button" className="restaurant-toggle" aria-expanded={restaurantsOpen} aria-controls={restaurantsId}
        onClick={() => {
          if (!restaurantsOpen) track('restaurant_panel_open');
          setRestaurantsOpen(!restaurantsOpen);
        }}>
        <strong>식당</strong>
        <span>도보 15분 이내</span>
        <span className="restaurant-toggle__chevron" aria-hidden="true">{Icon.chevronDown(T.body)}</span>
      </button>
      <div id={restaurantsId} hidden={!restaurantsOpen}>
        {restaurantsOpen && <RestaurantRecommendations station={station} mapQuery={mapQuery}/>}
      </div>
    </section>
  );
}

Object.assign(window, { ResultScreen });
