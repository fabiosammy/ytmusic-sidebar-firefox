# YouTube Music Sidebar (Firefox)

YouTube Music in the Firefox sidebar, the same way Firefox's AI chatbot sidebar
shows ChatGPT or Claude: your playlists, library and player, signed in with
your own account, next to whatever tab you're browsing.

## Install (development)

```bash
npm install
```

In Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary
Add-on…** → pick `manifest.json`. Temporary add-ons are removed when Firefox
restarts. To keep it, run `npm run package` and sign the zip as an unlisted
add-on at addons.mozilla.org.

## Use

1. Sign in to music.youtube.com in a normal tab once (Google sign-in doesn't
   work inside frames).
2. Open the sidebar with the toolbar button or `Alt+Shift+M`.
3. It opens on your playlists. **Home / Playlists / Library** jump around, ⟳
   reloads and ↗ opens YouTube Music in a tab.

Music keeps playing while the sidebar is open. Closing the sidebar stops it.

Media keys (play/pause, next, previous) work while a Firefox window is
focused. Firefox only hands media keys to tabs when it's in the background, so
for system-wide control use a tab (↗). Remap or disable them in
`about:addons` → ⚙ → **Manage Extension Shortcuts**.

## How it works

YouTube Music refuses to load inside frames (`X-Frame-Options: SAMEORIGIN`).
`src/background.js` adds a `declarativeNetRequest` rule that removes that
header **only** for frames outside any tab (the sidebar), so other websites
still can't embed YouTube Music. (Rewriting the header with blocking
`webRequest` did not work for sidebar frames.)

`src/frame.js` runs inside the sidebar's YouTube Music frame and clicks the
player buttons when a media-key command arrives.

## No-extension alternative

Firefox's built-in AI chatbot sidebar accepts any URL: set
`browser.ml.chat.provider` to `https://music.youtube.com` in `about:config`.
This replaces your chatbot provider.
