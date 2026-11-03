// Toolbar popup: a compact now-playing card with transport controls and a
// shortcut to the full sidebar. Talks to the same hidden player tab.

const $ = (id) => document.getElementById(id);

function render(state) {
  const has = Boolean(state?.videoId);
  $("title").textContent = has ? state.title : "Nothing playing";
  $("artist").textContent = has ? state.artist : "Open the sidebar to pick something";
  $("artwork").hidden = !has || !state.artwork;
  if (has && state.artwork && $("artwork").src !== state.artwork) $("artwork").src = state.artwork;
  $("toggle").textContent = state?.playing ? "⏸" : "▶";
  $("like").classList.toggle("on", state?.like === "LIKE");
  $("time").textContent = formatTime(state?.time);
  $("duration").textContent = formatTime(state?.duration);
  const progress = state?.duration ? (state.time / state.duration) * 100 : 0;
  $("bar-fill").style.width = `${Math.min(100, progress)}%`;
  $("signed-out").hidden = state?.signedIn !== false;
}

async function refresh() {
  render(await call("getState").catch(() => null));
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    $("status").textContent = "";
    call("control", { action: button.dataset.action })
      .then(refresh)
      .catch((err) => {
        $("status").textContent = err.message === SIGNED_OUT ? "Sign in to YouTube Music to like songs." : err.message;
      });
  });
});

// sidebarAction.open must run directly inside the click handler.
$("open-sidebar").addEventListener("click", () => {
  browser.sidebarAction.open();
  window.close();
});

$("sign-in").addEventListener("click", () => openSignIn().then(() => window.close()));

refresh();
setInterval(refresh, 1000);
