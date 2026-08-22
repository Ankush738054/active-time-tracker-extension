// popup.js - Real-Time Dashboard Controller

document.addEventListener('DOMContentLoaded', () => {
  // Establish persistent port connection to keep background tracking active while popup is open
  chrome.runtime.connect({ name: 'popup' });

  // DOM Elements
  const statusContainer = document.getElementById('status-container');
  const statusText = document.getElementById('status-text');
  const domainText = document.getElementById('current-domain');
  const todayTotalText = document.getElementById('today-total');
  const leaderboardList = document.getElementById('leaderboard-list');

  // Auth DOM Elements
  const cloudToggleBtn = document.getElementById('cloud-toggle-btn');
  const authPanel = document.getElementById('auth-panel');
  const authCloseBtn = document.getElementById('auth-close-btn');
  const authForm = document.getElementById('auth-form');
  const authTitle = document.getElementById('auth-title');
  const usernameGroup = document.getElementById('username-group');
  const regUsername = document.getElementById('reg-username');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authErrorMsg = document.getElementById('auth-error-msg');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authToggleLink = document.getElementById('auth-toggle-link');
  const authToggleMsg = document.getElementById('auth-toggle-msg');
  const profileContainer = document.getElementById('profile-container');
  const profileUsername = document.getElementById('profile-username');
  const logoutBtn = document.getElementById('logout-btn');
  const dashboardLink = document.getElementById('dashboard-link');

  const API_URL = 'https://active-time-tracker-backend.onrender.com/api/auth';
  const STATS_URL = 'https://active-time-tracker-backend.onrender.com/api/activity/stats?range=today';
  let authMode = 'login';

  // Toggle Auth Modes (Login / Register)
  authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    authErrorMsg.style.display = 'none';
    authForm.reset();

    if (authMode === 'login') {
      authMode = 'register';
      authTitle.textContent = 'Register';
      usernameGroup.style.display = 'flex';
      authSubmitBtn.textContent = 'Register';
      authToggleMsg.textContent = 'Already have an account?';
      authToggleLink.textContent = 'Log In';
    } else {
      authMode = 'login';
      authTitle.textContent = 'Log In';
      usernameGroup.style.display = 'none';
      authSubmitBtn.textContent = 'Log In';
      authToggleMsg.textContent = "Don't have an account?";
      authToggleLink.textContent = 'Register';
    }
  });

  // Open / Close Auth Overlays
  cloudToggleBtn.addEventListener('click', () => {
    authErrorMsg.style.display = 'none';
    authForm.reset();
    authPanel.classList.add('open');
  });

  authCloseBtn.addEventListener('click', () => {
    authPanel.classList.remove('open');
  });

  // Open Full Web Dashboard in New Browser Tab
  dashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://active-time-tracker-backend.onrender.com' });
  });

  // Toggle Password Visibility Eye Button
  const togglePasswordBtn = document.getElementById('toggle-password-btn');
  togglePasswordBtn.addEventListener('click', () => {
    const type = authPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    authPassword.setAttribute('type', type);
    togglePasswordBtn.textContent = type === 'password' ? '👁️' : '🙈';
  });

  // Submit Registration or Login Forms
  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    authErrorMsg.style.display = 'none';

    const emailVal = authEmail.value.trim();
    const passwordVal = authPassword.value;
    const usernameVal = regUsername.value.trim();

    if (authMode === 'register' && !usernameVal) {
      authErrorMsg.textContent = 'Please enter a username';
      authErrorMsg.style.display = 'block';
      return;
    }

    const payload = authMode === 'register'
      ? { username: usernameVal, email: emailVal, password: passwordVal }
      : { email: emailVal, password: passwordVal };

    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = authMode === 'register' ? 'Registering...' : 'Logging in...';

    chrome.runtime.sendMessage({ action: authMode, payload }, (data) => {
      authSubmitBtn.disabled = false;
      authSubmitBtn.textContent = authMode === 'register' ? 'Register' : 'Log In';

      if (data && data.success) {
        // Save credentials to local storage
        chrome.storage.local.set({ token: data.token, user: data.user }, () => {
          authPanel.classList.remove('open');
          updateAuthUI();
          updatePopup();
        });
      } else {
        authErrorMsg.textContent = (data && data.message) || 'Authentication failed';
        authErrorMsg.style.display = 'block';
      }
    });
  });

  // Logout Button Action
  logoutBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['token', 'user'], () => {
      updateAuthUI();
      updatePopup();
    });
  });

  // Render Account state dynamically
  function updateAuthUI() {
    chrome.storage.local.get(['token', 'user'], (result) => {
      if (result.token && result.user) {
        cloudToggleBtn.style.display = 'none';
        profileContainer.style.display = 'flex';
        profileUsername.textContent = result.user.username;
      } else {
        cloudToggleBtn.style.display = 'block';
        profileContainer.style.display = 'none';
      }
    });
  }

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

  // Helper to format seconds to "Xh Ym Zs" or "Ym Zs" or "Zs"
  function formatDurationLive(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }

  // Domain Categorization Classifier
  function getCategoryTag(domain) {
    const d = domain.toLowerCase();
    if (d.includes('github') || d.includes('stackoverflow') || d.includes('leet') || d.includes('docs') || d.includes('gitlab') || d.includes('medium') || d.includes('npm')) {
      return '<span class="category-pill focus">Focus</span>';
    }
    if (d.includes('gmail') || d.includes('google') || d.includes('meet') || d.includes('zoom') || d.includes('slack') || d.includes('teams') || d.includes('outlook') || d.includes('render')) {
      return '<span class="category-pill work">Work</span>';
    }
    if (d.includes('youtube') || d.includes('netflix') || d.includes('facebook') || d.includes('instagram') || d.includes('twitter') || d.includes('reddit') || d.includes('spotify') || d.includes('tiktok') || d.includes('pinterest')) {
      return '<span class="category-pill distraction">Distract</span>';
    }
    return '<span class="category-pill utility">Utility</span>';
  }

  // Renders the top 3 websites leaderboard list
  function renderTopSitesList(sortedSites) {
    if (!sortedSites || sortedSites.length === 0) {
      leaderboardList.innerHTML = '<div class="leaderboard-item empty">No sites tracked today</div>';
      return;
    }

    const top3 = sortedSites.slice(0, 3);
    let html = '';
    
    top3.forEach((site, index) => {
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`;
      html += `
        <div class="leaderboard-item">
          <div class="rank-domain">
            <span class="rank-num">#${index + 1}</span>
            <img class="favicon-img" src="${faviconUrl}" onerror="this.src='https://www.google.com/s2/favicons?domain=google.com&sz=32'" alt="Favicon">
            <span class="domain-name" title="${site.domain}">${site.domain}</span>
          </div>
          <div class="right-content">
            <span class="time-spent">${formatDurationTotal(site.duration)}</span>
          </div>
        </div>
      `;
    });
    leaderboardList.innerHTML = html;
  }

  // Renders a 24-Hour activity distribution heat strip (Capped at 3600s per hour to handle outliers)
  function renderHeatStrip(logs, session, cloudHourlyStats) {
    const heatStripBars = document.getElementById('heat-strip-bars');
    if (!heatStripBars) return;

    const hourlySeconds = Array(24).fill(0);

    if (cloudHourlyStats && Array.isArray(cloudHourlyStats)) {
      cloudHourlyStats.forEach(item => {
        const hr = parseInt(item._id, 10);
        if (hr >= 0 && hr < 24) {
          hourlySeconds[hr] = item.totalDuration;
        }
      });
    } else {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const todayLogs = logs.filter(log => new Date(log.startTime).getTime() >= startOfToday);

      todayLogs.forEach(log => {
        const hr = new Date(log.startTime).getHours();
        if (hr >= 0 && hr < 24) {
          hourlySeconds[hr] += log.duration;
        }
      });
    }

    if (session && session.domain && session.startTime) {
      const startHr = new Date(session.startTime).getHours();
      if (startHr >= 0 && startHr < 24) {
        const sessionSecs = Math.floor((Date.now() - session.startTime) / 1000);
        hourlySeconds[startHr] += sessionSecs;
      }
    }

    // Cap each hour to maximum of 3600 seconds to prevent tracking outliers from breaking vertical scale
    for (let i = 0; i < 24; i++) {
      hourlySeconds[i] = Math.min(3600, hourlySeconds[i]);
    }

    const maxHourSecs = Math.min(3600, Math.max(...hourlySeconds));
    let html = '';
    for (let i = 0; i < 24; i++) {
      const secs = hourlySeconds[i];
      const pct = maxHourSecs > 0 ? (secs / maxHourSecs) * 100 : 0;
      const isActiveClass = secs > 0 ? 'active' : '';
      const displayMins = Math.round(secs / 60);
      const titleAttr = `title="${i}h: ${displayMins}m tracked"`;
      html += `<div class="heat-bar ${isActiveClass}" ${titleAttr} style="height: ${Math.max(2, (pct / 100) * 24)}px;"></div>`;
    }
    heatStripBars.innerHTML = html;
  }

  // Local calculations helper (Fallback)
  function renderLocalStats(logs, session) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const todayLogs = logs.filter(log => new Date(log.startTime).getTime() >= startOfToday);

    const domainDurations = {};
    let totalSecondsToday = 0;

    todayLogs.forEach(log => {
      domainDurations[log.domain] = (domainDurations[log.domain] || 0) + log.duration;
      totalSecondsToday += log.duration;
    });

    let activeSessionDuration = 0;
    let activeDomain = null;

    if (session && session.domain && session.startTime) {
      activeDomain = session.domain;
      activeSessionDuration = Math.floor((Date.now() - session.startTime) / 1000);

      domainDurations[activeDomain] = (domainDurations[activeDomain] || 0) + activeSessionDuration;
      totalSecondsToday += activeSessionDuration;
    }

    const sortedSites = Object.entries(domainDurations).map(([domain, duration]) => ({
      domain,
      duration
    })).sort((a, b) => b.duration - a.duration);

    todayTotalText.textContent = formatDurationTotal(totalSecondsToday);
    renderTopSitesList(sortedSites);
    renderTrackingState(activeDomain, activeSessionDuration, totalSecondsToday);
  }

  // Render tracking badges dynamically
  function renderTrackingState(activeDomain, activeSessionDuration, totalSecondsToday) {
    const statusContainer = document.getElementById('status-container');
    const statusText = document.getElementById('status-text');
    const domainText = document.getElementById('current-domain');
    const liveSessionFavicon = document.getElementById('live-session-favicon');
    const liveSessionTimer = document.getElementById('live-session-timer');
    const gaugeFill = document.getElementById('gauge-fill');

    if (gaugeFill) {
      const targetHoursInSecs = 8 * 3600; // 8 Hours Daily Goal
      const fraction = Math.min(1, totalSecondsToday / targetHoursInSecs);
      const strokeDashoffset = 188.5 - (fraction * 188.5);
      gaugeFill.setAttribute('stroke-dashoffset', strokeDashoffset);
    }

    if (activeDomain) {
      if (statusContainer) statusContainer.classList.add('live');
      if (statusText) statusText.textContent = 'Live Tracking';
      if (domainText) domainText.textContent = activeDomain;
      if (liveSessionTimer) liveSessionTimer.innerHTML = `<span class="time">${formatDurationLive(activeSessionDuration)}</span>`;
      if (liveSessionFavicon) {
        liveSessionFavicon.src = `https://www.google.com/s2/favicons?domain=${activeDomain}&sz=32`;
      }
    } else {
      if (statusContainer) statusContainer.classList.remove('live');
      if (statusText) statusText.textContent = 'Idle';
      if (domainText) domainText.textContent = 'None';
      if (liveSessionTimer) liveSessionTimer.innerHTML = `<span class="time">0s</span>`;
      if (liveSessionFavicon) {
        liveSessionFavicon.src = `https://www.google.com/s2/favicons?domain=google.com&sz=32`;
      }
    }
  }

  // Primary routine to fetch logs and update the popup interface
  function updatePopup() {
    chrome.storage.local.get(['activityLogs', 'activeSession', 'token'], (result) => {
      const logs = result.activityLogs || [];
      const session = result.activeSession;
      const token = result.token;

      if (token) {
        chrome.runtime.sendMessage({ action: 'fetch_stats', token }, (data) => {
          if (data && data.success && data.todaySummary) {
            let totalSecondsToday = data.todaySummary.totalDuration;

            let activeSessionDuration = 0;
            let activeDomain = null;

            if (session && session.domain && session.startTime) {
              activeDomain = session.domain;
              activeSessionDuration = Math.floor((Date.now() - session.startTime) / 1000);
              totalSecondsToday += activeSessionDuration;
            }

            let cloudSites = (data.todayRankings || []).map(item => ({
              domain: item._id,
              duration: item.totalDuration
            }));

            if (activeDomain && activeSessionDuration > 0) {
              const existingIndex = cloudSites.findIndex(item => item.domain === activeDomain);
              if (existingIndex !== -1) {
                cloudSites[existingIndex].duration += activeSessionDuration;
              } else {
                cloudSites.push({ domain: activeDomain, duration: activeSessionDuration });
              }
              cloudSites.sort((a, b) => b.duration - a.duration);
            }

            todayTotalText.textContent = formatDurationTotal(totalSecondsToday);
            renderTopSitesList(cloudSites);
            renderTrackingState(activeDomain, activeSessionDuration, totalSecondsToday);
            renderHeatStrip(logs, session, data.todayHourlyTimeline);
          } else {
            renderLocalStats(logs, session);
            renderHeatStrip(logs, session, null);
          }
        });
      } else {
        renderLocalStats(logs, session);
        renderHeatStrip(logs, session, null);
      }
    });
  }

  // Load active sessions on open
  updateAuthUI();
  updatePopup();
  setInterval(updatePopup, 1000);
});
