// Helpers shared by the sidebar and the toolbar popup.

// Sends a message to the background and unwraps { result } / { error }.
async function send(message) {
  const reply = await browser.runtime.sendMessage(message);
  if (reply?.error) throw new Error(reply.error);
  return reply?.result;
}

// Calls a function of player.js in the hidden player tab.
const call = (method, args) => send({ type: "call", method, args });

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function el(tag, className, textContent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent != null) node.textContent = textContent;
  return node;
}

// player.js rejects account-only requests with this when nobody is signed in.
const SIGNED_OUT = "SIGNED_OUT";

// Opens YouTube Music in a normal tab so the user can sign in there.
function openSignIn() {
  return browser.tabs.create({ url: "https://music.youtube.com/" });
}
