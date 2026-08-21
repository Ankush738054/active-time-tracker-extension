// popup.js - Real-Time Dashboard Controller

document.addEventListener('DOMContentLoaded', () => {
  // Establish persistent port connection to keep background tracking active while popup is open
  chrome.runtime.connect({ name: 'popup' });

  const statusContainer = document.getElementById('status-container');
  const statusText = document.getElementById('status-text');
  const domainText = document.getElementById('current-domain');
  const todayTotalText = document.getElementById('today-total');
  const topSiteText = document.getElementById('top-site');

  // Helper to format seconds to "Xh Ym" or "Zm"
  function formatDurationTotal(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${remainingMins}m`;
    }
    return `${mins}m`;
  }

  // Primary routine to fetch logs and update the popup interface
  function updatePopup() {
    chrome.storage.local.get(['activityLogs', 'activeSession'], (result) => {
      const logs = result.activityLogs || [];
      const session = result.activeSession;

      // 1. Identify Today's boundaries (midnight local time)
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      // Filter local storage logs recorded today
      const todayLogs = logs.filter(log => new Date(log.startTime).getTime() >= startOfToday);

      // Group logs by domain to aggregate total time spent on each site today
      const domainDurations = {};
      let totalSecondsToday = 0;

      todayLogs.forEach(log => {
        domainDurations[log.domain] = (domainDurations[log.domain] || 0) + log.duration;
        totalSecondsToday += log.duration;
      });

      // 2. Incorporate ongoing active session (if exists and is trackable)
      let activeSessionDuration = 0;
      let activeDomain = null;

      if (session && session.domain && session.startTime) {
        activeDomain = session.domain;
        activeSessionDuration = Math.floor((Date.now() - session.startTime) / 1000);

        // Add running duration to today's statistics
        domainDurations[activeDomain] = (domainDurations[activeDomain] || 0) + activeSessionDuration;
        totalSecondsToday += activeSessionDuration;
      }

      // 3. Identify Top Website for today
      let topDomain = 'None';
      let maxDuration = 0;

      for (const [domain, duration] of Object.entries(domainDurations)) {
        if (duration > maxDuration) {
          maxDuration = duration;
          topDomain = domain;
        }
      }

      // 4. Render calculations to UI elements
      todayTotalText.textContent = formatDurationTotal(totalSecondsToday);
      topSiteText.textContent = topDomain;

      if (activeDomain) {
        domainText.textContent = activeDomain;

        // UI styling for active tracking state (cyan theme)
        statusText.textContent = 'Tracking';
        statusContainer.style.background = 'rgba(56, 189, 248, 0.1)';
        statusContainer.style.borderColor = 'rgba(56, 189, 248, 0.2)';
        statusContainer.style.color = '#38bdf8';
        document.querySelector('.status-dot').style.backgroundColor = '#38bdf8';
        document.querySelector('.status-dot').style.boxShadow = '0 0 8px #38bdf8';
      } else {
        domainText.textContent = 'None';

        // UI styling for idle/inactive state (slate/grey theme)
        statusText.textContent = 'Idle';
        statusContainer.style.background = 'rgba(148, 163, 184, 0.1)';
        statusContainer.style.borderColor = 'rgba(148, 163, 184, 0.2)';
        statusContainer.style.color = '#94a3b8';
        document.querySelector('.status-dot').style.backgroundColor = '#94a3b8';
        document.querySelector('.status-dot').style.boxShadow = 'none';
      }
    });
  }

  // Run immediate update, then bind 1-second refresh interval
  updatePopup();
  setInterval(updatePopup, 1000);
});
