// screens.jsx — Loading, Errors, Share sheet, Notices

const { useState: useStateS, useEffect: useEffectS, useRef: useRefS } = React;

// ── Loading screen ────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div role="status" style={{
      height: '100%', background: T.paper, fontFamily: 'Pretendard',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Two pins meeting */}
      <div style={{
        position: 'relative', width: 300, height: 150,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28,
      }}>
        <svg width="300" height="150" viewBox="0 0 300 150"
          style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
          <path d="M 28 85 Q 150 28 272 85"
            stroke={T.hairline2} strokeWidth="1.6"
            strokeDasharray="4 6" fill="none" strokeLinecap="round"/>
        </svg>
        <div style={{ position: 'absolute', top: 52, animation: 'pin-left-in 2.6s ease-in-out infinite' }}>
          <BrandPin color={T.pink} size={60}/>
        </div>
        <div style={{ position: 'absolute', top: 52, animation: 'pin-right-in 2.6s ease-in-out infinite' }}>
          <BrandPin color={T.lime} size={60} mirror={true}/>
        </div>
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 84, height: 84, borderRadius: '50%',
          background: `radial-gradient(circle, ${T.pinkSoft}, transparent 70%)`,
          animation: 'glow-pulse 2.6s ease-in-out infinite',
          pointerEvents: 'none',
        }}/>
      </div>

      <div style={{
        fontWeight: 800, fontSize: 21, lineHeight: 1.2, letterSpacing: '-0.035em',
        color: T.ink, textAlign: 'center', whiteSpace: 'nowrap',
      }}>
        열심히 중간 지점 찾는 중<span style={{ display: 'inline-block', minWidth: 22, textAlign: 'left' }}>
          <span style={{ animation: 'dot1 1.4s steps(1) infinite' }}>.</span>
          <span style={{ animation: 'dot2 1.4s steps(1) infinite' }}>.</span>
          <span style={{ animation: 'dot3 1.4s steps(1) infinite' }}>.</span>
        </span>
      </div>
      <div style={{
        marginTop: 10, fontSize: 13, color: T.muted,
        letterSpacing: '-0.015em', fontWeight: 500, textAlign: 'center',
      }}>
        출발역별 예상 소요시간을 비교하고 있어요.
      </div>

      <style>{`
        @keyframes pin-left-in {
          0%   { left: 16px;  transform: translateY(0) rotate(-8deg); }
          40%  { left: 108px; transform: translateY(-6px) rotate(-2deg); }
          50%  { left: 116px; transform: translateY(0) rotate(0deg); }
          60%  { left: 108px; transform: translateY(-6px) rotate(-2deg); }
          100% { left: 16px;  transform: translateY(0) rotate(-8deg); }
        }
        @keyframes pin-right-in {
          0%   { right: 16px;  transform: translateY(0) rotate(8deg); }
          40%  { right: 108px; transform: translateY(-6px) rotate(2deg); }
          50%  { right: 116px; transform: translateY(0) rotate(0deg); }
          60%  { right: 108px; transform: translateY(-6px) rotate(2deg); }
          100% { right: 16px;  transform: translateY(0) rotate(8deg); }
        }
        @keyframes glow-pulse {
          0%, 35% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          50%     { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          65%     { opacity: 0.6; transform: translate(-50%, -50%) scale(1.1); }
          100%    { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
        }
        @keyframes dot1 { 0%, 24% { opacity: 0; } 25%, 100% { opacity: 1; } }
        @keyframes dot2 { 0%, 49% { opacity: 0; } 50%, 100% { opacity: 1; } }
        @keyframes dot3 { 0%, 74% { opacity: 0; } 75%, 100% { opacity: 1; } }
      `}</style>
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
function APIErrorScreen({ onRetry, onBack }) {
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
        }}>잠시 후 다시 시도해 주세요.</p>
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
        <button onClick={onBack} style={{ width: '100%', marginTop: 8, padding: 12, background: 'transparent', border: 0, color: T.ink, cursor: 'pointer' }}>
          출발역 다시 입력
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
function ShareSheet({ onClose, result, url }) {
  const dialog = useRefS(null);
  const [status, setStatus] = useStateS('');
  const [manualCopy, setManualCopy] = useStateS(false);

  useEffectS(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  const close = () => {
    dialog.current.close();
    onClose();
  };

  const shareKakao = async () => {
    track('share_intent', { method: 'kakaotalk' });
    try {
      await openKakaoShare(url, result.name);
      setStatus('카카오톡 공유 창에서 받을 친구를 선택해 주세요.');
    } catch {
      setStatus('카카오톡을 열지 못했어요. 링크를 복사해서 보낼 수 있어요.');
      track('share_error', { method: 'kakaotalk' });
    }
  };

  const copy = async () => {
    try {
      await copyResultLink(url);
      setManualCopy(false);
      setStatus('링크를 복사했어요.');
      track('share', { method: 'clipboard', content_type: 'station_result' });
    } catch {
      setManualCopy(true);
      setStatus('아래 링크를 길게 눌러 직접 복사해 주세요.');
      track('share_error', { method: 'clipboard' });
    }
  };

  const save = () => {
    try {
      saveResultImage(result);
      setStatus('이미지 다운로드를 요청했어요.');
      track('share_image_download');
    } catch {
      setStatus('이미지를 저장하지 못했어요. 링크로 공유해 주세요.');
      track('share_error', { method: 'image' });
    }
  };

  return (
    <dialog ref={dialog} className="share-dialog" aria-labelledby="share-title"
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => { if (event.target === dialog.current) close(); }}>
      <div style={{ padding: '20px 20px calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h2 id="share-title" style={{ margin: 0, fontSize: 19, color: T.ink }}>친구에게 공유</h2>
          <button aria-label="공유 닫기" onClick={close} style={{ background: T.accent, border: 0, borderRadius: 999, width: 38, height: 38, cursor: 'pointer' }}>
            {Icon.close(T.ink)}
          </button>
        </div>
        <div style={{
          fontSize: 13, color: T.ink3, fontWeight: 500, letterSpacing: -0.2,
          marginBottom: 18,
        }}>{result.name} 추천 결과를 보내요.</div>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'space-around', paddingBottom: 8 }}>
          <ShareOption bg="#FEE500" label="카카오톡" onClick={shareKakao} icon={
            <svg width="28" height="28" viewBox="0 0 28 28">
              <path d="M14 5C8.48 5 4 8.58 4 13c0 2.74 1.72 5.15 4.33 6.55l-.99 3.6c-.1.37.31.67.64.47L12.2 21c.59.08 1.19.12 1.8.12 5.52 0 10-3.58 10-8s-4.48-8-10-8z" fill="#181600"/>
            </svg>
          }/>
          <ShareOption bg="#EDF2FE" label="링크 복사" onClick={copy} icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7L11.5 7" stroke={T.primary} strokeWidth="2" strokeLinecap="round"/>
              <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7L12.5 17" stroke={T.primary} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          }/>
          <ShareOption bg="#F2F4F6" label="이미지 저장" onClick={save} icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke={T.ink} strokeWidth="2"/>
              <circle cx="8.5" cy="10" r="1.5" fill={T.ink}/>
              <path d="M21 15l-5-5-9 9" stroke={T.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }/>
        </div>
        {status && <p role="status" style={{ margin: '12px 0 0', color: T.body, fontSize: 13, lineHeight: 1.5 }}>{status}</p>}
        {manualCopy && <input aria-label="공유 링크" readOnly value={url} onFocus={event => event.target.select()}
          style={{ width: '100%', padding: 10, marginTop: 8, border: `1px solid ${T.hairline2}`, borderRadius: 8 }}/>}
      </div>
    </dialog>
  );
}

function ShareOption({ bg, icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
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
  LoadingScreen, NoResultScreen, APIErrorScreen, PartialFailBanner, ShareSheet,
});
