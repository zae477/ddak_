// main.jsx — 화면 전환과 공유 링크 복원
const { useState: useStateM, useEffect: useEffectM } = React;
const RECENT_KEY = 'ddakjunggan_recent';

function loadRecent() {
  try {
    const searches = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(searches) ? searches.filter(parseStationList).slice(0, 10) : [];
  } catch { return []; }
}

function App() {
  const params = new URLSearchParams(location.search);
  const isShareLink = params.has('s') || params.has('from') || params.has('meet');
  const [spots, setSpots] = useStateM([{ id: 1, value: '' }, { id: 2, value: '' }]);
  const [focused, setFocused] = useStateM(null);
  const [screen, setScreen] = useStateM(isShareLink ? 'opening' : 'home');
  const [notice, setNotice] = useStateM('');
  const [search, setSearch] = useStateM(null);
  const [recentSearches, setRecentSearches] = useStateM(loadRecent);

  useEffectM(() => {
    if (screen === 'home') track('home_view');
  }, [screen]);

  useEffectM(() => {
    if (!isShareLink) return;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 5000);
    let active = true;
    loadSharedSearch(params, controller.signal)
      .then(({ spots: sharedSpots, destination, meeting }) => {
        if (!active) return;
        setSpots(sharedSpots);
        const currentDestination = SubwayGraph.matchStation(destination) || destination;
        setSearch({ spots: sharedSpots, destination: currentDestination, meeting, source: 'shared_link' });
        setScreen('result');
        track('shared_link_open', { station_count: sharedSpots.length });
      })
      .catch(() => {
        if (!active) return;
        history.replaceState({}, '', location.pathname);
        setNotice('공유 링크가 만료됐거나 올바르지 않아요. 출발역을 입력해 다시 찾아보세요.');
        setScreen('home');
        track('shared_link_error');
      })
      .finally(() => clearTimeout(deadline));
    return () => {
      active = false;
      clearTimeout(deadline);
      controller.abort();
    };
  }, []);

  const onSearch = () => {
    const filled = spots.filter(spot => spot.value.trim());
    const supported = filled.filter(spot => SubwayGraph.matchStation(spot.value));
    track('search_submit', { station_count: filled.length });
    if (supported.length < 2) {
      track('search_validation_error');
      setNotice('지원되는 수도권 지하철역을 2곳 이상 입력하거나 검색 목록에서 선택해 주세요.');
      return;
    }
    setFocused(null);
    setNotice('');
    const names = supported.map(spot => SubwayGraph.matchStation(spot.value));
    const next = [names, ...recentSearches.filter(item => item.join('|') !== names.join('|'))].slice(0, 10);
    setRecentSearches(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
    setSearch({ spots: filled, destination: null, source: 'search' });
    setScreen('result');
    track('search', { station_count: filled.length });
  };

  const onBack = () => {
    if (isShareLink) history.replaceState({}, '', location.pathname);
    setSearch(null);
    setScreen('home');
  };

  const onRecentClick = names => {
    setNotice('');
    setSpots(parseStationList(names));
  };

  return (
    <main className="app-shell" aria-label="딱중간">
      {screen === 'home' && (
        <HomeScreen
          spots={spots} setSpots={setSpots} focused={focused} setFocused={setFocused}
          onSearch={onSearch} recentSearches={recentSearches} onRecentClick={onRecentClick}
          notice={notice}
        />
      )}
      {screen === 'opening' && <LoadingScreen/>}
      {screen === 'result' && (
        <ResultScreen search={search} onBack={onBack}/>
      )}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
