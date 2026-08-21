// background.js - Time Tracker Background Engine

let isBrowserFocused = false;
let currentActiveTabId = null;
let isAudiblePlayback = false;
let isPopupOpen = false;

// Tracking Engine state
let currentTrackingDomain = null;
let trackingStartTime = null;
let currentReason = "";

// Heartbeat tracking
let heartbeatIntervalId = null;

function normalizeDomain(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') {
      const parts = parsed.pathname.split('/');
      const filename = parts[parts.length - 1];
      return filename ? `local-file: ${decodeURIComponent(filename)}` : 'local-file';
    }
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

// Writes active session metadata to local storage
function updateHeartbeat() {
  if (currentTrackingDomain && trackingStartTime) {
    const session = {
      domain: currentTrackingDomain,
      startTime: trackingStartTime,
      lastHeartbeatTime: Date.now(),
      isAudible: isAudiblePlayback,
      reason: currentReason
    };
    chrome.storage.local.set({ activeSession: session });
  } else {
    chrome.storage.local.remove('activeSession');
  }
}

// Recover previous session if the browser was closed or crashed unexpectedly
function recoverPreviousSession(callback) {
  chrome.storage.local.get(['activeSession', 'activityLogs'], (result) => {
    const session = result.activeSession;
    if (session && session.domain && session.startTime && session.lastHeartbeatTime) {
      const durationMs = session.lastHeartbeatTime - session.startTime;
      const durationSeconds = Math.round(durationMs / 1000);

      if (durationSeconds > 0) {
        const recoveredSegment = {
          domain: session.domain,
          startTime: new Date(session.startTime).toISOString(),
          endTime: new Date(session.lastHeartbeatTime).toISOString(),
          duration: durationSeconds,
          browser: 'chrome',
          mode: session.isAudible ? 'audible-background' : 'foreground-focus',
          reason: `${session.reason} (Recovered Session)`
        };

        const logs = result.activityLogs || [];
        logs.push(recoveredSegment);

        chrome.storage.local.set({ activityLogs: logs }, () => {
          console.log(`[RECOVERY] Recovered previous active session:`, recoveredSegment);
          chrome.storage.local.remove('activeSession', () => {
            if (callback) callback();
          });
        });
        return;
      }
    }
    // If no recovery occurred, clean up key and trigger callback
    chrome.storage.local.remove('activeSession', () => {
      if (callback) callback();
    });
  });
}

// Commit the current active interval to storage/logs
function commitActivitySegment(transitionReason) {
  if (!currentTrackingDomain || !trackingStartTime) return;

  const now = Date.now();
  const durationMs = now - trackingStartTime;
  const durationSeconds = Math.round(durationMs / 1000);

  if (durationSeconds > 0) {
    const segment = {
      domain: currentTrackingDomain,
      startTime: new Date(trackingStartTime).toISOString(),
      endTime: new Date(now).toISOString(),
      duration: durationSeconds,
      browser: 'chrome', 
      mode: isAudiblePlayback ? 'audible-background' : 'foreground-focus',
      reason: currentReason
    };

    console.log(`[ENGINE] Committed Activity Segment:`, segment);

    // Save to chrome.storage.local
    chrome.storage.local.get(['activityLogs'], (result) => {
      const logs = result.activityLogs || [];
      logs.push(segment);
      chrome.storage.local.set({ activityLogs: logs }, () => {
        console.log(`[STORAGE] Segment saved. Total local records: ${logs.length}`);
      });
    });
  } else {
    console.log(`[ENGINE] Discarded segment for ${currentTrackingDomain} (duration < 1s)`);
  }

  // Clear references & heartbeat timer
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
  chrome.storage.local.remove('activeSession');

  currentTrackingDomain = null;
  trackingStartTime = null;
}

// Central state machine to evaluate what tab/domain should be tracked
async function updateTrackingState() {
  try {
    // Check for any tab currently playing audio/video
    const audibleTabs = await chrome.tabs.query({ audible: true });
    const hasAudible = audibleTabs && audibleTabs.length > 0;

    // If the popup is open, we bypass the focus check and keep tracking the last active domain
    if (isPopupOpen && currentTrackingDomain) {
      return;
    }

    // 1. Get the last focused window and check if it is active and not minimized
    const lastFocusedWin = await chrome.windows.getLastFocused({ populate: false });
    if (lastFocusedWin && lastFocusedWin.state !== 'minimized' && lastFocusedWin.type === 'normal') {
      isBrowserFocused = lastFocusedWin.focused;
    } else {
      isBrowserFocused = false;
    }

    if (isBrowserFocused) {
      const [activeTab] = await chrome.tabs.query({ active: true, windowId: lastFocusedWin.id });
      if (activeTab) {
        const domain = normalizeDomain(activeTab.url);
        setTrackingTarget(activeTab.id, domain, false, `Focused Window Tab`);
        return;
      }
    }

    // 2. If browser is not focused, scan for any tab currently playing audio/video
    if (hasAudible) {
      const audibleTab = audibleTabs[0];
      const domain = normalizeDomain(audibleTab.url);
      setTrackingTarget(audibleTab.id, domain, true, `Background Audible Tab`);
      return;
    }

    // 3. No focused window and no background audio playing -> pause tracking
    setTrackingTarget(null, null, false, `No active/audible context`);
  } catch (error) {
    console.error(`Error updating tracking state:`, error);
  }
}

// Helper to update the tracking state values and log changes
function setTrackingTarget(tabId, domain, isAudible, reason) {
  const domainChanged = currentTrackingDomain !== domain;
  const stateChanged = currentActiveTabId !== tabId || isAudiblePlayback !== isAudible;

  if (domainChanged || stateChanged) {
    // If we were already tracking a domain, commit its finished segment first
    if (currentTrackingDomain) {
      commitActivitySegment(reason);
    }

    currentActiveTabId = tabId;
    isAudiblePlayback = isAudible;
    currentReason = reason;

    if (domain) {
      currentTrackingDomain = domain;
      trackingStartTime = Date.now();
      
      const mode = isAudible ? "AUDIBLE BACKGROUND" : "FOREGROUND FOCUS";
      console.log(`[TRACKING] Active Domain: ${domain} | Mode: ${mode} | Reason: ${reason}`);

      // Start the heartbeat and active focus verification timer
      if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
      }
      updateHeartbeat();
      // Run every 2 seconds to catch OS focus changes that missed the onFocusChanged event
      heartbeatIntervalId = setInterval(() => {
        updateTrackingState();
        updateHeartbeat();
      }, 2000);
    } else {
      currentTrackingDomain = null;
      trackingStartTime = null;
      console.log(`[TRACKING] Paused | Reason: ${reason}`);
    }
  }
}

// Event Listeners: Trigger state update on tab changes, focus changes, and updates
chrome.tabs.onActivated.addListener(() => {
  updateTrackingState();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url !== undefined || changeInfo.audible !== undefined) {
    updateTrackingState();
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    isBrowserFocused = false;
    updateTrackingState();
  } else {
    chrome.windows.get(windowId, (win) => {
      if (win && win.state !== 'minimized' && win.type === 'normal') {
        isBrowserFocused = true;
      } else {
        isBrowserFocused = false;
      }
      updateTrackingState();
    });
  }
});

// Initialize on service worker startup
chrome.windows.getLastFocused({ populate: false }, (win) => {
  if (win && win.focused && win.state !== 'minimized' && win.type === 'normal') {
    isBrowserFocused = true;
  } else {
    isBrowserFocused = false;
  }

  recoverPreviousSession(() => {
    updateTrackingState();
  });
});

// Port connection to detect when popup is open
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    isPopupOpen = true;
    updateTrackingState();

    port.onDisconnect.addListener(() => {
      isPopupOpen = false;
      updateTrackingState();
    });
  }
});

console.log("Background Service Worker Initialized.");
