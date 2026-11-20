(() => {
  const measurementId = 'G-46G31FQ518';
  const isProduction = ['www.ddak-middle.com', 'ddak-middle.com'].includes(location.hostname);
  if (!isProduction) {
    window.track = () => {};
    return;
  }

  function cleanUrl(value) {
    if (!value) return '';
    const url = new URL(value);
    return url.origin + url.pathname;
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  const page = {
    page_location: cleanUrl(location.href),
    page_referrer: cleanUrl(document.referrer),
  };
  const params = new URLSearchParams(location.search);
  const campaign = {};
  const campaignFields = {
    utm_source: 'campaign_source',
    utm_medium: 'campaign_medium',
    utm_campaign: 'campaign_name',
  };
  for (const [parameter, field] of Object.entries(campaignFields)) {
    const value = params.get(parameter);
    if (value && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)) campaign[field] = value;
  }
  window.track = (name, params = {}) => gtag('event', name, { ...page, ...params });
  gtag('js', new Date());
  gtag('config', measurementId, {
    ...page,
    ...campaign,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  document.head.appendChild(tag);
})();
