// Owns the single hidden YouTube Music "player tab". Music only ever plays
// there, so it keeps going when the sidebar closes and Firefox's own media key
// support applies. The sidebar is a remote that talks to it through here.

const HOME = "https://music.youtube.com/";

let playerPort = null;
const pending = new Map(); // request id -> { resolve, reject }
let nextId = 1;

// The tab id is kept in session storage because Firefox may unload this
// background script while music plays.
async function storedPlayerTab() {
  const { playerTabId } = await browser.storage.session.get("playerTabId");
  if (playerTabId == null) return null;
  try {
    return await browser.tabs.get(playerTabId);
  } catch {
    return null; // the tab was closed
  }
}

// Returns the player tab, creating (hidden) the one and only one if needed.
// The sidebar sends several requests at once, so creation is serialised.
let creating = null;
function ensurePlayerTab(url = HOME) {
  creating ??= (async () => {
    const existing = await storedPlayerTab();
    if (existing) return existing;
    const tab = await browser.tabs.create({ url, active: false });
    await browser.storage.session.set({ playerTabId: tab.id });
    await browser.tabs.hide(tab.id);
    return tab;
  })().finally(() => (creating = null));
  return creating;
}

async function waitForPlayerPort() {
  for (let i = 0; i < 60 && !playerPort; i++) await new Promise((r) => setTimeout(r, 250));
  if (!playerPort) throw new Error("The YouTube Music player tab is not ready yet.");
}

// Only these create the player tab. Polling and controls must not, or
// closing the tab would instantly respawn it.
const CREATES_PLAYER = new Set(["getHome", "getPlaylists", "getLibrary", "getCollection", "search", "playableFromPage"]);

// Calls a function of player.js in the player tab and returns its result,
// or null when there is no player tab and this call shouldn't create one.
async function callPlayer(method, args) {
  if (CREATES_PLAYER.has(method)) await ensurePlayerTab();
  else if (!(await storedPlayerTab())) return null;
  await waitForPlayerPort();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    playerPort.postMessage({ id, method, args });
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`${method} timed out`));
    }, 10000);
  });
}

// Loads a song or playlist in the player tab; YouTube Music starts playing it.
async function playUrl(url) {
  const existing = await storedPlayerTab();
  if (existing) await browser.tabs.update(existing.id, { url });
  else await ensurePlayerTab(url);
}

let playerSignedIn = null; // as last reported by the player tab

// The player tab only learns about a sign-in when it reloads, so reload it
// when one of the user's own YouTube Music tabs is signed in and it isn't.
async function onUserTabHello(signedIn) {
  if (!signedIn || playerSignedIn !== false) return;
  const tab = await storedPlayerTab();
  if (tab) await browser.tabs.reload(tab.id);
}

browser.runtime.onConnect.addListener(async (port) => {
  if (port.name !== "ytm-tab") return;
  const { playerTabId } = await browser.storage.session.get("playerTabId");
  if (port.sender.tab?.id !== playerTabId) {
    // One of the user's own YouTube Music tabs: only listen for its sign-in state.
    port.onMessage.addListener((m) => m.type === "hello" && onUserTabHello(m.signedIn));
    return;
  }
  playerPort = port;
  port.onMessage.addListener(({ id, result, error, type, state, signedIn }) => {
    if (type === "hello") return void (playerSignedIn = signedIn);
    if (type === "songChanged") return notifySong(state);
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    error ? request.reject(new Error(error)) : request.resolve(result);
  });
  port.onDisconnect.addListener(() => {
    if (playerPort === port) playerPort = null;
  });
});

// Optional desktop notification when a new song starts (toggle: 🔔 in the sidebar).
async function notifySong(state) {
  const { notify } = await browser.storage.local.get("notify");
  if (!notify) return;
  const options = { type: "basic", title: state.title, message: [state.artist, state.album].filter(Boolean).join(" · ") };
  const icon = browser.runtime.getURL("icons/icon-96.png");
  // The id is fixed so each song replaces the previous notification. If
  // Firefox can't load the artwork, fall back to the extension icon.
  await browser.notifications
    .create("now-playing", { ...options, iconUrl: state.artwork || icon })
    .catch(() => browser.notifications.create("now-playing", { ...options, iconUrl: icon }));
}

browser.tabs.onRemoved.addListener(async (tabId) => {
  const { playerTabId } = await browser.storage.session.get("playerTabId");
  if (tabId !== playerTabId) return;
  playerPort = null;
  await browser.storage.session.remove("playerTabId");
});

// After ↗ shows the player tab, hide it again once the user switches away.
browser.tabs.onActivated.addListener(async ({ previousTabId }) => {
  const { playerTabId } = await browser.storage.session.get("playerTabId");
  if (previousTabId != null && previousTabId === playerTabId) await browser.tabs.hide(previousTabId).catch(() => {});
});

const MESSAGES = {
  call: ({ method, args }) => callPlayer(method, args),
  playPlaylist: ({ id }) => playUrl(`${HOME}watch?list=${encodeURIComponent(id)}`),
  playSong: ({ videoId }) => playUrl(`${HOME}watch?v=${encodeURIComponent(videoId)}`),
  // A song, a song within a list, or a whole list (album, shuffle, radio).
  play: ({ videoId, playlistId }) => {
    const params = new URLSearchParams();
    if (videoId) params.set("v", videoId);
    if (playlistId) params.set("list", playlistId);
    return playUrl(`${HOME}watch?${params}`);
  },
  // After signing in elsewhere: the player tab must reload to see it.
  reloadPlayer: async () => {
    const tab = await storedPlayerTab();
    if (tab) await browser.tabs.reload(tab.id);
  },
  // Shows the player tab, for the full YouTube Music page. It hides itself
  // again when the user switches to another tab (see onActivated above).
  showPlayer: async () => {
    const tab = await ensurePlayerTab();
    await browser.tabs.show(tab.id);
    await browser.tabs.update(tab.id, { active: true });
  },
};

browser.runtime.onMessage.addListener((message) => {
  const handler = MESSAGES[message?.type];
  if (!handler) return undefined;
  return Promise.resolve(handler(message))
    .then((result) => ({ result }))
    .catch((err) => ({ error: String(err?.message || err) }));
});
