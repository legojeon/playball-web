'use strict';
// Change the version whenever any bundled game asset changes.
// Version is synchronized from package.json by the release command.
const CACHE_PREFIX = 'three-outs-shell-';
const CACHE = CACHE_PREFIX + 'v111';
const FILES = ["./", "./index.html", "./style.css", "./rules.js", "./game.js", "./stadium.js", "./pitch.js", "./audio.js", "./pwa.js", "./manifest.webmanifest", "./vendor/three.module.min.js", "./vendor/three.core.min.js", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable.png", "./icons/apple-touch-icon.png", "./audio/bat-hit.mp3", "./audio/glove.mp3", "./feedback.js", "./batting.js", "./input.js", "./swing.js", "./field.js", "./fielding.js", "./trajectory.js", "./aiming.js", "./touch-check.html", "./touch-check.js", "./contact-window.js", "./collision.js", "./stadium-layout.js", "./progress.js", "./audio/crowd-ambience.wav", "./audio/crowd-reaction.mp3"];
FILES.push('./models/athlete.glb','./models/athlete-low.glb','./vendor/loaders/GLTFLoader.js','./vendor/utils/BufferGeometryUtils.js','./athlete.js?v=111','./first-person.js?v=111','./stadium-art.js?v=111','./player-motion.js?v=111','./install.html','./privacy.html','./play.html','./audio/bat-hit.mp3?v=111',...['style.css','rules.js','game.js','stadium.js','pitch.js','batting.js','feedback.js','audio.js','pwa.js','input.js','swing.js','field.js','fielding.js','trajectory.js','aiming.js','touch-check.js','contact-window.js','collision.js','stadium-layout.js','progress.js','music-library.js','music-menu.js','teams.js','tutorial.js','club-ui.js'].map(file=>'./'+file+'?v=111'));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
const URLS = FILES.map(file => new URL(file, self.location.href).href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Refuse redirected authentication responses: only cache the game itself.
    const responses = await Promise.all(URLS.map(async url => {
      const response = await fetch(new Request(url, {cache: 'reload', credentials: 'same-origin'}));
      if (!response.ok || response.redirected || response.type === 'opaque') throw new Error('Game asset unavailable');
      if ((url.endsWith('/') || url.endsWith('/index.html')) && !(await response.clone().text()).includes('id="field"')) throw new Error('Game page unavailable');
      return response;
    }));
    await Promise.all(responses.map((response, i) => cache.put(URLS[i], response)));
    // Keep the current game's version until all its windows close.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const root = new URL('./', self.location.href);
  if (url.origin !== root.origin) return;
  const isGameNavigation = event.request.mode === 'navigate' && [root.pathname, root.pathname + 'index.html', root.pathname + 'play.html'].includes(url.pathname);
  if (!isGameNavigation && !URLS.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(isGameNavigation ? new URL('./index.html', self.location.href).href : url.href);
    return cached || fetch(event.request);
  })());
});
