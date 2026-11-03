// Runs inside the YouTube Music frame in our sidebar and presses the player
// buttons when the background script relays a media key.

const BUTTONS = {
  "play-pause": "ytmusic-player-bar #play-pause-button",
  "next-track": "ytmusic-player-bar .next-button",
  "previous-track": "ytmusic-player-bar .previous-button",
};

// Only the sidebar frame listens; YouTube Music in normal tabs has Firefox's
// own media key support already.
if (window.top !== window) {
  const port = browser.runtime.connect({ name: "ytm-sidebar-frame" });
  port.onMessage.addListener((message) => {
    const selector = BUTTONS[message?.command];
    if (selector) document.querySelector(selector)?.click();
  });
}
