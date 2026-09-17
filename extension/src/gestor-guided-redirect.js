(() => {
  'use strict';
  try {
    const u = new URL(location.href);
    if (u.searchParams.get('gs_super_analise') !== '1' || u.searchParams.get('gs_source') !== 'gestor') return;

    u.searchParams.delete('gs_super_analise');
    u.searchParams.delete('gs_source');
    const productUrl = u.toString();
    const gestorUrl = new URL('https://shopeeos-real-greskgja.vercel.app/super-analise');
    gestorUrl.searchParams.set('start_url', productUrl);
    gestorUrl.searchParams.set('guided', '1');

    location.replace(gestorUrl.toString());
  } catch (e) {
    console.warn('GS guided redirect', e);
  }
})();
