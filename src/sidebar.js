// Sidebar remote for the hidden YouTube Music player tab: shows what's
// playing and sends controls, home, playlists, library, queue, lyrics and
// search to it.

const $ = (id) => document.getElementById(id);
const list = $("list");
const status = $("status");
const seek = $("seek");
const volume = $("volume");
const HOST_ACCESS = { origins: ["https://music.youtube.com/*"] };

let view = "playlists";
let listToken = 0; // bumped on every view change so late answers are dropped
let dragging = false; // don't move the sliders while the user drags them
let current = null; // latest player state
let lyricsFor = null; // videoId the lyrics view shows
let librarySection = "albums";
let collectionBack = "playlists"; // view to return to from a playlist/album

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

function el(tag, className, textContent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent != null) node.textContent = textContent;
  return node;
}

// --- Now playing ------------------------------------------------------------

const REPEAT_TITLES = { NONE: "Repeat: off", ALL: "Repeat: all", ONE: "Repeat: one" };

function renderState(state) {
  current = state;
  const has = Boolean(state?.videoId);
  $("title").textContent = has ? state.title : "Nothing playing";
  $("artist").textContent = has ? [state.artist, state.album].filter(Boolean).join(" · ") : "Pick something below";
  $("artwork").hidden = !has || !state.artwork;
  if (has && state.artwork && $("artwork").src !== state.artwork) $("artwork").src = state.artwork;
  $("toggle").textContent = state?.playing ? "⏸" : "▶";
  $("time").textContent = formatTime(state?.time);
  $("duration").textContent = formatTime(state?.duration);
  $("like").classList.toggle("on", state?.like === "LIKE");
  $("dislike").classList.toggle("on", state?.like === "DISLIKE");
  const repeat = state?.repeat ?? "NONE";
  $("repeat").classList.toggle("on", repeat !== "NONE");
  $("repeat").textContent = repeat === "ONE" ? "🔂" : "🔁";
  $("repeat").title = REPEAT_TITLES[repeat] ?? REPEAT_TITLES.NONE;
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
    if (view === "lyrics" && current?.videoId !== lyricsFor) await showLyrics();
  } catch {
    renderState(null); // the player tab is (re)loading
  }
}

// --- Lists ------------------------------------------------------------------

function itemButton({ thumbnail, line1, line2, current: isCurrent }, onClick) {
  const button = el("button", `item${isCurrent ? " current" : ""}`);
  if (thumbnail) {
    const img = el("img");
    img.src = thumbnail;
    img.alt = "";
    button.appendChild(img);
  }
  const lines = el("div", "lines");
  lines.append(el("div", "line1", line1 || ""), el("div", "line2", line2 || ""));
  button.appendChild(lines);
  button.addEventListener("click", onClick);
  return button;
}

// What clicking a home/playlist/library/search entry does.
function openItem(i) {
  if (i.kind === "playlist" || i.kind === "album") return showCollection(i);
  if (i.kind === "artist") return playArtist(i);
  return play({ type: "play", videoId: i.videoId, playlistId: i.playlistId });
}

function entry(i) {
  return itemButton({ thumbnail: i.thumbnail, line1: i.title, line2: i.subtitle }, () => openItem(i));
}

function setView(name) {
  view = name;
  listToken++;
  delete list.dataset.signature;
  list.replaceChildren();
  setStatus("");
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  $("library-sections").hidden = name !== "library";
}

// Fills the list one page at a time, with a "Load more" button while the
// player tab says there are more pages. `render` turns a page into nodes.
async function loadPaged({ method, args, render, loadingText, emptyText }) {
  const token = listToken;
  let continuation = null;
  let count = 0;
  const more = el("button", "more", "Load more");

  async function nextPage() {
    more.remove();
    setStatus(loadingText);
    try {
      const page = await call(method, { ...args, continuation });
      if (token !== listToken) return; // the user switched views meanwhile
      const nodes = render(page);
      count += nodes.length;
      list.append(...nodes);
      continuation = page.continuation;
      if (continuation) list.append(more);
      setStatus(count ? "" : emptyText);
    } catch (err) {
      if (token === listToken) setStatus(err.message);
    }
  }

  more.addEventListener("click", nextPage);
  await nextPage();
}

function showHome() {
  setView("home");
  return loadPaged({
    method: "getHome",
    render: ({ sections }) =>
      sections.flatMap((section) => [el("h3", "section-title", section.title), ...section.items.map(entry)]),
    loadingText: "Loading home…",
    emptyText: "Nothing on your home page.",
  });
}

function showPlaylists() {
  setView("playlists");
  return loadPaged({
    method: "getPlaylists",
    render: ({ items }) => items.map(entry),
    loadingText: "Loading your playlists…",
    emptyText: "No playlists found. Are you signed in to YouTube Music?",
  });
}

function showLibrary(section = librarySection) {
  librarySection = section;
  setView("library");
  document
    .querySelectorAll("#library-sections button")
    .forEach((b) => b.classList.toggle("active", b.dataset.section === section));
  return loadPaged({
    method: "getLibrary",
    args: { section },
    render: ({ items }) => items.map(entry),
    loadingText: `Loading your ${section}…`,
    emptyText: `No ${section} in your library.`,
  });
}

// A playlist or album: a header with Back and Play all, then its songs.
// Clicking a song plays it within that playlist/album.
function showCollection(collection) {
  if (view !== "collection") collectionBack = view;
  setView("collection");
  const head = el("div", "collection-head");
  const back = el("button", null, "←");
  back.title = "Back";
  back.addEventListener("click", () => showView(collectionBack));
  const playAll = el("button", null, "▶ Play all");
  playAll.addEventListener("click", () => play({ type: "play", playlistId: collection.playlistId }));
  head.append(back, el("div", "name", collection.title), playAll);
  list.append(head);
  return loadPaged({
    method: "getCollection",
    args: { browseId: collection.browseId },
    render: ({ items }) =>
      items.map((song) =>
        itemButton({ thumbnail: song.thumbnail, line1: song.title, line2: song.subtitle }, () =>
          play({ type: "play", videoId: song.videoId, playlistId: collection.playlistId ?? song.playlistId }),
        ),
      ),
    loadingText: "Loading songs…",
    emptyText: "No songs in here.",
  });
}

function showResults(query) {
  document.querySelector('#tabs [data-view="results"]').hidden = false;
  setView("results");
  if (!query) return;
  return loadPaged({
    method: "search",
    args: { query },
    render: ({ items }) => items.map(entry),
    loadingText: `Searching “${query}”…`,
    emptyText: "No songs found.",
  });
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
      itemButton({ line1: q.title, line2: q.artist, current: q.current }, () => call("playQueueItem", { index: q.index })),
    ),
  );
  setStatus(queue.length ? "" : "The queue is empty. Play something first.");
}

async function showLyrics() {
  if (view !== "lyrics") setView("lyrics");
  const token = listToken;
  lyricsFor = current?.videoId ?? null;
  list.replaceChildren();
  if (!lyricsFor) return setStatus("Nothing is playing.");
  setStatus("Loading lyrics…");
  try {
    const lyrics = await call("getLyrics", { videoId: lyricsFor });
    if (token !== listToken) return;
    if (!lyrics) return setStatus("No lyrics for this song.");
    const box = el("div", "lyrics", lyrics.text);
    if (lyrics.source) box.append(el("div", "source", lyrics.source));
    list.append(box);
    setStatus("");
  } catch (err) {
    if (token === listToken) setStatus(err.message);
  }
}

const VIEWS = {
  home: showHome,
  playlists: showPlaylists,
  library: () => showLibrary(),
  queue: showQueue,
  lyrics: showLyrics,
  results: () => showResults($("search").value.trim()),
};

function showView(name) {
  return (VIEWS[name] ?? showPlaylists)();
}

// --- Actions ----------------------------------------------------------------

// Starting something new reloads the player tab for a few seconds.
async function play(message) {
  setStatus("Starting…");
  try {
    await send(message);
    setStatus("");
  } catch (err) {
    setStatus(err.message);
  }
}

// Artists have no single song to play; use the shuffle/radio on their page.
async function playArtist(artist) {
  setStatus(`Finding something to play from ${artist.title}…`);
  try {
    const playable = await call("playableFromPage", { browseId: artist.browseId });
    await play({ type: "play", ...playable });
  } catch (err) {
    setStatus(err.message);
  }
}

// YouTube Music's song radio is the playlist "RDAMVM" + the song's id.
function startRadio() {
  if (!current?.videoId) return setStatus("Play a song first.");
  return play({ type: "play", videoId: current.videoId, playlistId: `RDAMVM${current.videoId}` });
}

async function renderNotifyToggle() {
  const { notify } = await browser.storage.local.get("notify");
  $("notify").classList.toggle("on", Boolean(notify));
  $("notify").title = `Notify on song change: ${notify ? "on" : "off"}`;
}

// --- Wiring -----------------------------------------------------------------

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () =>
    call("control", { action: button.dataset.action })
      .then(refresh)
      .catch((err) => setStatus(err.message)),
  );
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
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.querySelectorAll("#library-sections button").forEach((button) => {
  button.addEventListener("click", () => showLibrary(button.dataset.section));
});

$("radio").addEventListener("click", startRadio);

$("notify").addEventListener("click", async () => {
  const { notify } = await browser.storage.local.get("notify");
  await browser.storage.local.set({ notify: !notify });
  renderNotifyToggle();
});

$("show-player").addEventListener("click", () => send({ type: "showPlayer" }));

// Without host access the player script can't run in the YouTube Music tab,
// and Firefox doesn't grant it automatically for MV3 add-ons.
async function start() {
  const granted = await browser.permissions.contains(HOST_ACCESS);
  $("needs-permission").hidden = granted;
  for (const id of ["now-playing", "transport", "search-form", "tabs", "list"]) $(id).hidden = !granted;
  if (!granted) return;
  renderNotifyToggle();
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
