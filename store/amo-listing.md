# addons.mozilla.org listing

Field-by-field answers for the AMO "Describe Add-on" form. Kept out of the
add-on package.

## Name

Sidebar for YouTube Music

## Add-on URL

sidebar-for-youtube-music

## Summary

YouTube Music remote in the Firefox sidebar: playlists, library, queue, search and lyrics, with playback that survives closing it.

## Description

```markdown
Control YouTube Music from the Firefox sidebar and toolbar without keeping its tab in front of you. Browse your playlists and library, search songs, see the queue and lyrics. Music keeps playing when you close the sidebar, and your keyboard's media keys keep working.

**In the sidebar**

- Now playing: artwork, progress, play/pause, next/previous, volume
- Like / dislike, shuffle, repeat and "start radio from this song"
- Home: quick picks and mixes
- Your playlists and library (albums, artists, songs), with "Play all"
- The current queue, song search and lyrics
- Optional notification when a new song starts

**Toolbar popup:** the current song, playback controls and a shortcut to the sidebar. Open the sidebar anytime with Alt+Shift+M.

**How it works:** the add-on opens YouTube Music in one hidden tab and plays there, so there is only ever one player, playback survives closing the sidebar, and media keys work as with any tab.

**Requirements:** sign in at music.youtube.com for your playlists, library and likes. If music doesn't start, allow autoplay for music.youtube.com: open it, press Ctrl+I → Permissions → Autoplay → Allow Audio and Video.

Open source (MIT): https://github.com/fabiosammy/ytmusic-sidebar-firefox

*Sidebar for YouTube Music is an independent project. It is not affiliated with, endorsed by or sponsored by Google LLC or YouTube. YouTube and YouTube Music are trademarks of Google LLC.*
```

## Checkboxes

- This add-on is experimental: **no**
- This add-on requires payment, non-free services or software, or additional
  hardware: **no** (works with a free YouTube Music account)

## Categories

- Photos, Music & Videos

## Support

- Support email: optional, leave empty or use a personal address
- Support website: https://github.com/fabiosammy/ytmusic-sidebar-firefox/issues

## License

MIT License

## Privacy Policy

Leave "This add-on has a Privacy Policy" unchecked: the add-on collects no
data and talks to no server except music.youtube.com itself, as the page
would. The manifest declares `data_collection_permissions.required: ["none"]`.

## Notes to Reviewer

```text
No build step: the package is the plain, unminified source of
https://github.com/fabiosammy/ytmusic-sidebar-firefox (no bundler, no
dependencies at runtime, no remote code). package.json only holds web-ext for
lint/packaging.

What it does and why each permission is needed:

- One music.youtube.com tab is opened by the extension and hidden with
  tabs.hide (permission "tabHide"), so playback survives closing the sidebar
  and Firefox's own media key support applies. Its id is kept in
  storage.session ("storage"). After the user shows it with the ↗ button, it
  is hidden again when they switch to another tab. Only this one tab is
  created; the user's own YouTube Music tabs are never controlled.

- src/player.js is the only content script, on https://music.youtube.com/*
  (the only host permission). It reads the player state, presses the page's
  own player bar buttons, and reads the queue from the DOM.

- Playlists, library, home, search and lyrics come from YouTube Music's own
  web API (/youtubei/v1/browse, /search, /next), requested through the page's
  own fetch (window.wrappedJSObject.fetch with cloneInto) with the same
  SAPISIDHASH authorization header the page itself sends. Nothing is sent to
  any other host, and no data is stored beyond the hidden tab's id and one
  on/off setting.

- player.js re-registers mediaSession "nexttrack"/"previoustrack" handlers
  that click the page's own buttons, because YouTube Music sometimes clears
  its handlers and the hardware Next/Previous keys stop working.

- "notifications" is only used for the optional "now playing" notification,
  off by default (🔔 in the sidebar).

How to test:
1. Sign in at https://music.youtube.com (a free account works). If audio
   doesn't start in the hidden tab, allow autoplay for the site
   (Ctrl+I → Permissions → Autoplay → Allow Audio and Video).
2. Open the sidebar with Alt+Shift+M (or the toolbar popup → Open sidebar).
   Click "Allow access to YouTube Music" if shown.
3. Pick a playlist: music starts in the hidden tab; close the sidebar and it
   keeps playing; the toolbar popup controls it.
```

## Media

- Add-on icon: `icons/icon-128.png` (also in the package manifest since 1.0.1)
- Screenshots (1280×800, rendered from mock pages with the add-on's real CSS
  and made-up songs by `store/screenshots/render.sh`), with captions:
  1. `store/screenshots/1-queue.png`: "Now playing and the queue in the sidebar, next to any page"
  2. `store/screenshots/2-playlist.png`: "Open a playlist or album, play it all or start from any song"
  3. `store/screenshots/3-popup.png`: "The toolbar popup: current song and controls without opening the sidebar"
  4. `store/screenshots/4-queue-dark.png`: "Follows Firefox's dark theme"
