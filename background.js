// background.js - Time Tracker Background Engine

let isBrowserFocused = false;
let currentActiveDomain = null;
let currentActiveTabId = null;
let isAudiblePlayback = false; // Flag to trace if tracking is due to background audio

function normalizeDomain(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    let host = parsed.hostname;
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    return host;
  } catch (e) {
    return null;
  }
}

// Central state machine to evaluate what tab/domain should be tracked
async function updateTrackingState() {
  try {
    // 1. Get the last focused window and check if it is active and not minimized
    const lastFocusedWin = await chrome.windows.getLastFocused({ populate: false });
    
    let focusedTab = null;
    let focusedWindowActive = false;

    if (lastFocusedWin && lastFocusedWin.focused && lastFocusedWin.state !== 'minimized') {
      focusedWindowActive = true;
      // Get the active tab in that focused window
      const [activeTab] = await chrome.tabs.query({ active: true, windowId: lastFocusedWin.id });
      if (activeTab) {
        focusedTab = activeTab;
      }
    }

    // 2. If the browser window is active, track the active tab in it
    if (focusedWindowActive && focusedTab) {
      const domain = normalizeDomain(focusedTab.url);
      setTrackingTarget(focusedTab.id, domain, false, `Focused Window Tab`);
      return;
    }

    // 3. If browser is not focused, scan for any tab currently playing audio/video
    const audibleTabs = await chrome.tabs.query({ audible: true });
    if (audibleTabs && audibleTabs.length > 0) {
      // Track the first audible tab
      const audibleTab = audibleTabs[0];
      const domain = normalizeDomain(audibleTab.url);
      setTrackingTarget(audibleTab.id, domain, true, `Background Audible Tab`);
      return;
    }

    // 4. No focused window and no background audio playing -> pause tracking
    setTrackingTarget(null, null, false, `No active/audible context`);
  } catch (error) {
    console.error(`Error updating tracking state:`, error);
  }
}

// Helper to update the tracking state values and log changes
function setTrackingTarget(tabId, domain, isAudible, reason) {
  const domainChanged = currentActiveDomain !== domain;
  const stateChanged = currentActiveTabId !== tabId || isAudiblePlayback !== isAudible;

  if (domainChanged || stateChanged) {
    currentActiveTabId = tabId;
    currentActiveDomain = domain;
    isAudiblePlayback = isAudible;

    if (domain) {
      const mode = isAudible ? "AUDIBLE BACKGROUND" : "FOREGROUND FOCUS";
      console.log(`[TRACKING] Active Domain: ${domain} | Mode: ${mode} | Reason: ${reason}`);
    } else {
      console.log(`[TRACKING] Paused | Reason: ${reason}`);
    }
  }
}

// Event Listeners: Trigger state update on tab changes, focus changes, and updates
chrome.tabs.onActivated.addListener(() => {
  updateTrackingState();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Trigger update if URL changes or audible status changes
  if (changeInfo.url !== undefined || changeInfo.audible !== undefined) {
    updateTrackingState();
  }
});

chrome.windows.onFocusChanged.addListener(() => {
  updateTrackingState();
});

// Initialize on service worker startup
updateTrackingState();

console.log("Background Service Worker Initialized.");
