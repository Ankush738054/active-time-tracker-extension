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
  const otpGroup = document.getElementById('otp-group');
  const authOtp = document.getElementById('auth-otp');
  const authResendLink = document.getElementById('auth-resend-link');

  const API_URL = 'https://active-time-tracker-backend.onrender.com/api/auth';
  const STATS_URL = 'https://active-time-tracker-backend.onrender.com/api/activity/stats?range=today';
  let authMode = 'login';

  // Live memory states for local ticking and rendering
  let currentActiveDomain = null;
  let currentActiveSessionDuration = 0;
  let currentTotalSecondsToday = 0;
  let currentLeaderboardSites = [];
  let lastFetchTime = 0;
  let lastRenderedLeaderboardJSON = '';

  // Helper to reset auth form to initial state
  function resetAuthForm() {
    authErrorMsg.style.display = 'none';
    authErrorMsg.style.color = '#ef4444';
    authForm.reset();
    
    // Restore normal inputs visibility
    authEmail.parentElement.style.display = 'flex';
    const pwFormGroup = authPassword.closest('.form-group');
    if (pwFormGroup) pwFormGroup.style.display = 'flex';
    otpGroup.style.display = 'none';
    
    authMode = 'login';
    authTitle.textContent = 'Log In';
    usernameGroup.style.display = 'none';
    authSubmitBtn.textContent = 'Log In';
    authToggleMsg.textContent = "Don't have an account?";
    authToggleLink.textContent = 'Register';

    // Reset popup height to fit regular content
    document.body.style.height = 'auto';
    document.documentElement.style.height = 'auto';
  }

  // Toggle Auth Modes (Login / Register)
  authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    resetAuthForm();

    // Set height to expand for auth panel inputs
    document.body.style.height = '540px';
    document.documentElement.style.height = '540px';

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
    resetAuthForm();
    authPanel.classList.add('open');
    document.body.style.height = '540px';
    document.documentElement.style.height = '540px';
  });

  authCloseBtn.addEventListener('click', () => {
    authPanel.classList.remove('open');
    resetAuthForm();
  });

  // Resend OTP Action link inside verify-otp state
  authResendLink.addEventListener('click', (e) => {
    e.preventDefault();
    const emailVal = authEmail.value.trim();
    if (!emailVal) {
      authErrorMsg.textContent = 'Email address missing. Please close and try again.';
      authErrorMsg.style.color = '#ef4444';
      authErrorMsg.style.display = 'block';
      return;
    }

    authErrorMsg.textContent = 'Resending verification OTP code...';
    authErrorMsg.style.color = '#00F2FE';
    authErrorMsg.style.display = 'block';

    const payload = {
      username: regUsername.value.trim() || 'user',
      email: emailVal,
      password: authPassword.value || '123456'
    };

    chrome.runtime.sendMessage({ action: 'register', payload }, (data) => {
      if (data && data.success) {
        authErrorMsg.textContent = 'New verification code sent to your email!';
        authErrorMsg.style.color = '#00F2FE';
      } else {
        authErrorMsg.textContent = (data && data.message) || 'Failed to resend code';
        authErrorMsg.style.color = '#ef4444';
      }
    });
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

  // Submit Registration, Login or Verification forms
  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    authErrorMsg.style.display = 'none';
    authErrorMsg.style.color = '#ef4444'; // Default to red

    const emailVal = authEmail.value.trim();
    const passwordVal = authPassword.value;
    const usernameVal = regUsername.value.trim();
    const otpVal = authOtp.value.trim();

    if (authMode === 'verify-otp') {
      if (!otpVal || otpVal.length !== 6) {
        authErrorMsg.textContent = 'Please enter a valid 6-digit verification code';
        authErrorMsg.style.display = 'block';
        return;
      }

      authSubmitBtn.disabled = true;
      authSubmitBtn.textContent = 'Verifying...';

      chrome.runtime.sendMessage({
        action: 'verify-otp',
        payload: { email: emailVal, otp: otpVal }
      }, (data) => {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = 'Verify Code';

        if (data && data.success) {
          chrome.storage.local.set({ token: data.token, user: data.user }, () => {
            authPanel.classList.remove('open');
            resetAuthForm();
            updateAuthUI();
            updatePopup();
          });
        } else {
          authErrorMsg.textContent = (data && data.message) || 'OTP Verification failed';
          authErrorMsg.style.display = 'block';
        }
      });
      return;
    }

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
        if (data.needsVerification) {
          // Transition to OTP verification state
          authMode = 'verify-otp';
          authTitle.textContent = 'Verify Email';
          authSubmitBtn.textContent = 'Verify Code';
          usernameGroup.style.display = 'none';
          authEmail.parentElement.style.display = 'none';
          const pwFormGroup = authPassword.closest('.form-group');
          if (pwFormGroup) pwFormGroup.style.display = 'none';
          otpGroup.style.display = 'flex';

          authErrorMsg.textContent = data.message;
          authErrorMsg.style.color = '#00F2FE'; // Cyan info text
          authErrorMsg.style.display = 'block';
        } else {
          chrome.storage.local.set({ token: data.token, user: data.user }, () => {
            authPanel.classList.remove('open');
            resetAuthForm();
            updateAuthUI();
            updatePopup();
          });
        }
      } else {
        // Check if unverified user is trying to log in
        if (data && data.needsVerification) {
          authMode = 'verify-otp';
          authTitle.textContent = 'Verify Email';
          authSubmitBtn.textContent = 'Verify Code';
          usernameGroup.style.display = 'none';
          authEmail.parentElement.style.display = 'none';
          const pwFormGroup = authPassword.closest('.form-group');
          if (pwFormGroup) pwFormGroup.style.display = 'none';
          otpGroup.style.display = 'flex';

          authErrorMsg.textContent = data.message;
          authErrorMsg.style.color = '#00F2FE'; // Cyan info text
          authErrorMsg.style.display = 'block';
        } else {
          authErrorMsg.textContent = (data && data.message) || 'Authentication failed';
          authErrorMsg.style.display = 'block';
        }
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

  // Renders the top 5 websites leaderboard list (Only updates DOM if JSON content changes to prevent favicon blinking)
  function renderLeaderboard(sortedSites) {
    const top5 = (sortedSites || []).slice(0, 5);
    const currentJSON = JSON.stringify(top5);
    if (currentJSON === lastRenderedLeaderboardJSON) {
      return; // Skip rendering if list is unchanged
    }
    lastRenderedLeaderboardJSON = currentJSON;

    if (top5.length === 0) {
      leaderboardList.innerHTML = '<div class="leaderboard-item empty">No sites tracked today</div>';
      return;
    }

    let html = '';
    top5.forEach((site, index) => {
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

  // Render tracking badges and dial state dynamically without full DOM rebuilds
  function renderUI() {
    // 1. Today's Total Time
    if (todayTotalText) {
      todayTotalText.textContent = formatDurationTotal(currentTotalSecondsToday);
    }

    // 2. Gauge Arc Fill
    const gaugeFill = document.getElementById('gauge-fill');
    if (gaugeFill) {
      const targetHoursInSecs = 8 * 3600; // 8 Hours Goal
      const fraction = Math.min(1, currentTotalSecondsToday / targetHoursInSecs);
      const strokeDashoffset = 188.5 - (fraction * 188.5);
      gaugeFill.setAttribute('stroke-dashoffset', strokeDashoffset);
    }

    // 3. Live Session Details
    const liveSessionFavicon = document.getElementById('live-session-favicon');
    const liveSessionTimer = document.getElementById('live-session-timer');

    if (currentActiveDomain) {
      if (statusContainer && !statusContainer.classList.contains('live')) {
        statusContainer.classList.add('live');
        if (statusText) statusText.textContent = 'Live Tracking';
      }
      if (domainText && domainText.textContent !== currentActiveDomain) {
        domainText.textContent = currentActiveDomain;
      }
      if (liveSessionFavicon) {
        const targetSrc = `https://www.google.com/s2/favicons?domain=${currentActiveDomain}&sz=32`;
        if (liveSessionFavicon.getAttribute('data-domain') !== currentActiveDomain) {
          liveSessionFavicon.src = targetSrc;
          liveSessionFavicon.setAttribute('data-domain', currentActiveDomain);
        }
      }
      if (liveSessionTimer) {
        liveSessionTimer.textContent = formatDurationLive(currentActiveSessionDuration);
      }
    } else {
      if (statusContainer && statusContainer.classList.contains('live')) {
        statusContainer.classList.remove('live');
        if (statusText) statusText.textContent = 'Idle';
      }
      if (domainText && domainText.textContent !== 'None') {
        domainText.textContent = 'None';
      }
      if (liveSessionFavicon && liveSessionFavicon.getAttribute('data-domain') !== 'none') {
        liveSessionFavicon.src = `https://www.google.com/s2/favicons?domain=google.com&sz=32`;
        liveSessionFavicon.setAttribute('data-domain', 'none');
      }
      if (liveSessionTimer && liveSessionTimer.textContent !== '0s') {
        liveSessionTimer.textContent = '0s';
      }
    }
  }

  // Load offline fallback stats from local storage logs
  function loadLocalFallback(logs) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayLogs = logs.filter(log => new Date(log.startTime).getTime() >= startOfToday);

    const domainDurations = {};
    let totalSecondsToday = 0;

    todayLogs.forEach(log => {
      domainDurations[log.domain] = (domainDurations[log.domain] || 0) + log.duration;
      totalSecondsToday += log.duration;
    });

    if (currentActiveDomain) {
      domainDurations[currentActiveDomain] = (domainDurations[currentActiveDomain] || 0) + currentActiveSessionDuration;
      totalSecondsToday += currentActiveSessionDuration;
    }

    currentTotalSecondsToday = totalSecondsToday;
    currentLeaderboardSites = Object.entries(domainDurations).map(([domain, duration]) => ({
      domain,
      duration
    })).sort((a, b) => b.duration - a.duration);
  }

  // Async task to fetch cloud statistics from the Render database
  function fetchCloudStats() {
    chrome.storage.local.get(['activityLogs', 'activeSession', 'token'], (result) => {
      const logs = result.activityLogs || [];
      const session = result.activeSession;
      const token = result.token;

      lastFetchTime = Date.now();

      // Read active tracking state
      if (session && session.domain && session.startTime) {
        currentActiveDomain = session.domain;
        currentActiveSessionDuration = Math.floor((Date.now() - session.startTime) / 1000);
      } else {
        currentActiveDomain = null;
        currentActiveSessionDuration = 0;
      }

      if (token) {
        chrome.runtime.sendMessage({ action: 'fetch_stats', token }, (data) => {
          if (data && data.success && data.todaySummary) {
            currentTotalSecondsToday = data.todaySummary.totalDuration + currentActiveSessionDuration;

            let cloudSites = (data.todayRankings || []).map(item => ({
              domain: item._id,
              duration: item.totalDuration
            }));

            if (currentActiveDomain && currentActiveSessionDuration > 0) {
              const existingIndex = cloudSites.findIndex(item => item.domain === currentActiveDomain);
              if (existingIndex !== -1) {
                cloudSites[existingIndex].duration += currentActiveSessionDuration;
              } else {
                cloudSites.push({ domain: currentActiveDomain, duration: currentActiveSessionDuration });
              }
              cloudSites.sort((a, b) => b.duration - a.duration);
            }
            currentLeaderboardSites = cloudSites;
          } else {
            loadLocalFallback(logs);
          }
          renderUI();
          renderLeaderboard(currentLeaderboardSites);
        });
      } else {
        loadLocalFallback(logs);
        renderUI();
        renderLeaderboard(currentLeaderboardSites);
      }
    });
  }

  // 1-Second tick logic to increment active counters in memory and redraw UI values without flickering
  function tick() {
    if (currentActiveDomain) {
      currentActiveSessionDuration++;
      currentTotalSecondsToday++;

      const index = currentLeaderboardSites.findIndex(item => item.domain === currentActiveDomain);
      if (index !== -1) {
        currentLeaderboardSites[index].duration++;
        currentLeaderboardSites.sort((a, b) => b.duration - a.duration);
      } else {
        currentLeaderboardSites.push({ domain: currentActiveDomain, duration: 1 });
      }
    }

    renderUI();
    renderLeaderboard(currentLeaderboardSites);

    // Fetch fresh stats from server every 10 seconds
    if (Date.now() - lastFetchTime >= 10000) {
      fetchCloudStats();
    }
  }

  // Startup hooks
  updateAuthUI();
  fetchCloudStats();
  setInterval(tick, 1000);
});
