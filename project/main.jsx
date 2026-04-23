// main.jsx — Shell: device frame + screen transitions

const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primaryColor": "#3182F6",
  "bgColor": "#F8F8F8",
  "cardRadius": 16,
  "buttonRadius": 100,
  "showMap": true,
  "scenario": "normal"
}/*EDITMODE-END*/;

// scenario: normal | no-result | api-error | no-train

// localStorage key
const RECENT_KEY = 'ddakjunggan_recent';

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

function saveRecent(searches) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(searches));
  } catch {}
}

function App() {
  const initial = [
    { id: 1, value: '강남역' },
    { id: 2, value: '홍대입구' },
  ];
  const [spots, setSpots] = useStateM(initial);
  const [focused, setFocused] = useStateM(null);
  const [screen, setScreen] = useStateM('home');
  const [tweaks, setTweaks] = useStateM(TWEAK_DEFAULTS);
  const [tweakOpen, setTweakOpen] = useStateM(false);
  const [recentSearches, setRecentSearches] = useStateM(loadRecent);
  const [showNoTrainPopup, setShowNoTrainPopup] = useStateM(false);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const [timeSetting, setTimeSetting] = useStateM({
    useNow: true,
    date: `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  });

  // Apply tweaks to T live
  useEffectM(() => {
    T.primary = tweaks.primaryColor;
    T.bg = tweaks.bgColor;
    T.primarySoft = tweaks.primaryColor + '18';
  }, [tweaks]);

  // Edit mode protocol
  useEffectM(() => {
    const onMsg = (e) => {
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode') setTweakOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweakOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const updateTweak = (key, val) => {
    const next = { ...tweaks, [key]: val };
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, '*');
  };

  // Check if "no-train" scenario should trigger
  const checkNoTrain = () => {
    if (tweaks.scenario === 'no-train') return true;
    // Heuristic: if time is between 01:00~05:00 and useNow=false, simulate no train
    if (!timeSetting.useNow) {
      const [h] = timeSetting.time.split(':').map(Number);
      if (h >= 1 && h <= 4) return true;
    }
    return false;
  };

  const addToRecent = (filledSpots) => {
    const names = filledSpots.map(s => s.value).filter(Boolean);
    if (names.length < 2) return;
    setRecentSearches(prev => {
      // Deduplicate: remove existing entry with same stations
      const key = names.join('|');
      const filtered = prev.filter(item => item.join('|') !== key);
      const next = [names, ...filtered].slice(0, 10); // keep up to 10
      saveRecent(next);
      return next;
    });
  };

  const onSearch = () => {
    setFocused(null);

    // No-train check
    if (checkNoTrain()) {
      setShowNoTrainPopup(true);
      return;
    }

    const filledSpots = spots.filter(s => s.value.trim());
    addToRecent(filledSpots);

    setScreen('loading');
    const target =
      tweaks.scenario === 'no-result' ? 'no-result' :
      tweaks.scenario === 'api-error' ? 'api-error' :
      'result';
    setTimeout(() => setScreen(target), 1800);
  };

  const onBack = () => setScreen('home');

  const onRetry = () => {
    setScreen('loading');
    setTimeout(() => setScreen('result'), 1400);
  };

  const onRecentClick = (stationNames) => {
    // Restore spots from recent search
    const newSpots = stationNames.map((name, i) => ({
      id: Date.now() + i,
      value: name,
    }));
    // Pad to at least 2
    while (newSpots.length < 2) {
      newSpots.push({ id: Date.now() + newSpots.length + 99, value: '' });
    }
    setSpots(newSpots);
  };

  const onNoTrainReset = () => {
    setShowNoTrainPopup(false);
    setTimeSetting(prev => ({ ...prev, useNow: false }));
  };

  // Device container (scaled to viewport)
  const W = 390, H = 844;
  const [scale, setScale] = useStateM(1);
  useEffectM(() => {
    const compute = () => {
      const pad = 24;
      const s = Math.min(
        (window.innerWidth - pad * 2) / (W + 22),
        (window.innerHeight - pad * 2) / (H + 22),
        1
      );
      setScale(Math.max(0.2, s));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: '#EEF0F3',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Pretendard, -apple-system, system-ui, sans-serif',
      position: 'relative',
    }}>
      {/* Ambient backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 30% 20%, ${T.primary}10, transparent 50%),
                     radial-gradient(ellipse at 70% 80%, #FF6F6110, transparent 50%),
                     #EEF0F3`,
      }}/>

      {/* Phone frame */}
      <div style={{
        width: W, height: H, borderRadius: 52, overflow: 'hidden', position: 'relative',
        background: tweaks.bgColor,
        boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 10px #1a1a1a, 0 0 0 11px #333',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        flexShrink: 0,
      }}>
        {/* Dynamic island */}
        <div style={{
          position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 35, borderRadius: 24, background: '#000', zIndex: 100,
        }} />

        <StatusBar />

        {/* Screen stack with slide transition */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {/* Home (always mounted to preserve state) */}
          <div style={{
            position: 'absolute', inset: 0,
            transform: screen === 'home' ? 'translateX(0)' : 'translateX(-30%)',
            opacity: screen === 'home' ? 1 : 0,
            transition: 'transform 0.45s cubic-bezier(.2,.8,.2,1), opacity 0.35s ease',
            pointerEvents: screen === 'home' ? 'auto' : 'none',
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

          {/* Result */}
          {(screen === 'result' || screen === 'loading') && (
            <div style={{
              position: 'absolute', inset: 0,
              transform: screen === 'result' ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.45s cubic-bezier(.2,.8,.2,1)',
            }}>
              <ResultScreen
                spots={spots} onBack={onBack} phase={screen}
                timeSetting={timeSetting}
                onNoTrain={() => {
                  setScreen('home');
                  setShowNoTrainPopup(true);
                }}
              />
            </div>
          )}

          {/* Loading overlay — ResultScreen이 자체 로딩을 처리하지만,
              화면 전환 직후 짧은 슬라이드 인 중에도 보여주기 위해 유지 */}
          {screen === 'loading' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 80,
              animation: 'fadeIn 0.2s ease',
            }}>
              <LoadingScreen/>
            </div>
          )}

          {/* No-result error */}
          {screen === 'no-result' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 70,
              animation: 'fadeIn 0.2s ease',
            }}>
              <NoResultScreen onRetry={onBack}/>
            </div>
          )}

          {/* API error */}
          {screen === 'api-error' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 70,
              animation: 'fadeIn 0.2s ease',
            }}>
              <APIErrorScreen onRetry={onRetry}/>
            </div>
          )}

          {/* No-train popup — shown over home screen */}
          <NoTrainPopup
            open={showNoTrainPopup}
            onClose={() => setShowNoTrainPopup(false)}
            onReset={onNoTrainReset}
          />
        </div>

        <HomeBar />
      </div>

      {/* Tweaks panel */}
      {tweakOpen && (
        <TweaksPanel tweaks={tweaks} update={updateTweak} onClose={() => setTweakOpen(false)} />
      )}
    </div>
  );
}

function TweaksPanel({ tweaks, update, onClose }) {
  const colors = ['#3182F6', '#191F28', '#FF6F61', '#8E7CFF', '#00C4A7', '#FF9500'];
  const scenarios = ['normal', 'no-result', 'api-error', 'no-train'];
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, width: 280, zIndex: 200,
      background: '#fff', borderRadius: 18, padding: 16,
      boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Pretendard, system-ui',
      border: '1px solid #E5E8EB',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#191F28', letterSpacing: -0.3 }}>
          Tweaks
        </span>
        <button onClick={onClose} style={{
          marginLeft: 'auto', border: 'none', background: '#F2F4F6',
          width: 24, height: 24, borderRadius: 999, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        }}>{Icon.close('#4E5968')}</button>
      </div>

      <TweakRow label="Primary">
        <div style={{ display: 'flex', gap: 6 }}>
          {colors.map(c => (
            <button key={c} onClick={() => update('primaryColor', c)} style={{
              width: 24, height: 24, borderRadius: 999, background: c,
              border: tweaks.primaryColor === c ? '2px solid #191F28' : '2px solid transparent',
              cursor: 'pointer', padding: 0,
            }}/>
          ))}
        </div>
      </TweakRow>

      <TweakRow label="Background">
        <div style={{ display: 'flex', gap: 6 }}>
          {['#F8F8F8', '#FFFFFF', '#F4F1EC', '#EEF2F7', '#191F28'].map(c => (
            <button key={c} onClick={() => update('bgColor', c)} style={{
              width: 24, height: 24, borderRadius: 999, background: c,
              border: tweaks.bgColor === c ? '2px solid #3182F6' : '1px solid #E5E8EB',
              cursor: 'pointer', padding: 0,
            }}/>
          ))}
        </div>
      </TweakRow>

      <TweakRow label={`Card radius · ${tweaks.cardRadius}px`}>
        <input type="range" min="4" max="28" value={tweaks.cardRadius}
          onChange={(e) => update('cardRadius', +e.target.value)}
          style={{ width: '100%', accentColor: tweaks.primaryColor }}/>
      </TweakRow>

      <TweakRow label={`Button radius · ${tweaks.buttonRadius}px`}>
        <input type="range" min="8" max="100" value={tweaks.buttonRadius}
          onChange={(e) => update('buttonRadius', +e.target.value)}
          style={{ width: '100%', accentColor: tweaks.primaryColor }}/>
      </TweakRow>

      <TweakRow label="Scenario">
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {scenarios.map(s => (
            <button key={s} onClick={() => update('scenario', s)} style={{
              padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              border: tweaks.scenario === s ? `1.5px solid ${tweaks.primaryColor}` : '1.5px solid #E5E8EB',
              background: tweaks.scenario === s ? tweaks.primaryColor + '18' : 'transparent',
              color: tweaks.scenario === s ? tweaks.primaryColor : '#4E5968',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>{s}</button>
          ))}
        </div>
      </TweakRow>
    </div>
  );
}

function TweakRow({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4E5968', marginBottom: 6, letterSpacing: -0.2 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
