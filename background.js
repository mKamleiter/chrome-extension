// Öffnet pro Empfänger einen Instagram-Tab und merkt sich, welcher Tab welche Nachricht bekommt.
// Jobs liegen in chrome.storage.session, weil der Service Worker zwischendurch beendet wird.

const KEY = 'jobs'; // { [tabId]: { item, dashboardTabId, state } }

// Mehrere Tabs melden sich gleichzeitig: Lesen-Ändern-Schreiben der Jobs nacheinander ausführen.
let chain = Promise.resolve();
function locked(fn) {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
}

async function jobs() {
  return (await chrome.storage.session.get(KEY))[KEY] || {};
}

async function saveJobs(all) {
  await chrome.storage.session.set({ [KEY]: all });
}

function urlFor(item) {
  return item.thread_id
    ? `https://www.instagram.com/direct/t/${encodeURIComponent(item.thread_id)}/`
    : `https://www.instagram.com/${encodeURIComponent(item.username)}/`;
}

async function report(job, state, extra = {}) {
  job.state = state;
  await chrome.tabs
    .sendMessage(job.dashboardTabId, { type: 'status', pk: job.item.pk, state, ...extra })
    .catch(() => {}); // Dashboard-Tab geschlossen: Status bleibt nur im Instagram-Tab sichtbar
}

async function prepare(items, dashboardTabId) {
  const all = await jobs();
  let first = null;
  for (const item of items) {
    const tab = await chrome.tabs.create({ url: urlFor(item), active: false });
    all[tab.id] = { item, dashboardTabId, state: 'opening' };
    first ??= tab.id;
    await chrome.tabs.sendMessage(dashboardTabId, { type: 'status', pk: item.pk, state: 'opening', tabId: tab.id }).catch(() => {});
  }
  await saveJobs(all);
  if (first) await chrome.tabs.update(first, { active: true });
}

async function nextOpenTab(exceptTabId) {
  const all = await jobs();
  const id = Object.keys(all).find((t) => Number(t) !== exceptTabId && ['opening', 'ready', 'error'].includes(all[t].state));
  return id ? Number(id) : null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  locked(async () => {
    const tabId = sender.tab?.id;
    if (msg.type === 'prepare') {
      await prepare(msg.items || [], tabId);
      return { ok: true };
    }
    if (msg.type === 'focus') {
      const all = await jobs();
      const id = Object.keys(all).find((t) => all[t].item.pk === msg.pk);
      if (id) await chrome.tabs.update(Number(id), { active: true });
      return { ok: Boolean(id) };
    }
    if (msg.type === 'cancel') {
      const all = await jobs();
      for (const [id, job] of Object.entries(all)) {
        if (job.state !== 'sent') await chrome.tabs.remove(Number(id)).catch(() => {});
      }
      return { ok: true };
    }
    // Ab hier: Meldungen aus einem Instagram-Tab
    const all = await jobs();
    const job = all[tabId];
    if (msg.type === 'job') return job && job.state !== 'sent' ? { item: job.item } : null;
    if (!job) return null;
    if (msg.type === 'state') {
      await report(job, msg.state, { error: msg.error || null, text: msg.text || null });
      await saveJobs(all);
      if (msg.state === 'sent') {
        // Erledigten Tab schließen und zum nächsten offenen wechseln
        const next = await nextOpenTab(tabId);
        setTimeout(async () => {
          if (next) await chrome.tabs.update(next, { active: true }).catch(() => {});
          await chrome.tabs.remove(tabId).catch(() => {});
        }, 1500);
      }
      return { ok: true };
    }
    return null;
  }).then(sendResponse, () => sendResponse(null));
  return true; // asynchrone Antwort
});

chrome.tabs.onRemoved.addListener((tabId) => locked(async () => {
  const all = await jobs();
  const job = all[tabId];
  if (!job) return;
  if (job.state !== 'sent') await report(job, 'closed');
  delete all[tabId];
  await saveJobs(all);
}));
