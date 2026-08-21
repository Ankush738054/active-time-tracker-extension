// background.js - Time Tracker Background Engine

let isBrowserFocused = false;
let currentActiveTabId = null;
let isAudiblePlayback = false;
let isSystemIdle = false;
let isPopupOpen = false;

// Tracking Engine state
let currentTrackingDomain = null;
let trackingStartTime = null;
let currentReason = "";

// Heartbeat tracking
let heartbeatIntervalId = null;

const IDLE_DETECTION_INTERVAL = 60; // 60 seconds (1 minute) for production balance

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
  let durationMs = now - trackingStartTime;

  // Retroactive idle time adjustment:
  // We subtract the 60 seconds check delay to keep logs precise.
  if (transitionReason === 'System Idle') {
    const idleThresholdMs = IDLE_DETECTION_INTERVAL * 1000;
    durationMs = Math.max(0, durationMs - idleThresholdMs);
  }

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
        syncLogsWithCloud(); // Sync immediately upon committing
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

    // 1. Check if user is idle (but allow active audio playback to bypass idle pause)
    if (isSystemIdle) {
      if (hasAudible) {
        const audibleTab = audibleTabs[0];
        const domain = normalizeDomain(audibleTab.url);
        setTrackingTarget(audibleTab.id, domain, true, `Audible playback during system idle`);
        return;
      }
      setTrackingTarget(null, null, false, `System Idle`);
      return;
    }

    // If the popup is open, we bypass the focus check and keep tracking the last active domain
    if (isPopupOpen && currentTrackingDomain) {
      return;
    }

    // 2. If the browser window has OS focus, track the active tab
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

    // 3. If browser is not focused, scan for any tab currently playing audio/video
    if (hasAudible) {
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

// Idle API Configuration & Event Listeners
chrome.idle.setDetectionInterval(IDLE_DETECTION_INTERVAL);

chrome.idle.onStateChanged.addListener((state) => {
  console.log(`Idle state changed to: ${state}`);
  isSystemIdle = (state === 'idle' || state === 'locked');
  updateTrackingState();
});

// Initialize on service worker startup
chrome.windows.getLastFocused({ populate: false }, (win) => {
  if (win && win.focused && win.state !== 'minimized' && win.type === 'normal') {
    isBrowserFocused = true;
  } else {
    isBrowserFocused = false;
  }

  recoverPreviousSession(() => {
    chrome.idle.queryState(IDLE_DETECTION_INTERVAL, (state) => {
      isSystemIdle = (state === 'idle' || state === 'locked');
      updateTrackingState();
      syncLogsWithCloud(); // Try syncing cached logs on extension load
    });
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

// Background Cloud Synchronization Queue
let isSyncing = false;

async function syncLogsWithCloud() {
  if (isSyncing) return;

  chrome.storage.local.get(['activityLogs', 'token'], (result) => {
    const logs = result.activityLogs || [];
    const token = result.token;

    if (!token || logs.length === 0) {
      return;
    }

    isSyncing = true;
    console.log(`[SYNC] Attempting to sync ${logs.length} cached logs with the cloud database...`);

    fetch('https://active-time-tracker-backend.onrender.com/api/activity/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ logs })
    })
    .then(res => res.json())
    .then(data => {
      isSyncing = false;
      if (data.success) {
        console.log(`[SYNC] Ingested ${data.count} logs successfully in the cloud.`);
        
        // Safely filter and clean up successfully uploaded logs from local queue
        chrome.storage.local.get(['activityLogs'], (latestResult) => {
          const latestLogs = latestResult.activityLogs || [];
          const remainingLogs = latestLogs.filter(latestLog => {
            return !logs.some(syncedLog => 
              syncedLog.domain === latestLog.domain && 
              syncedLog.startTime === latestLog.startTime
            );
          });

          chrome.storage.local.set({ activityLogs: remainingLogs }, () => {
            console.log(`[SYNC] Offline sync queue cleaned up. Remaining items in queue: ${remainingLogs.length}`);
          });
        });
      } else {
        console.warn(`[SYNC] Cloud server rejected ingestion:`, data.message);
      }
    })
    .catch(err => {
      isSyncing = false;
      console.warn(`[SYNC] Cloud server unreachable. Logs safely cached locally:`, err.message);
    });
  });
}

// Set up periodic cloud synchronization alarms
chrome.alarms.create('cloud-sync', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cloud-sync') {
    syncLogsWithCloud();
  }
});

console.log("Background Service Worker Initialized.");
