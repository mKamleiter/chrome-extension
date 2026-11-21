// Läuft in jedem instagram.com-Tab, tut aber nur etwas in Tabs, die die Erweiterung selbst geöffnet hat.
// Ablauf: Profil → „Nachricht senden“ klicken (private Profile: über das „···“-Menü; oder direkt /direct/t/<id>)
// → Nachricht ins Feld einfügen.
// Abschicken (Enter) macht Michi selbst; danach meldet das Skript „gesendet“ ans Dashboard.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const MESSAGE_LABELS = ['nachricht senden', 'message', 'send message', 'nachricht'];
const OPTIONS_LABELS = ['optionen', 'options', 'weitere optionen', 'more options'];
const PRIVATE_TEXTS = ['dieses profil ist privat', 'dieses konto ist privat', 'this account is private', 'this profile is private'];

async function waitFor(fn, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const hit = fn();
    if (hit) return hit;
    await sleep(300);
  }
  return null;
}

const visible = (el) => Boolean(el && el.offsetParent !== null);

function composer() {
  const boxes = [...document.querySelectorAll('div[role="textbox"][contenteditable="true"]')].filter(visible);
  return boxes[boxes.length - 1] || null;
}

// Sucht in allen Profilköpfen und im Hauptbereich (Instagram baut die Seite in Etappen auf).
function messageButton() {
  const roots = [...document.querySelectorAll('header'), document.querySelector('main')].filter(Boolean);
  for (const root of roots) {
    const hit = [...root.querySelectorAll('[role="button"], button')].find(
      (el) => visible(el) && MESSAGE_LABELS.includes(norm(el.textContent).toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

// Der „···“-Knopf neben dem Usernamen (svg aria-label „Optionen“).
function optionsButton() {
  const header = document.querySelector('header');
  if (!header) return null;
  const svg = [...header.querySelectorAll('svg[aria-label]')].find((s) =>
    OPTIONS_LABELS.includes(norm(s.getAttribute('aria-label')).toLowerCase()));
  const btn = svg && svg.closest('[role="button"], button');
  return visible(btn) ? btn : null;
}

function isPrivateProfile() {
  const text = norm(document.querySelector('main')?.textContent).toLowerCase();
  return PRIVATE_TEXTS.some((t) => text.includes(t));
}

// Private Profile (denen du nicht folgst) haben keinen Knopf im Profilkopf: „···“ öffnen,
// dort „Nachricht senden“ suchen. Ist es nicht da, Menü wieder schließen.
async function messageViaMenu() {
  const more = optionsButton();
  if (!more) return null;
  more.click();
  const item = await waitFor(() => [...document.querySelectorAll('[role="dialog"] button, [role="dialog"] [role="button"]')]
    .find((el) => visible(el) && MESSAGE_LABELS.includes(norm(el.textContent).toLowerCase())), 5000);
  if (!item) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return item;
}

// Wartet, bis der Profilkopf steht, und liefert den Weg zum Chat: Knopf im Kopf oder Eintrag im „···“-Menü.
async function findMessageAction() {
  const ready = await waitFor(() => messageButton() || optionsButton(), WAIT_BUTTON_MS);
  if (!ready) return null;
  if (messageButton()) return messageButton();
  // Der Kopf wird in Etappen gebaut: bei öffentlichen Profilen kurz auf den Knopf warten, bei privaten nicht
  if (!isPrivateProfile()) {
    const btn = await waitFor(messageButton, 3000);
    if (btn) return btn;
  }
  return messageViaMenu();
}

function onProfileOf(username) {
  const first = decodeURIComponent(location.pathname.split('/')[1] || '').toLowerCase();
  return first === username.toLowerCase();
}

// Lexical (Instagrams Editor) übernimmt Text samt Zeilenumbrüchen am zuverlässigsten als Einfügen-Ereignis.
function insert(box, text) {
  box.focus();
  const dt = new DataTransfer();
  dt.setData('text/plain', text);
  box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}

/* ---------- Hinweisleiste im Tab ---------- */

function banner(item) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'top:12px', 'left:50%', 'transform:translateX(-50%)', 'z-index:2147483647',
    'max-width:min(560px, calc(100vw - 32px))', 'padding:10px 14px', 'border-radius:12px',
    'font:14px/1.4 system-ui,-apple-system,sans-serif', 'box-shadow:0 4px 18px rgba(0,0,0,.25)',
    'display:flex', 'gap:10px', 'align-items:center', 'flex-wrap:wrap', 'color:#fff', 'background:#444',
  ].join(';');
  document.documentElement.appendChild(el);
  const show = (kind, html, withCopy) => {
    el.style.background = { info: '#444', ready: '#2e7d4f', error: '#b3261e', done: '#2e7d4f' }[kind];
    el.innerHTML = `<span style="flex:1;min-width:200px"><strong>igdashboard → @${item.username.replace(/[<>&]/g, '')}</strong><br>${html}</span>`;
    if (withCopy) {
      const b = document.createElement('button');
      b.textContent = 'Text kopieren';
      b.style.cssText = 'font:inherit;padding:5px 12px;border-radius:999px;border:0;cursor:pointer';
      b.onclick = async () => {
        await navigator.clipboard.writeText(item.text).catch(() => {});
        b.textContent = 'Kopiert ✓';
      };
      el.appendChild(b);
    }
    const x = document.createElement('button');
    x.textContent = '×';
    x.title = 'Hinweis ausblenden';
    x.style.cssText = 'font:inherit;background:none;border:0;color:#fff;cursor:pointer;font-size:18px';
    x.onclick = () => el.remove();
    el.appendChild(x);
  };
  return show;
}

/* ---------- Absenden erkennen ---------- */

function watchSend(item, report, show) {
  let pending = null; // Text zum Zeitpunkt von Enter bzw. Klick auf „Senden“
  const grab = () => {
    const box = composer();
    const text = box && box.innerText.trim();
    if (text) pending = text;
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.closest?.('[role="textbox"]')) grab();
  }, true);
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('[aria-label="Senden"], [aria-label="Send"]')) grab();
  }, true);
  const timer = setInterval(() => {
    const box = composer();
    if (pending && box && !norm(box.innerText)) {
      clearInterval(timer);
      report('sent', { text: pending });
      show('done', 'Gesendet ✓ – der Tab schließt sich gleich.');
    }
  }, 400);
}

/* ---------- Ablauf ---------- */

// Hintergrund-Tabs bremst Chrome stark, Instagram braucht dort oft lange. Darum großzügige Wartezeiten und,
// falls es trotzdem scheitert, ein zweiter Versuch, sobald Michi den Tab anschaut.
const WAIT_BUTTON_MS = 60_000;
const WAIT_COMPOSER_MS = 30_000;

async function prepare(item, show) {
  if (!location.pathname.startsWith('/direct/')) {
    if (!onProfileOf(item.username)) {
      throw new Error(`Profil nicht geöffnet (Seite ${location.pathname}). Bist du bei Instagram angemeldet?`);
    }
    const btn = await findMessageAction();
    if (!btn) throw new Error('„Nachricht senden“ weder im Profil noch im „···“-Menü gefunden.');
    show('info', 'Chat wird geöffnet …');
    btn.click();
  }
  const box = await waitFor(composer, WAIT_COMPOSER_MS);
  if (!box) throw new Error('Nachrichtenfeld nicht gefunden.');
  return box;
}

(async () => {
  const job = await chrome.runtime.sendMessage({ type: 'job' }).catch(() => null);
  if (!job?.item) return;
  const { item } = job;
  const show = banner(item);
  const report = (state, extra = {}) => chrome.runtime.sendMessage({ type: 'state', state, ...extra }).catch(() => {});
  show('info', 'Warte auf Instagram …');

  try {
    let box;
    try {
      box = await prepare(item, show);
    } catch (err) {
      if (!document.hidden) throw err;
      show('info', `${err.message} Neuer Versuch, sobald du diesen Tab öffnest …`);
      await new Promise((r) => document.addEventListener('visibilitychange', () => !document.hidden && r(), { once: false }));
      show('info', 'Neuer Versuch …');
      box = await prepare(item, show);
    }
    await sleep(800); // Chatverlauf und Editor fertig laden lassen
    if (norm(box.innerText)) throw new Error('Im Nachrichtenfeld steht schon ein Entwurf, ich überschreibe ihn nicht.');

    insert(box, item.text);
    await sleep(300);
    if (norm(box.innerText) !== norm(item.text)) {
      box.focus();
      document.execCommand('insertText', false, item.text);
      await sleep(300);
    }
    if (norm(box.innerText) !== norm(item.text)) throw new Error('Text ließ sich nicht einfügen.');

    show('ready', 'Nachricht steht im Feld. Prüfen und mit <b>Enter</b> senden.');
    report('ready');
    watchSend(item, report, show);
  } catch (err) {
    show('error', `${err.message} Bitte selbst einfügen.`, true);
    report('error', { error: err.message });
    watchSend(item, report, show); // auch von Hand eingefügte Nachrichten als gesendet erkennen
  }
})();
