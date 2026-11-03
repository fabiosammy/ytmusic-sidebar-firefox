// Sidebar remote for the hidden YouTube Music player tab: shows what's
// playing and sends controls, playlists, queue and search to it.

const $ = (id) => document.getElementById(id);
const list = $("list");
const status = $("status");
const seek = $("seek");
const volume = $("volume");
const HOST_ACCESS = { origins: ["https://music.youtube.com/*"] };

let view = "playlists";
let dragging = false; // don't move the sliders while the user drags them

// Sends a message to the background and unwraps { result } / { error }.
async function send(message) {
  const reply = await browser.runtime.sendMessage(message);
  if (reply?.error) throw new Error(reply.error);
  return reply?.result;
}

const call = (method, args) => send({ type: "call", method, args });

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function setStatus(message) {
  status.textContent = message;
}

// --- Now playing ------------------------------------------------------------

function renderState(state) {
  const has = Boolean(state?.videoId);
  $("title").textContent = has ? state.title : "Nothing playing";
  $("artist").textContent = has ? [state.artist, state.album].filter(Boolean).join(" · ") : "Pick a playlist below";
  $("artwork").hidden = !has || !state.artwork;
  if (has && state.artwork && $("artwork").src !== state.artwork) $("artwork").src = state.artwork;
  $("toggle").textContent = state?.playing ? "⏸" : "▶";
  $("time").textContent = formatTime(state?.time);
  $("duration").textContent = formatTime(state?.duration);
  if (!dragging) {
    seek.max = Math.floor(state?.duration || 0);
    seek.value = Math.floor(state?.time || 0);
    if (has) volume.value = state.volume;
  }
}

async function refresh() {
  try {
    renderState(await call("getState"));
    if (view === "queue") await showQueue();
  } catch {
    renderState(null); // the player tab is (re)loading
  }
}

// --- Lists ------------------------------------------------------------------

function item({ thumbnail, line1, line2, current }, onClick) {
  const button = document.createElement("button");
  button.className = `item${current ? " current" : ""}`;
  if (thumbnail) {
    const img = document.createElement("img");
    img.src = thumbnail;
    img.alt = "";
    button.appendChild(img);
  }
  const lines = document.createElement("div");
  lines.className = "lines";
  for (const [cls, value] of [["line1", line1], ["line2", line2]]) {
    const div = document.createElement("div");
    div.className = cls;
    div.textContent = value || "";
    lines.appendChild(div);
  }
  button.appendChild(lines);
  button.addEventListener("click", onClick);
  return button;
}

function setView(name) {
  view = name;
  delete list.dataset.signature;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  $("library-sections").hidden = name !== "library";
}

let librarySection = "albums";
const LIBRARY_LABELS = { albums: "albums", artists: "artists", songs: "songs" };

async function showLibrary(section = librarySection) {
  librarySection = section;
  setView("library");
  document
    .querySelectorAll("#library-sections button")
    .forEach((b) => b.classList.toggle("active", b.dataset.section === section));
  list.replaceChildren();
  setStatus(`Loading your ${LIBRARY_LABELS[section]}…`);
  try {
    const items = await call("getLibrary", { section });
    if (view !== "library" || librarySection !== section) return; // user moved on meanwhile
    list.replaceChildren(
      ...items.map((i) =>
        item({ thumbnail: i.thumbnail, line1: i.title, line2: i.subtitle }, () => playLibraryItem(i)),
      ),
    );
    setStatus(items.length ? "" : `No ${LIBRARY_LABELS[section]} in your library.`);
  } catch (err) {
    setStatus(`Couldn't load your library: ${err.message}`);
  }
}

// Albums and songs play directly; artists need their page for a shuffle/radio.
async function playLibraryItem(i) {
  if (i.play) return play({ type: "play", ...i.play });
  setStatus(`Finding something to play from ${i.title}…`);
  try {
    const playable = await call("playableFromPage", { browseId: i.browseId });
    await play({ type: "play", ...playable });
  } catch (err) {
    setStatus(err.message);
  }
}

async function showPlaylists() {
  setView("playlists");
  setStatus("Loading your playlists…");
  try {
    const playlists = await call("getPlaylists");
    list.replaceChildren(
      ...playlists.map((p) =>
        item({ thumbnail: p.thumbnail, line1: p.title, line2: p.subtitle }, () => play({ type: "playPlaylist", id: p.id })),
      ),
    );
    setStatus(playlists.length ? "" : "No playlists found. Are you signed in to YouTube Music?");
  } catch (err) {
    setStatus(`Couldn't load playlists: ${err.message}`);
  }
}

async function showQueue() {
  if (view !== "queue") setView("queue");
  const queue = (await call("getQueue")) ?? []; // null: no player tab yet
  // Rebuilding every second would reset scrolling; only redraw on change.
  const signature = JSON.stringify(queue);
  if (list.dataset.signature === signature) return;
  list.dataset.signature = signature;
  list.replaceChildren(
    ...queue.map((q) =>
      item({ line1: q.title, line2: q.artist, current: q.current }, () => call("playQueueItem", { index: q.index })),
    ),
  );
  setStatus(queue.length ? "" : "The queue is empty. Play a playlist or song first.");
}

async function showResults(query) {
  document.querySelector('#tabs [data-view="results"]').hidden = false;
  setView("results");
  if (!query) return;
  setStatus(`Searching “${query}”…`);
  try {
    const songs = await call("search", { query });
    list.replaceChildren(
      ...songs.map((s) =>
        item({ thumbnail: s.thumbnail, line1: s.title, line2: s.artist }, () => play({ type: "playSong", videoId: s.videoId })),
      ),
    );
    setStatus(songs.length ? "" : "No songs found.");
  } catch (err) {
    setStatus(`Search failed: ${err.message}`);
  }
}

// Starting a playlist or song reloads the player tab for a few seconds.
async function play(message) {
  setStatus("Starting…");
  try {
    await send(message);
    setStatus("");
  } catch (err) {
    setStatus(err.message);
  }
}

// --- Wiring -----------------------------------------------------------------

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => call("control", { action: button.dataset.action }).then(refresh));
});

for (const slider of [seek, volume]) {
  slider.addEventListener("pointerdown", () => (dragging = true));
  slider.addEventListener("pointerup", () => (dragging = false));
}
seek.addEventListener("change", () => call("seek", { seconds: Number(seek.value) }));
volume.addEventListener("input", () => call("setVolume", { percent: Number(volume.value) }));

$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  showResults($("search").value.trim());
});

document.querySelectorAll("#tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === "playlists") showPlaylists();
    else if (button.dataset.view === "library") showLibrary();
    else if (button.dataset.view === "queue") showQueue();
    else showResults($("search").value.trim());
  });
});

document.querySelectorAll("#library-sections button").forEach((button) => {
  button.addEventListener("click", () => showLibrary(button.dataset.section));
});

$("show-player").addEventListener("click", () => send({ type: "showPlayer" }));

// Without host access the player script can't run in the YouTube Music tab,
// and Firefox doesn't grant it automatically for MV3 add-ons.
async function start() {
  const granted = await browser.permissions.contains(HOST_ACCESS);
  $("needs-permission").hidden = granted;
  for (const id of ["now-playing", "transport", "search-form", "tabs", "list"]) $(id).hidden = !granted;
  if (!granted) return;
  // Music already loaded (e.g. kept playing while the sidebar was closed):
  // open on the queue; otherwise on the playlists.
  const state = await call("getState").catch(() => null);
  renderState(state);
  if (state?.videoId) await showQueue().catch(() => showPlaylists());
  else showPlaylists();
  setInterval(refresh, 1000);
}

// permissions.request must run directly inside the click handler.
$("grant").addEventListener("click", () => browser.permissions.request(HOST_ACCESS).then(start));

start();
