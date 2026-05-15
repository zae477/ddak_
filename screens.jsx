// screens.jsx — Loading, Errors, Share sheet, Notices

const { useState: useStateS, useEffect: useEffectS } = React;

// ── Loading screen ────────────────────────────────────────────
const LOADING_MESSAGES = [
  '환승 계산 중...',
  '번화한 곳 탐색 중...',
  '가장 공평한 중간 찾는 중...',
  '지하철 노선 정리 중...',
  '주변 맛집도 살펴보는 중...',
];

function LoadingScreen() {
  const [msgIdx, setMsgIdx] = useStateS(0);
  useEffectS(() => {
    const id = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length), 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      height: '100%', background: T.bg, fontFamily: 'Pretendard',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      paddingTop: 54, textAlign: 'center',
    }}>
      {/* Animated subway track */}
      <div style={{ position: 'relative', width: 240, height: 120, marginBottom: 32 }}>
        <svg width="240" height="120" viewBox="0 0 240 120">
          <path d="M 10 60 Q 60 20, 120 60 T 230 60"
            stroke={T.primarySoft} strokeWidth="4" fill="none" strokeLinecap="round"/>
          {[30, 90, 150, 210].map((x, i) => (
            <circle key={i} cx={x} cy={60 + Math.sin((x-10)/35) * 15} r="5"
              fill="#fff" stroke={T.primary} strokeWidth="2"/>
          ))}
          <g style={{ animation: 'trainMove 2.2s ease-in-out infinite' }}>
            <rect x="-16" y="48" width="32" height="24" rx="6" fill={T.primary}/>
            <circle cx="-8" cy="74" r="3" fill="#2B1F00"/>
            <circle cx="8" cy="74" r="3" fill="#2B1F00"/>
            <rect x="-12" y="53" width="8" height="8" rx="2" fill="#fff" opacity="0.9"/>
            <rect x="4" y="53" width="8" height="8" rx="2" fill="#fff" opacity="0.9"/>
          </g>
        </svg>
      </div>

      <h2 style={{
        margin: 0, fontSize: 20, fontWeight: 800, color: T.ink,
        letterSpacing: -0.6,
      }}>열심히 중간 지점 찾는 중...</h2>
      <div style={{
        marginTop: 10, fontSize: 14, fontWeight: 500, color: T.ink3,
        letterSpacing: -0.2, minHeight: 20,
        animation: 'fadeIn 0.4s ease',
      }} key={msgIdx}>
        {LOADING_MESSAGES[msgIdx]}
      </div>
    </div>
  );
}

// ── No-result error screen ────────────────────────────────────
function NoResultScreen({ onRetry }) {
  return (
    <div style={{
      height: '100%', background: T.bg, fontFamily: 'Pretendard',
      display: 'flex', flexDirection: 'column',
      paddingTop: 54,
    }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 32px', textAlign: 'center',
      }}>
        <div style={{
          width: 120, height: 120, marginBottom: 24, position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 64,
        }}>
          <div style={{ position: 'absolute', left: 8, top: 18, animation: 'rpsSpin 2.5s ease-in-out infinite' }}>✊</div>
          <div style={{ position: 'absolute', right: 8, top: 18, animation: 'rpsSpin 2.5s ease-in-out infinite 0.2s' }}>✋</div>
          <div style={{ position: 'absolute', bottom: 8, animation: 'rpsSpin 2.5s ease-in-out infinite 0.4s' }}>✌️</div>
        </div>

        <h2 style={{
          margin: 0, fontSize: 24, fontWeight: 800, color: T.ink,
          letterSpacing: -0.8, lineHeight: 1.3,
        }}>앗, 딱중간이 없어요</h2>
        <p style={{
          margin: '10px 0 0', fontSize: 15, fontWeight: 500, color: T.ink2,
          letterSpacing: -0.3, lineHeight: 1.5,
        }}>가위바위보해서<br/>지는 사람이 가기~ 🫣</p>
      </div>

      <div style={{ padding: '12px 20px 28px' }}>
        <button onClick={onRetry} style={{
          width: '100%', height: 56, borderRadius: 100,
          background: T.primary, color: '#fff', border: 'none',
          fontSize: 17, fontWeight: 700, letterSpacing: -0.4,
          fontFamily: 'inherit', cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(49,130,246,0.25)',
        }}>
          다시 검색
        </button>
      </div>
    </div>
  );
}

// ── API-error screen ─────────────────────────────────────────
function APIErrorScreen({ onRetry }) {
  return (
    <div style={{
      height: '100%', background: T.bg, fontFamily: 'Pretendard',
      display: 'flex', flexDirection: 'column',
      paddingTop: 54,
    }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 32px', textAlign: 'center',
      }}>
        <div style={{
          width: 112, height: 112, borderRadius: 999,
          background: T.primarySoft, marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 56,
        }}>
          <span style={{ animation: 'wander 3s ease-in-out infinite' }}>🗺️</span>
        </div>

        <h2 style={{
          margin: 0, fontSize: 24, fontWeight: 800, color: T.ink,
          letterSpacing: -0.8, lineHeight: 1.3,
        }}>잠깐, 길을 잃었어요</h2>
        <p style={{
          margin: '10px 0 0', fontSize: 15, fontWeight: 500, color: T.ink2,
          letterSpacing: -0.3, lineHeight: 1.5,
        }}>잠시 후 다시 시도해줘</p>
      </div>

      <div style={{ padding: '12px 20px 28px' }}>
        <button onClick={onRetry} style={{
          width: '100%', height: 56, borderRadius: 100,
          background: T.primary, color: '#fff', border: 'none',
          fontSize: 17, fontWeight: 700, letterSpacing: -0.4,
          fontFamily: 'inherit', cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(49,130,246,0.25)',
        }}>
          재시도
        </button>
      </div>
    </div>
  );
}

// ── No-train popup ────────────────────────────────────────────
function NoTrainPopup({ open, onClose, onReset }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
    }}>
      {/* Scrim */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.5)',
      }}/>
      {/* Popup card */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: '#fff', borderRadius: 24,
        padding: '28px 24px 24px',
        margin: '0 28px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        fontFamily: 'Pretendard',
        animation: 'slideUp 0.3s cubic-bezier(.2,.8,.2,1)',
        width: '100%',
        maxWidth: 320,
      }}>
        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: 999,
          background: '#FFF3CD', margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>
          🚇
        </div>

        <h3 style={{
          margin: '0 0 8px', fontSize: 18, fontWeight: 800,
          color: T.ink, letterSpacing: -0.5, textAlign: 'center', lineHeight: 1.3,
        }}>
          운행하는 지하철이 없어요
        </h3>
        <p style={{
          margin: '0 0 24px', fontSize: 14, fontWeight: 500,
          color: T.ink2, letterSpacing: -0.3, lineHeight: 1.5,
          textAlign: 'center',
        }}>
          시간을 다시 설정해보세요
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onReset} style={{
            width: '100%', height: 50, borderRadius: 100,
            background: T.primary, color: '#fff', border: 'none',
            fontSize: 15, fontWeight: 700, letterSpacing: -0.4,
            fontFamily: 'inherit', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(49,130,246,0.25)',
          }}>
            시간 재설정
          </button>
          <button onClick={onClose} style={{
            width: '100%', height: 46, borderRadius: 100,
            background: T.accent, color: T.ink2, border: `1px solid ${T.line}`,
            fontSize: 14, fontWeight: 600, letterSpacing: -0.3,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline banners (used inside ResultScreen) ─────────────────
function PartialFailBanner({ stationName, onClose }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '12px 14px', borderRadius: 14,
      background: '#FFF7E6', border: '1px solid #FFE1A6',
      marginBottom: 10,
    }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
      <div style={{ flex: 1, fontSize: 13, color: '#7A5A00', fontWeight: 600, letterSpacing: -0.2, lineHeight: 1.45 }}>
        <span style={{ color: '#B8860B' }}>{stationName}</span> 경로를 찾지 못했어요.<br/>
        나머지 출발지로 계산했어요.
      </div>
      <button onClick={onClose} style={{
        width: 20, height: 20, border: 'none', background: 'transparent',
        cursor: 'pointer', padding: 0, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{Icon.close('#B8860B')}</button>
    </div>
  );
}

function RadiusExpandBanner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px', borderRadius: 14,
      background: T.primarySoft,
      marginBottom: 10,
    }}>
      <span style={{ fontSize: 14 }}>📍</span>
      <span style={{
        fontSize: 13, color: T.primary, fontWeight: 600,
        letterSpacing: -0.2, lineHeight: 1.4,
      }}>
        5km 안에 역이 없어서 <b>10km로 넓혀</b>서 찾았어요
      </span>
    </div>
  );
}

// ── Share bottom sheet ────────────────────────────────────────
function ShareSheet({ open, onClose, station }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 150,
      animation: 'fadeIn 0.2s ease',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.45)',
      }}/>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '12px 20px 34px',
        fontFamily: 'Pretendard',
        animation: 'sheetUp 0.3s cubic-bezier(.2,.8,.2,1)',
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 999,
          background: '#D1D6DB', margin: '4px auto 16px',
        }}/>

        <div style={{
          fontSize: 18, fontWeight: 800, color: T.ink,
          letterSpacing: -0.5, marginBottom: 4,
        }}>친구에게 공유</div>
        <div style={{
          fontSize: 13, color: T.ink3, fontWeight: 500, letterSpacing: -0.2,
          marginBottom: 22,
        }}>{station || '서울역'} 추천 결과를 전송해요</div>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'space-around', paddingBottom: 8 }}>
          <ShareOption bg="#FEE500" label="카카오톡" icon={
            <svg width="28" height="28" viewBox="0 0 28 28">
              <path d="M14 5C8.48 5 4 8.58 4 13c0 2.74 1.72 5.15 4.33 6.55l-.99 3.6c-.1.37.31.67.64.47L12.2 21c.59.08 1.19.12 1.8.12 5.52 0 10-3.58 10-8s-4.48-8-10-8z" fill="#181600"/>
            </svg>
          }/>
          <ShareOption bg="#EDF2FE" label="링크 복사" icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7L11.5 7" stroke={T.primary} strokeWidth="2" strokeLinecap="round"/>
              <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7L12.5 17" stroke={T.primary} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          }/>
          <ShareOption bg="#F2F4F6" label="이미지 저장" icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke={T.ink} strokeWidth="2"/>
              <circle cx="8.5" cy="10" r="1.5" fill={T.ink}/>
              <path d="M21 15l-5-5-9 9" stroke={T.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }/>
        </div>
      </div>
    </div>
  );
}

function ShareOption({ bg, icon, label }) {
  return (
    <button style={{
      background: 'transparent', border: 'none', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      fontFamily: 'inherit', padding: 0,
    }}>
      <div style={{
        width: 58, height: 58, borderRadius: 999, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.ink2, letterSpacing: -0.2 }}>{label}</span>
    </button>
  );
}

Object.assign(window, {
  LoadingScreen, NoResultScreen, APIErrorScreen, NoTrainPopup,
  PartialFailBanner, RadiusExpandBanner, ShareSheet,
});
