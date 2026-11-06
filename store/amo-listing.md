# addons.mozilla.org listing

Copy these into the AMO submission form. Kept out of the add-on package.

## Name

Sidebar for YouTube Music

## Add-on URL slug

sidebar-for-youtube-music

## Summary (max 250 characters)

A YouTube Music remote in the Firefox sidebar and toolbar: your playlists,
library, queue, search and lyrics. Music keeps playing when you close the
sidebar, and your keyboard's media keys keep working.

## Description

Control YouTube Music without keeping its tab in front of you.

Sidebar for YouTube Music opens YouTube Music in one hidden tab and gives you
a compact remote in the Firefox sidebar and in a toolbar popup.

**In the sidebar**
- Now playing with artwork, progress, play/pause, next/previous and volume
- Like / dislike, shuffle, repeat and "start radio from this song"
- Home (quick picks and mixes), your playlists and library (albums, artists,
  songs), with "Play all" and per-song playback
- The current queue, song search and lyrics
- Optional notification when a new song starts

**Why a hidden tab?** Music keeps playing when you close the sidebar, there is
only ever one player, and your keyboard's media keys work as with any tab.

**Toolbar popup:** current song, controls and a shortcut to the sidebar.
Open the sidebar anytime with Alt+Shift+M.

You need a YouTube Music account signed in to music.youtube.com for your
playlists and library.

Tip: if music doesn't start in the hidden tab, allow autoplay for
music.youtube.com (open it, press Ctrl+I → Permissions → Autoplay → Allow
Audio and Video).

This add-on is not affiliated with, endorsed by or sponsored by Google or
YouTube. YouTube Music is a trademark of Google LLC.

## Categories

- Firefox: Photos, Music & Videos

## Tags

music, youtube music, sidebar, media keys, player

## Support / homepage

(GitHub repository URL if it is made public; otherwise leave empty)

## License

(Your choice. MIT is common for small add-ons. AMO asks for it on listed
submissions.)

## Privacy policy

Not required: the add-on collects no data and sends nothing anywhere except
to music.youtube.com itself, as the YouTube Music page would.

## Data collection (manifest)

`data_collection_permissions.required: ["none"]`

## Notes to reviewer

- No remote code, no bundler, no minified files: the package is the source in
  this repository as-is.
- The add-on opens one music.youtube.com tab and hides it with `tabs.hide`
  (permission `tabHide`), so playback survives closing the sidebar. The tab is
  re-hidden when the user switches away after opening it from the sidebar
  (↗ button). Its id is kept in `storage.session`.
- `src/player.js` is a content script on music.youtube.com only. It reads the
  player state, presses the page's own player bar buttons, and calls YouTube
  Music's own web API (`/youtubei/v1/browse|search|next`) through the page's
  own `fetch`, with the same SAPISIDHASH authorization header the page itself
  sends. Nothing is sent to any other host.
- It re-registers `mediaSession` "nexttrack"/"previoustrack" handlers that
  click the page's own buttons, because YouTube Music sometimes clears its
  handlers and the hardware Next/Previous keys stop working.
- `notifications` is only used for the optional "now playing" notification
  (off by default, toggled with 🔔 in the sidebar).
- To test: sign in at music.youtube.com, open the sidebar (Alt+Shift+M), click
  "Allow access" if shown, pick a playlist.
