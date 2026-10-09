// Registers the service worker and shows the update prompt when a new version is waiting.

const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

export async function startPwa() {
  if (!('serviceWorker' in navigator)) return;

  // On a dev machine a cached copy of the app only gets in the way, so it is off
  // unless the address has ?sw. Any earlier registration is removed.
  if (LOCAL && !new URLSearchParams(location.search).has('sw')) {
    for (const reg of await navigator.serviceWorker.getRegistrations()) reg.unregister();
    return;
  }

  const reg = await navigator.serviceWorker.register('sw.js');
  const prompt = document.getElementById('update');
  const offer = () => {
    // A waiting worker with one already in control means a newer version is ready.
    if (reg.waiting && navigator.serviceWorker.controller) prompt.hidden = false;
  };
  offer();
  reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', offer));
  prompt.querySelector('button').addEventListener('click', () => reg.waiting?.postMessage('skip-waiting'));

  // Look for a new version whenever the app comes back to the front.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update(); });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}
