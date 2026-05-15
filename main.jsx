// main.jsx — Shell: responsive layout (폰 외관 제거)

const { useState: useStateM, useEffect: useEffectM } = React;

const RECENT_KEY = 'ddakjunggan_recent';

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}

function saveRecent(searches) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(searches)); }
  catch {}
}

function App() {
  const initial = [
    { id: 1, value: '' },
    { id: 2, value: '' },
  ];
  const [spots, setSpots] = useStateM(initial);
  const [focused, setFocused] = useStateM(null);
  const [screen, setScreen] = useStateM('home');
  const [recentSearches, setRecentSearches] = useStateM(loadRecent);
  const [showNoTrainPopup, setShowNoTrainPopup] = useStateM(false);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const [timeSetting, setTimeSetting] = useStateM({
    useNow: true,
    date: `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  });

  const addToRecent = (filledSpots) => {
    const names = filledSpots.map(s => s.value).filter(Boolean);
    if (names.length < 2) return;
    setRecentSearches(prev => {
      const key = names.join('|');
      const filtered = prev.filter(item => item.join('|') !== key);
      const next = [names, ...filtered].slice(0, 10);
      saveRecent(next);
      return next;
    });
  };

  const onSearch = () => {
    setFocused(null);
    const filledSpots = spots.filter(s => s.value.trim());
    addToRecent(filledSpots);
    setScreen('loading');
    setTimeout(() => setScreen('result'), 1800);
  };

  const onBack = () => setScreen('home');

  const onRetry = () => {
    setScreen('loading');
    setTimeout(() => setScreen('result'), 1400);
  };

  const onRecentClick = (stationNames) => {
    const newSpots = stationNames.map((name, i) => ({ id: Date.now() + i, value: name }));
    while (newSpots.length < 2) {
      newSpots.push({ id: Date.now() + newSpots.length + 99, value: '' });
    }
    setSpots(newSpots);
  };

  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      background: T.bg,
      fontFamily: 'Pretendard, -apple-system, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 화면 스택 */}
      <div style={{ position: 'relative', width: '100%', minHeight: '100vh' }}>

        {/* 홈 화면 */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: screen === 'home' ? 'translateX(0)' : 'translateX(-30%)',
          opacity: screen === 'home' ? 1 : 0,
          transition: 'transform 0.45s cubic-bezier(.2,.8,.2,1), opacity 0.35s ease',
          pointerEvents: screen === 'home' ? 'auto' : 'none',
          minHeight: '100vh',
        }}>
          <HomeScreen
            spots={spots} setSpots={setSpots}
            focused={focused} setFocused={setFocused}
            timeSetting={timeSetting} setTimeSetting={setTimeSetting}
            onSearch={onSearch}
            recentSearches={recentSearches}
            onRecentClick={onRecentClick}
          />
        </div>

        {/* 결과 화면 */}
        {(screen === 'result' || screen === 'loading') && (
          <div style={{
            position: 'absolute', inset: 0,
            transform: screen === 'result' ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.45s cubic-bezier(.2,.8,.2,1)',
            minHeight: '100vh',
          }}>
            <ResultScreen
              spots={spots}
              onBack={onBack}
              phase={screen}
              timeSetting={timeSetting}
              onNoTrain={() => { setScreen('home'); setShowNoTrainPopup(true); }}
            />
          </div>
        )}

        {/* 로딩 오버레이 */}
        {screen === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 80, animation: 'fadeIn 0.2s ease' }}>
            <LoadingScreen/>
          </div>
        )}

        {/* 결과없음 */}
        {screen === 'no-result' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 70, animation: 'fadeIn 0.2s ease' }}>
            <NoResultScreen onRetry={onBack}/>
          </div>
        )}

        {/* API 에러 */}
        {screen === 'api-error' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 70, animation: 'fadeIn 0.2s ease' }}>
            <APIErrorScreen onRetry={onRetry}/>
          </div>
        )}

        <NoTrainPopup
          open={showNoTrainPopup}
          onClose={() => setShowNoTrainPopup(false)}
          onReset={() => { setShowNoTrainPopup(false); setTimeSetting(prev => ({ ...prev, useNow: false })); }}
        />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
