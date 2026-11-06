# Sidebar for YouTube Music (Firefox)

A YouTube Music remote in the Firefox sidebar. Music plays in **one hidden
YouTube Music tab** that the extension manages, so it:

- keeps playing when you close the sidebar,
- works with your keyboard's media keys (Firefox handles them for tabs, even
  in the background),
- is never doubled: the sidebar has no player of its own.

The sidebar shows what's playing (artwork, progress, play/pause/next/previous,
volume, like/dislike, shuffle, repeat, start radio from this song) and has
these views:

- **Home**: Quick picks, mixes and recommendations
- **Playlists** and **Library** (albums, artists, songs); playlists and albums
  open to their songs with *Play all*, artists play their shuffle or radio
- **Queue**, **Lyrics** of the current song, and song **search**

The toolbar button opens a small popup with the current song, previous /
play-pause / next, like and **Open sidebar** (`Alt+Shift+M` opens the sidebar
directly).

Signed out of YouTube Music? The sidebar says so and offers **Sign in**. Once
you sign in in any YouTube Music tab, the hidden player reloads by itself
(or click **I've signed in**).

Long lists have *Load more*. 🔔 turns on a desktop notification when a new song
starts (off by default).

## Install (development)

```bash
npm install
```

In Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary
Add-on…** → pick `manifest.json`. Temporary add-ons are removed when Firefox
restarts.

## Publishing to addons.mozilla.org

1. Bump `version` in `manifest.json` (and `package.json`).
2. `npm run lint && npm run package` → `web-ext-artifacts/sidebar_for_youtube_music-<version>.zip`.
3. Upload it at <https://addons.mozilla.org/developers/>. Listing text,
   categories and reviewer notes are in [`store/amo-listing.md`](store/amo-listing.md).

Later versions can be signed and submitted from the command line with AMO API
credentials (from <https://addons.mozilla.org/developers/addon/api/key/>):

```bash
npx web-ext sign --channel=listed --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET" --ignore-files node_modules package.json package-lock.json README.md store
```

The add-on id `ytmusic-sidebar@fabiosammy` must never change: AMO and
Firefox use it to recognise updates.

## Use

1. Sign in to music.youtube.com in a normal tab once.
2. Open the sidebar with `Alt+Shift+M` or the popup's **Open sidebar**. Click **Allow
   access** if asked.
3. Pick a playlist or search for a song. ↗ shows the player tab for the full
   YouTube Music page.

Firefox blocks audio that starts without a click in a tab that was never shown,
so set these once:

1. Open music.youtube.com in a tab, press `Ctrl+I` (Page Info) → **Permissions**
   → **Autoplay**: untick *Use Default*, pick **Allow Audio and Video**.
2. `about:config` → `media.block-autoplay-until-in-foreground` → `false`.

## How it works

| File | Role |
| --- | --- |
| `src/background.js` | Creates and remembers the single hidden player tab (`tabs.hide`, id in `storage.session`) and relays sidebar requests to it |
| `src/player.js` | Content script in the player tab: reads the player, presses its buttons, lists the queue, and calls YouTube Music's own web API (innertube, authenticated like the page) for playlists and search |
| `src/sidebar.*` | The remote UI; polls the player state once a second |
| `src/popup.*` | Toolbar popup: compact now playing and controls |
| `src/common.js` | Helpers shared by sidebar and popup |

Starting a playlist or song loads `watch?list=…` / `watch?v=…` in the player
tab, so there is a short pause while YouTube Music loads.

## Caveats

YouTube Music has no public API. `src/player.js` relies on its page structure
and its internal API responses; if Google changes them, it may need updating.

Not affiliated with, endorsed by or sponsored by Google or YouTube. YouTube
Music is a trademark of Google LLC.
