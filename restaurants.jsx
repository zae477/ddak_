function RestaurantRecommendations({ station, mapQuery }) {
  const [state, setState] = React.useState({ status: 'loading' });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    let active = true;
    const query = new URLSearchParams({ station });
    fetch('/api/restaurants?' + query, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!active) return;
        if (!response.ok) {
          if (['not_configured', 'exit_unavailable'].includes(data.error)) {
            setState({ status: data.error });
            return;
          }
          throw new Error('restaurant search failed');
        }
        setState({ status: 'ready', ...data });
        track('restaurant_results', { result_count: data.restaurants.length });
      })
      .catch(() => { if (active) setState({ status: 'error' }); })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [station, attempt]);

  const mapUrl = 'https://map.kakao.com/?q=' + encodeURIComponent(mapQuery + ' 식당');
  if (state.status === 'loading') {
    return <p className="restaurant-status" role="status">출구에서 식당까지의 도보 시간을 확인하고 있어요.</p>;
  }
  if (state.status !== 'ready') {
    const message = {
      not_configured: '식당 추천을 준비 중이에요.',
      exit_unavailable: '이 역의 출구 위치를 확인하지 못했어요.',
      error: '식당을 불러오지 못했어요.',
    }[state.status];
    return (
      <div className="restaurant-status">
        <p role="status">{message}</p>
        {state.status === 'error' && <button type="button" className="restaurant-retry" onClick={() => {
          setState({ status: 'loading' });
          setAttempt(count => count + 1);
        }}>다시 시도</button>}
        <a href={mapUrl} target="_blank" rel="noopener noreferrer">카카오맵에서 주변 식당 보기</a>
      </div>
    );
  }

  return (
    <div className="restaurant-section">
      <div className="restaurant-section__heading">
        <span>{state.exit} 기준</span>
        <span>{state.restaurants.length > 0 ? '평점순 · ' : ''}{state.restaurants.length}곳</span>
      </div>
      {state.restaurants.length > 0 ? (
        <>
          <ol className="restaurant-carousel" tabIndex={0} aria-label="추천 식당 목록. 가로로 스크롤할 수 있어요.">
            {state.restaurants.map((place, index) => <RestaurantCard key={place.id} place={place} rank={index + 1}/>)}
          </ol>
          <div className="restaurant-section__meta">
            <span className="restaurant-google" translate="no">Google Maps</span>
            <span>도보 시간 TMAP</span>
            <a href="/service-info.html" target="_blank" rel="noopener">이용 안내</a>
          </div>
          {state.partial && <p className="restaurant-status" role="status">도보 시간을 확인한 식당을 보여드려요.</p>}
        </>
      ) : (
        <div className="restaurant-status">
          <p role="status">도보 15분 이내에 조건에 맞는 식당을 찾지 못했어요.</p>
          <a href={mapUrl} target="_blank" rel="noopener noreferrer">카카오맵에서 주변 식당 보기</a>
        </div>
      )}
    </div>
  );
}

function RestaurantCard({ place, rank }) {
  const [imageFailed, setImageFailed] = React.useState(false);
  const photo = imageFailed ? null : place.photo;
  const description = [place.category, place.price].filter(Boolean).join(' · ');

  return (
    <li className="restaurant-card">
      <a href={place.mapUrl} target="_blank" rel="noopener noreferrer" className="restaurant-card__main"
        aria-label={place.name + ' Google Maps에서 보기'}
        onClick={() => track('restaurant_map_click', { rank })}>
        <div className="restaurant-card__photo">
          {photo ? <img src={photo.src} alt={place.name} loading="lazy" decoding="async"
            referrerPolicy="no-referrer" onError={() => setImageFailed(true)}/>
            : <BrandPin color={T.pink} size={36}/>}
        </div>
        <div className="restaurant-card__details">
          <span className="restaurant-card__title">{place.name}</span>
          <span className="restaurant-card__description">{description}</span>
          <span className="restaurant-card__numbers">
            <span aria-label={`평점 ${place.rating.toFixed(1)}점, 리뷰 ${place.reviews}개`}>
              <span aria-hidden="true" className="restaurant-card__star">★ </span>
              <strong>{place.rating.toFixed(1)}</strong> ({place.reviews.toLocaleString('ko-KR')})
            </span>
            <span>도보 {place.walkMinutes}분</span>
          </span>
        </div>
      </a>
      {(photo || place.attributions.length > 0) && (
        <div className="restaurant-card__credits">
          {photo && <a href={photo.source} target="_blank" rel="noopener noreferrer">사진 원본</a>}
          {[...(photo?.credits || []), ...place.attributions].map((credit, index) => {
            const label = <>{credit.avatar && <img src={credit.avatar} alt="" loading="lazy" referrerPolicy="no-referrer"/>}{credit.name}</>;
            return credit.url
              ? <a key={index} href={credit.url} target="_blank" rel="noopener noreferrer">{label}</a>
              : <span key={index}>{label}</span>;
          })}
        </div>
      )}
    </li>
  );
}
