# YouTube Music Sidebar (Firefox)

A YouTube Music remote in the Firefox sidebar. Music plays in **one hidden
YouTube Music tab** that the extension manages, so it:

- keeps playing when you close the sidebar,
- works with your keyboard's media keys (Firefox handles them for tabs, even
  in the background),
- is never doubled: the sidebar has no player of its own.

The sidebar shows what's playing (artwork, progress, play/pause/next/previous,
volume), your playlists, your library (albums, artists, songs), the current
queue and song search. Clicking an artist plays their shuffle (or radio).

## Install (development)

```bash
npm install
```

In Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary
Add-on…** → pick `manifest.json`. Temporary add-ons are removed when Firefox
restarts. To keep it, run `npm run package` and sign the zip as an unlisted
add-on at addons.mozilla.org.

## Use

1. Sign in to music.youtube.com in a normal tab once.
2. Open the sidebar with the toolbar button or `Alt+Shift+M`. Click **Allow
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

Starting a playlist or song loads `watch?list=…` / `watch?v=…` in the player
tab, so there is a short pause while YouTube Music loads.

## Caveats

YouTube Music has no public API. `src/player.js` relies on its page structure
and its internal API responses; if Google changes them, it may need updating.
