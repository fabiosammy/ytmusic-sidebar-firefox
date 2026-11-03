// Runs in YouTube Music tabs. In the extension's hidden player tab it answers
// the sidebar remote: what's playing, playback controls, queue, playlists and
// search. Other YouTube Music tabs connect too but are never asked anything.

// Page objects (the player, ytcfg, mediaSession) live in the page's JS world;
// Firefox content scripts reach them through wrappedJSObject.
const page = window.wrappedJSObject;

function player() {
  return document.getElementById("movie_player")?.wrappedJSObject ?? null;
}

function text(selector, root = document) {
  return root.querySelector(selector)?.textContent.trim().replace(/\s+/g, " ") ?? "";
}

function lastThumbnail(list) {
  return list?.length ? list[list.length - 1].url : "";
}

function getState() {
  const p = player();
  const data = p?.getVideoData?.() ?? {};
  if (!data.video_id) return { videoId: null };
  const bar = document.querySelector("ytmusic-player-bar");
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
  };
}

const BUTTONS = {
  toggle: "ytmusic-player-bar #play-pause-button",
  next: "ytmusic-player-bar .next-button",
  previous: "ytmusic-player-bar .previous-button",
};

function control({ action }) {
  document.querySelector(BUTTONS[action])?.click();
}

function seek({ seconds }) {
  player()?.seekTo(seconds, true);
}

function setVolume({ percent }) {
  const p = player();
  p?.setVolume(percent);
  if (percent > 0 && p?.isMuted()) p.unMute();
}

function getQueue() {
  return [...document.querySelectorAll("ytmusic-player-queue-item")].map((item, index) => ({
    index,
    title: text(".song-title", item),
    artist: text(".byline", item),
    current: item.hasAttribute("selected"),
  }));
}

function playQueueItem({ index }) {
  const item = document.querySelectorAll("ytmusic-player-queue-item")[index];
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

async function innertube(endpoint, body) {
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
  // content.fetch sends the request as the page, with its cookies.
  const response = await content.fetch(`/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ context, ...body }),
  });
  if (!response.ok) throw new Error(`YouTube Music answered ${response.status}`);
  return response.json();
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

async function getPlaylists() {
  const json = await innertube("browse", { browseId: "FEmusic_liked_playlists" });
  const playlists = new Map();
  walk(json, (node) => {
    const two = node.musicTwoRowItemRenderer;
    const row = node.musicResponsiveListItemRenderer;
    const r = two ?? row;
    const browseId = r?.navigationEndpoint?.browseEndpoint?.browseId;
    if (!browseId?.startsWith("VL")) return;
    const id = browseId.slice(2);
    if (playlists.has(id)) return;
    playlists.set(id, {
      id,
      title: two ? runs(two.title) : flexText(row, 0),
      subtitle: two ? runs(two.subtitle) : flexText(row, 1),
      thumbnail: lastThumbnail(
        (two?.thumbnailRenderer ?? row?.thumbnail)?.musicThumbnailRenderer?.thumbnail?.thumbnails,
      ),
    });
  });
  return [...playlists.values()];
}

// "params" is YouTube Music's own filter for the Songs tab of search results.
async function search({ query }) {
  const json = await innertube("search", { query, params: "EgWKAQIIAWoKEAkQBRAKEAMQBA==" });
  const songs = new Map();
  walk(json, (node) => {
    const r = node.musicResponsiveListItemRenderer;
    if (!r) return;
    let videoId = r.playlistItemData?.videoId;
    if (!videoId) walk(r, (n) => (videoId ??= n.watchEndpoint?.videoId));
    if (!videoId || songs.has(videoId)) return;
    songs.set(videoId, {
      videoId,
      title: flexText(r, 0),
      artist: flexText(r, 1),
      thumbnail: lastThumbnail(r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails),
    });
  });
  return [...songs.values()].slice(0, 30);
}

const METHODS = { getState, control, seek, setVolume, getQueue, playQueueItem, getPlaylists, search };

function connect() {
  const port = browser.runtime.connect({ name: "ytm-tab" });
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
}

connect();
