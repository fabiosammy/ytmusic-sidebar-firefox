// Runs in YouTube Music tabs. In the extension's hidden player tab it answers
// the sidebar remote: what's playing, playback controls, queue, home,
// playlists, library, search and lyrics. Other YouTube Music tabs connect too
// but are never asked anything.

// Page objects (the player, ytcfg, mediaSession) live in the page's JS world;
// Firefox content scripts reach them through wrappedJSObject.
const page = window.wrappedJSObject;

function player() {
  return document.getElementById("movie_player")?.wrappedJSObject ?? null;
}

function playerBar() {
  return document.querySelector("ytmusic-player-bar");
}

function text(selector, root = document) {
  return root?.querySelector(selector)?.textContent.trim().replace(/\s+/g, " ") ?? "";
}

function lastThumbnail(list) {
  return list?.length ? list[list.length - 1].url : "";
}

// YouTube Music's own flag; it only changes when the page reloads.
function signedIn() {
  return Boolean(page.ytcfg?.get("LOGGED_IN"));
}

// Account-only features reject with SIGNED_OUT so the sidebar can say why.
function requireSignIn() {
  if (!signedIn()) throw new Error("SIGNED_OUT");
}

// NONE | ALL | ONE. YouTube Music keeps it on the player bar element.
function repeatMode() {
  const bar = playerBar();
  const mode = bar?.getAttribute("repeat-mode") ?? bar?.wrappedJSObject?.repeatMode_;
  return mode ? String(mode).toUpperCase() : "NONE";
}

function getState() {
  const p = player();
  const data = p?.getVideoData?.() ?? {};
  if (!data.video_id) return { videoId: null, signedIn: signedIn() };
  const bar = playerBar();
  const meta = page.navigator.mediaSession?.metadata;
  const artwork = meta?.artwork;
  return {
    videoId: data.video_id,
    title: meta?.title || text(".title", bar) || data.title || "",
    artist: meta?.artist || text(".byline", bar) || data.author || "",
    album: meta?.album || "",
    artwork: artwork?.length ? artwork[artwork.length - 1].src : bar?.querySelector("img.image")?.src || "",
    time: p.getCurrentTime(),
    duration: p.getDuration(),
    playing: p.getPlayerState() === 1,
    volume: p.getVolume(),
    like: bar?.querySelector("ytmusic-like-button-renderer")?.getAttribute("like-status") ?? "INDIFFERENT",
    repeat: repeatMode(),
    signedIn: signedIn(),
  };
}

// Player bar buttons. Shuffle reshuffles the queue; repeat cycles off/all/one.
const BUTTONS = {
  toggle: "ytmusic-player-bar #play-pause-button",
  next: "ytmusic-player-bar .next-button",
  previous: "ytmusic-player-bar .previous-button",
  shuffle: "ytmusic-player-bar .shuffle",
  repeat: "ytmusic-player-bar .repeat",
  like: "ytmusic-player-bar #button-shape-like button, ytmusic-player-bar ytmusic-like-button-renderer .like",
  dislike: "ytmusic-player-bar #button-shape-dislike button, ytmusic-player-bar ytmusic-like-button-renderer .dislike",
};

function control({ action }) {
  if (action === "like" || action === "dislike") requireSignIn();
  const button = document.querySelector(BUTTONS[action]);
  if (!button) throw new Error(`Couldn't find the ${action} button`);
  button.click();
}

function seek({ seconds }) {
  player()?.seekTo(seconds, true);
}

function setVolume({ percent }) {
  const p = player();
  p?.setVolume(percent);
  if (percent > 0 && p?.isMuted()) p.unMute();
}

// Songs that also have a music video appear twice in the DOM: the shown entry
// and a hidden "counterpart" for the other version. Only the shown ones count.
function queueItems() {
  return [...document.querySelectorAll("ytmusic-player-queue ytmusic-player-queue-item")].filter(
    (item) => !item.closest("#counterpart-renderer"),
  );
}

function getQueue() {
  return queueItems().map((item, index) => ({
    index,
    title: text(".song-title", item),
    artist: text(".byline", item),
    current: item.hasAttribute("selected"),
  }));
}

function playQueueItem({ index }) {
  const item = queueItems()[index];
  (item?.querySelector("ytmusic-play-button-renderer") ?? item)?.click();
}

// --- YouTube Music's own web API (innertube), called as the page would ------

// YouTube authenticates its API calls with a hash of the SAPISID cookie.
async function sapisidHash() {
  const cookie = document.cookie.match(/(?:^|; )(?:SAPISID|__Secure-3PAPISID)=([^;]+)/);
  if (!cookie) return null;
  const ts = Math.floor(Date.now() / 1000);
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${ts} ${cookie[1]} ${location.origin}`));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `SAPISIDHASH ${ts}_${hex}`;
}

// `continuation` is a token from findContinuation() to fetch the next page.
// Newer lists take it in the body; older ones (legacy) in the query string.
async function innertube(endpoint, body, continuation) {
  const cfg = page.ytcfg;
  const context = JSON.parse(page.JSON.stringify(cfg.get("INNERTUBE_CONTEXT")));
  const headers = {
    "Content-Type": "application/json",
    "X-Origin": location.origin,
    "X-Goog-AuthUser": String(cfg.get("SESSION_INDEX") ?? 0),
    "X-Youtube-Client-Name": String(cfg.get("INNERTUBE_CONTEXT_CLIENT_NAME")),
    "X-Youtube-Client-Version": String(cfg.get("INNERTUBE_CLIENT_VERSION")),
  };
  const auth = await sapisidHash();
  if (auth) headers.Authorization = auth;

  let query = "prettyPrint=false";
  let payload = { context, ...body };
  if (continuation?.legacy) {
    const token = encodeURIComponent(continuation.token);
    query += `&ctoken=${token}&continuation=${token}&type=next`;
    payload = { context };
  } else if (continuation) {
    payload = { context, continuation: continuation.token };
  }

  // The page's own fetch sends the request exactly as YouTube Music would,
  // with its cookies and origin. Options are cloned into the page's world.
  const init = { method: "POST", credentials: "include", headers, body: JSON.stringify(payload) };
  const response = await page.fetch(`/youtubei/v1/${endpoint}?${query}`, cloneInto(init, page));
  if (!response.ok) throw new Error(`YouTube Music answered ${response.status}`);
  return JSON.parse(await response.text());
}

// The responses are deeply nested; walk them instead of hard-coding paths.
function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const value of Object.values(node)) walk(value, visit);
}

function runs(t) {
  return t?.runs?.map((r) => r.text).join("") ?? t?.simpleText ?? "";
}

function flexText(renderer, column) {
  return runs(renderer.flexColumns?.[column]?.musicResponsiveListItemFlexColumnRenderer?.text);
}

function findContinuation(json) {
  let found = null;
  walk(json, (n) => {
    if (found) return;
    if (n.continuationCommand?.token) found = { token: n.continuationCommand.token, legacy: false };
    else if (n.nextContinuationData?.continuation) found = { token: n.nextContinuationData.continuation, legacy: true };
  });
  return found;
}

// First thing YouTube Music can play in a node: a song (watchEndpoint) or a
// whole list such as an album, mix or shuffle (watchPlaylistEndpoint).
function findPlayable(node) {
  let found = null;
  walk(node, (n) => {
    if (found) return;
    const song = n.watchEndpoint;
    const list = n.watchPlaylistEndpoint;
    if (song?.videoId) found = { videoId: song.videoId, playlistId: song.playlistId ?? null };
    else if (list?.playlistId) found = { videoId: null, playlistId: list.playlistId };
  });
  return found;
}

// One card or row of a list, normalised. `kind` tells the sidebar what a
// click does: open a playlist/album, play an artist's shuffle, or play.
function parseItem(r) {
  if (!r) return null;
  const isRow = Boolean(r.flexColumns);
  const browseId = r.navigationEndpoint?.browseEndpoint?.browseId ?? null;
  const play = findPlayable(r);
  const videoId = r.playlistItemData?.videoId ?? play?.videoId ?? null;
  let kind;
  if (browseId?.startsWith("VL")) kind = "playlist";
  else if (browseId?.startsWith("MPRE")) kind = "album";
  else if (browseId?.startsWith("UC")) kind = "artist";
  else if (videoId) kind = "song";
  else if (play?.playlistId) kind = "mix";
  else return null; // e.g. the "New playlist" button
  return {
    kind,
    title: isRow ? flexText(r, 0) : runs(r.title),
    subtitle: isRow ? flexText(r, 1) : runs(r.subtitle),
    thumbnail: lastThumbnail((r.thumbnailRenderer ?? r.thumbnail)?.musicThumbnailRenderer?.thumbnail?.thumbnails),
    browseId,
    videoId: kind === "song" ? videoId : null,
    playlistId: kind === "playlist" ? browseId.slice(2) : (play?.playlistId ?? null),
  };
}

// All cards and rows in a response, without duplicates.
function itemsOf(json) {
  const items = new Map();
  walk(json, (n) => {
    const item = parseItem(n.musicTwoRowItemRenderer ?? n.musicResponsiveListItemRenderer);
    if (!item) return;
    const key = [item.kind, item.browseId, item.videoId, item.playlistId].join("|");
    if (!items.has(key)) items.set(key, item);
  });
  return [...items.values()];
}

// A page of items plus the token for the next page, if there is one.
async function browsePage(body, continuation, kinds) {
  const json = await innertube("browse", body, continuation);
  const items = itemsOf(json).filter((i) => !kinds || kinds.includes(i.kind));
  return { items, continuation: findContinuation(json) };
}

function getPlaylists({ continuation }) {
  requireSignIn();
  return browsePage({ browseId: "FEmusic_liked_playlists" }, continuation, ["playlist"]);
}

// Library sections as YouTube Music names them in its own API.
const LIBRARY = {
  albums: "FEmusic_liked_albums",
  artists: "FEmusic_library_corpus_track_artists",
  songs: "FEmusic_liked_videos",
};

function getLibrary({ section, continuation }) {
  requireSignIn();
  return browsePage({ browseId: LIBRARY[section] }, continuation);
}

// Songs of a playlist or album.
function getCollection({ browseId, continuation }) {
  return browsePage({ browseId }, continuation, ["song"]);
}

// "params" is YouTube Music's own filter for the Songs tab of search results.
async function search({ query, continuation }) {
  const json = await innertube("search", { query, params: "EgWKAQIIAWoKEAkQBRAKEAMQBA==" }, continuation);
  return { items: itemsOf(json).filter((i) => i.kind === "song"), continuation: findContinuation(json) };
}

// Home: shelves such as Quick picks, mixes and recommendations.
async function getHome({ continuation }) {
  const json = await innertube("browse", { browseId: "FEmusic_home" }, continuation);
  const sections = [];
  walk(json, (n) => {
    const shelf = n.musicCarouselShelfRenderer;
    if (!shelf) return;
    const items = (shelf.contents ?? [])
      .map((c) => parseItem(c.musicTwoRowItemRenderer ?? c.musicResponsiveListItemRenderer))
      .filter(Boolean);
    const title = runs(shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title);
    if (items.length) sections.push({ title, items });
  });
  return { sections, continuation: findContinuation(json) };
}

// For an artist (or any page): the first shuffle/radio/song it offers.
async function playableFromPage({ browseId }) {
  const play = findPlayable(await innertube("browse", { browseId }));
  if (!play) throw new Error("Nothing to play on that page.");
  return play;
}

// Lyrics live on a separate browse page linked from the song's "next" data.
async function getLyrics({ videoId }) {
  const next = await innertube("next", { videoId, isAudioOnly: true });
  let browseId = null;
  walk(next, (n) => {
    const id = n.tabRenderer?.endpoint?.browseEndpoint?.browseId;
    if (!browseId && id?.startsWith("MPLY")) browseId = id;
  });
  if (!browseId) return null;
  let lyrics = null;
  walk(await innertube("browse", { browseId }), (n) => {
    const shelf = n.musicDescriptionShelfRenderer;
    if (shelf && !lyrics) lyrics = { text: runs(shelf.description), source: runs(shelf.footer) };
  });
  return lyrics?.text ? lyrics : null;
}

const METHODS = {
  getState,
  control,
  seek,
  setVolume,
  getQueue,
  playQueueItem,
  getHome,
  getPlaylists,
  getLibrary,
  getCollection,
  search,
  playableFromPage,
  getLyrics,
};

// --- Connection to the background -------------------------------------------

let port = null;

function connect() {
  port = browser.runtime.connect({ name: "ytm-tab" });
  port.onMessage.addListener(async ({ id, method, args }) => {
    try {
      const result = await METHODS[method](args ?? {});
      port.postMessage({ id, result });
    } catch (err) {
      port.postMessage({ id, error: String(err?.message || err) });
    }
  });
  // The background script may restart; reconnect instead of going deaf.
  port.onDisconnect.addListener(() => setTimeout(connect, 1000));
  // Lets the background notice a sign-in made in one of the user's own tabs.
  port.postMessage({ type: "hello", signedIn: signedIn() });
}

connect();

// Firefox sends the Next/Previous media keys only to the page's mediaSession
// handlers (play/pause works without them). YouTube Music sometimes clears
// or replaces its own, which makes those keys go dead. Keep our own handlers
// in place: they press the same player bar buttons. Re-applied every few
// seconds because YouTube Music re-registers its handlers as songs change.
function claimMediaKeys() {
  const session = page.navigator.mediaSession;
  if (!session) return;
  const press = (name) => exportFunction(() => document.querySelector(BUTTONS[name])?.click(), page);
  session.setActionHandler("nexttrack", press("next"));
  session.setActionHandler("previoustrack", press("previous"));
}

claimMediaKeys();
setInterval(claimMediaKeys, 5000);

// Tells the background when a new song starts, for the optional notification.
// Waits for the title, which YouTube Music fills in shortly after the switch.
let announcedVideoId = null;
setInterval(() => {
  const state = getState();
  if (!state.videoId || !state.title || !state.playing || state.videoId === announcedVideoId) return;
  announcedVideoId = state.videoId;
  port?.postMessage({ type: "songChanged", state });
}, 2000);
