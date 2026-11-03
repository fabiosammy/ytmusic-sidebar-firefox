// YouTube Music refuses to be shown inside a frame (X-Frame-Options:
// SAMEORIGIN). This rule removes that header, but only for frames that are not
// in any tab (tabIds -1, i.e. our sidebar), so frames inside normal websites
// stay protected.
const FRAME_RULE = {
  id: 1,
  priority: 1,
  action: {
    type: "modifyHeaders",
    responseHeaders: [{ header: "x-frame-options", operation: "remove" }],
  },
  condition: {
    requestDomains: ["music.youtube.com"],
    resourceTypes: ["sub_frame"],
    tabIds: [-1],
  },
};

browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [FRAME_RULE.id], addRules: [FRAME_RULE] });

// Firefox only routes media keys to media playing in tabs, not in a sidebar.
// The keys are registered as extension commands instead and relayed to the
// content script running inside the sidebar's YouTube Music frame.
const framePorts = new Set();

browser.runtime.onConnect.addListener((port) => {
  if (port.name !== "ytm-sidebar-frame") return;
  framePorts.add(port);
  port.onDisconnect.addListener(() => framePorts.delete(port));
});

browser.commands.onCommand.addListener((command) => {
  for (const port of framePorts) port.postMessage({ command });
});

// The toolbar button opens the sidebar.
browser.action.onClicked.addListener(() => browser.sidebarAction.open());
