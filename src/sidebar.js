// Sidebar shell around the YouTube Music frame: permission check, shortcut
// buttons and pop-out.

const frame = document.getElementById("ytm");
const needsPermission = document.getElementById("needs-permission");
const BASE = "https://music.youtube.com";
const START_PATH = "/library/playlists";
const HOST_ACCESS = { origins: ["https://*.youtube.com/*"] };

function load(path) {
  frame.src = BASE + path;
}

// Without host access the background script can't lift YouTube's framing
// block, and Firefox doesn't grant it automatically for MV3 add-ons.
async function start() {
  if (await browser.permissions.contains(HOST_ACCESS)) {
    needsPermission.hidden = true;
    frame.hidden = false;
    load(START_PATH);
  } else {
    needsPermission.hidden = false;
    frame.hidden = true;
  }
}

// permissions.request must run directly inside the click handler.
document.getElementById("grant").addEventListener("click", () => {
  browser.permissions.request(HOST_ACCESS).then(start);
});

document.querySelectorAll("nav button[data-path]").forEach((button) => {
  button.addEventListener("click", () => load(button.dataset.path));
});

document.getElementById("reload").addEventListener("click", () => {
  frame.src = frame.src;
});

// The frame is cross-origin, so its current URL can't be read; open the home page instead.
document.getElementById("pop-out").addEventListener("click", () => {
  browser.tabs.create({ url: BASE });
});

start();
