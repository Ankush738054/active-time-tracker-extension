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

  // Renders the top 3 websites leaderboard list
  function renderTopSitesList(sortedSites) {
    if (!sortedSites || sortedSites.length === 0) {
      leaderboardList.innerHTML = '<div class="leaderboard-item empty">No sites tracked today</div>';
      return;
    }

    const top3 = sortedSites.slice(0, 3);
    let html = '';
    
    top3.forEach((site, index) => {
      html += `
        <div class="leaderboard-item">
          <div class="rank-domain">
            <span class="rank-num">#${index + 1}</span>
            <span class="domain-name" title="${site.domain}">${site.domain}</span>
          </div>
          <span class="time-spent">${formatDurationTotal(site.duration)}</span>
        </div>
      `;
    });
    leaderboardList.innerHTML = html;
  }

  // Local calculations helper (Fallback)
  function renderLocalStats(logs, session) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Filter local storage logs recorded today
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

    // Convert map to sorted array
    const sortedSites = Object.entries(domainDurations).map(([domain, duration]) => ({
      domain,
      duration
    })).sort((a, b) => b.duration - a.duration);

    todayTotalText.textContent = formatDurationTotal(totalSecondsToday);
    renderTopSitesList(sortedSites);
    renderTrackingState(activeDomain);
  }

  // Render tracking badges dynamically
  function renderTrackingState(activeDomain) {
    if (activeDomain) {
      domainText.textContent = activeDomain;
      statusText.textContent = 'Tracking';
      statusContainer.style.background = 'rgba(6, 182, 212, 0.15)';
      statusContainer.style.borderColor = 'rgba(6, 182, 212, 0.25)';
      statusContainer.style.color = '#06b6d4';
      document.querySelector('.status-dot').style.backgroundColor = '#06b6d4';
      document.querySelector('.status-dot').style.boxShadow = '0 0 8px #06b6d4';
    } else {
      domainText.textContent = 'None';
      statusText.textContent = 'Idle';
      statusContainer.style.background = 'rgba(148, 163, 184, 0.1)';
      statusContainer.style.borderColor = 'rgba(148, 163, 184, 0.2)';
      statusContainer.style.color = '#94a3b8';
      document.querySelector('.status-dot').style.backgroundColor = '#94a3b8';
      document.querySelector('.status-dot').style.boxShadow = 'none';
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
          if (data && data.success && data.summary) {
            let totalSecondsToday = data.summary.totalDuration;

            let activeSessionDuration = 0;
            let activeDomain = null;

            if (session && session.domain && session.startTime) {
              activeDomain = session.domain;
              activeSessionDuration = Math.floor((Date.now() - session.startTime) / 1000);
              
              // Include the ticking ongoing local session in real-time totals
              totalSecondsToday += activeSessionDuration;
            }

            // Map data.rankings (format {_id, totalDuration}) to client layout format ({domain, duration})
            let cloudSites = (data.rankings || []).map(item => ({
              domain: item._id,
              duration: item.totalDuration
            }));

            // Include ongoing local session in rankings listing dynamically
            if (activeDomain && activeSessionDuration > 0) {
              const existingIndex = cloudSites.findIndex(item => item.domain === activeDomain);
              if (existingIndex !== -1) {
                cloudSites[existingIndex].duration += activeSessionDuration;
              } else {
                cloudSites.push({ domain: activeDomain, duration: activeSessionDuration });
              }
              // Re-sort descending
              cloudSites.sort((a, b) => b.duration - a.duration);
            }

            todayTotalText.textContent = formatDurationTotal(totalSecondsToday);
            renderTopSitesList(cloudSites);
            renderTrackingState(activeDomain);
          } else {
            // Fallback to local
            renderLocalStats(logs, session);
          }
        });
      } else {
        // Fallback to local offline stats
        renderLocalStats(logs, session);
      }
    });
  }

  // Load active sessions on open
  updateAuthUI();
  updatePopup();
  setInterval(updatePopup, 1000);
});
