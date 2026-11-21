// Brücke zwischen Dashboard-Seite (window.postMessage) und Hintergrund-Skript der Erweiterung.
// Läuft auf allen localhost-Seiten, reagiert aber nur auf Nachrichten mit source "igdashboard-page".

const VERSION = chrome.runtime.getManifest().version;

function toPage(msg) {
  window.postMessage({ source: 'igdashboard-ext', ...msg }, location.origin);
}

window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.source !== 'igdashboard-page') return;
  const { type } = e.data;
  if (type === 'ping') toPage({ type: 'hello', version: VERSION });
  if (type === 'prepare' || type === 'focus' || type === 'cancel') {
    chrome.runtime.sendMessage(e.data).catch((err) => toPage({ type: 'error', error: String(err) }));
  }
});

// Statusmeldungen aus den Instagram-Tabs an die Seite weiterreichen
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'status') toPage(msg);
});

toPage({ type: 'hello', version: VERSION });
