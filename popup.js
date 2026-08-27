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
  const dashboardBtn = document.getElementById('dashboard-btn');
  const otpGroup = document.getElementById('otp-group');
  const authOtp = document.getElementById('auth-otp');
  const authResendLink = document.getElementById('auth-resend-link');

  const DEV_MODE = true; // Toggle to true for local testing, false for production Render server
  const BASE_URL = DEV_MODE ? 'http://localhost:5000/api' : 'https://active-time-tracker-backend.onrender.com/api';
  const API_URL = `${BASE_URL}/auth`;
  const STATS_URL = `${BASE_URL}/activity/stats?range=today`;
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


  }

  // Toggle Auth Modes (Login / Register)
  authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    resetAuthForm();



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
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const dashboardUrl = DEV_MODE ? 'http://localhost:5000' : 'https://active-time-tracker-backend.onrender.com';
      chrome.tabs.create({ url: dashboardUrl });
    });
  }

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

    // Manual validations to replace native HTML validation blocks
    if (!emailVal) {
      authErrorMsg.textContent = 'Please enter your email address';
      authErrorMsg.style.display = 'block';
      return;
    }

    if (!passwordVal) {
      authErrorMsg.textContent = 'Please enter your password';
      authErrorMsg.style.display = 'block';
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

  // Tab Switching Logic
  const tabBtnAnalytics = document.getElementById('tab-btn-analytics');
  const tabBtnTasks = document.getElementById('tab-btn-tasks');
  const viewAnalytics = document.getElementById('view-analytics');
  const viewTasks = document.getElementById('view-tasks');

  if (tabBtnAnalytics && tabBtnTasks && viewAnalytics && viewTasks) {
    tabBtnAnalytics.addEventListener('click', () => {
      tabBtnAnalytics.classList.add('active');
      tabBtnTasks.classList.remove('active');
      viewAnalytics.classList.add('active');
      viewTasks.classList.remove('active');
    });

    tabBtnTasks.addEventListener('click', () => {
      tabBtnTasks.classList.add('active');
      tabBtnAnalytics.classList.remove('active');
      viewTasks.classList.add('active');
      viewAnalytics.classList.remove('active');
      fetchTasks(); // Load tasks when switching to task tab
    });
  }

  // Task Element Bindings
  const taskAddForm = document.getElementById('task-add-form');
  const taskNewInput = document.getElementById('task-new-input');
  const tasksList = document.getElementById('tasks-list');
  const tasksProgressText = document.getElementById('tasks-progress-text');
  const tasksProgressBar = document.getElementById('tasks-progress-bar');

  let tasksData = [];

  // Fetch all tasks
  function fetchTasks() {
    console.log('[TASKS] Fetching tasks...');
    chrome.storage.local.get(['token', 'local_tasks', 'task_order_today'], (result) => {
      const token = result.token;
      const localTasks = result.local_tasks || [];
      const taskOrder = result.task_order_today || [];
      console.log('[TASKS] Logged in:', token ? 'Yes' : 'No', '| Local tasks cached:', localTasks.length, '| Order size:', taskOrder.length);

      if (token) {
        chrome.runtime.sendMessage({ action: 'fetch_tasks', token }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[TASKS] fetch_tasks sendMessage error:', chrome.runtime.lastError.message);
            // Fallback to local tasks
            tasksData = localTasks;
            // Sort local tasks
            if (taskOrder.length > 0) {
              tasksData.sort((a, b) => {
                const idA = a._id || a.tempId;
                const idB = b._id || b.tempId;
                const idxA = taskOrder.indexOf(idA);
                const idxB = taskOrder.indexOf(idB);
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
              });
            }
            renderTasks();
            return;
          }

          console.log('[TASKS] fetch_tasks response received:', response);
          if (response && response.success && response.data) {
            tasksData = response.data;
            // Filter for today's tasks in local time
            const todayStr = new Date().toLocaleDateString('en-CA');
            tasksData = tasksData.filter(t => t.dateString === todayStr);

            // Sort tasks by priority order
            if (taskOrder.length > 0) {
              tasksData.sort((a, b) => {
                const idA = a._id || a.tempId;
                const idB = b._id || b.tempId;
                const idxA = taskOrder.indexOf(idA);
                const idxB = taskOrder.indexOf(idB);
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
              });
            }

            console.log('[TASKS] Filtered today tasks count:', tasksData.length);
            renderTasks();
          } else {
            console.warn('[TASKS] fetch_tasks failed on server, fallback to local');
            tasksData = localTasks;
            if (taskOrder.length > 0) {
              tasksData.sort((a, b) => {
                const idA = a._id || a.tempId;
                const idB = b._id || b.tempId;
                const idxA = taskOrder.indexOf(idA);
                const idxB = taskOrder.indexOf(idB);
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
              });
            }
            renderTasks();
          }
        });
      } else {
        // Not logged in: show local tasks sorted
        tasksData = localTasks;
        if (taskOrder.length > 0) {
          tasksData.sort((a, b) => {
            const idA = a._id || a.tempId;
            const idB = b._id || b.tempId;
            const idxA = taskOrder.indexOf(idA);
            const idxB = taskOrder.indexOf(idB);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
        }
        renderTasks();
      }
    });
  }

  // Render tasks in popup
  function renderTasks() {
    if (!tasksList) return;
    console.log('[TASKS] Rendering list with item count:', tasksData.length);

    if (tasksData.length === 0) {
      tasksList.innerHTML = '<li class="task-empty-state">No tasks created for today</li>';
      if (tasksProgressText) tasksProgressText.textContent = '0/0 completed';
      if (tasksProgressBar) tasksProgressBar.style.width = '0%';
      return;
    }

    const completedCount = tasksData.filter(t => t.completed).length;
    const totalCount = tasksData.length;
    const progressPct = Math.round((completedCount / totalCount) * 100);

    if (tasksProgressText) {
      tasksProgressText.textContent = `${completedCount}/${totalCount} completed`;
    }
    if (tasksProgressBar) {
      tasksProgressBar.style.width = `${progressPct}%`;
    }

    let html = '';
    tasksData.forEach(task => {
      html += `
        <li class="task-item ${task.completed ? 'completed' : ''}" data-id="${task._id || task.tempId}" draggable="true">
          <label class="task-checkbox-container">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <span class="task-text">${escapeHtml(task.text)}</span>
          </label>
          <div class="task-actions">
            <button type="button" class="btn-edit-task" title="Edit Task">✏️</button>
            <button type="button" class="btn-delete-task" title="Delete Task">&times;</button>
          </div>
        </li>
      `;
    });
    tasksList.innerHTML = html;

    // Attach list event listeners (complete & delete & drag/drop)
    const items = tasksList.querySelectorAll('.task-item');
    let dragSrcEl = null;

    items.forEach(item => {
      const id = item.getAttribute('data-id');
      const checkbox = item.querySelector('.task-checkbox');
      const deleteBtn = item.querySelector('.btn-delete-task');
      const editBtn = item.querySelector('.btn-edit-task');

      if (checkbox) {
        checkbox.addEventListener('change', () => {
          toggleTask(id, checkbox.checked);
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          deleteTask(id);
        });
      }

      if (editBtn) {
        editBtn.addEventListener('click', () => {
          const isEditing = item.classList.toggle('editing-mode');
          const taskObj = tasksData.find(t => (t._id === id || t.tempId === id));
          if (!taskObj) return;

          if (isEditing) {
            const textSpan = item.querySelector('.task-text');
            const currentText = taskObj.text;
            textSpan.innerHTML = `<input type="text" class="task-edit-input" value="${escapeHtml(currentText)}" maxlength="60">`;
            editBtn.textContent = '💾';
            const input = textSpan.querySelector('.task-edit-input');
            input.focus();
            input.select();
            
            input.addEventListener('keydown', (ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault();
                saveEdit(id, input.value.trim());
              } else if (ev.key === 'Escape') {
                renderTasks();
              }
            });
          } else {
            const input = item.querySelector('.task-edit-input');
            if (input) {
              saveEdit(id, input.value.trim());
            }
          }
        });
      }

      // Drag events
      item.addEventListener('dragstart', function(e) {
        dragSrcEl = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
      });

      item.addEventListener('dragover', function(e) {
        if (e.preventDefault) {
          e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
      });

      item.addEventListener('dragenter', function(e) {
        if (dragSrcEl !== this) {
          this.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', function(e) {
        this.classList.remove('drag-over');
      });

      item.addEventListener('drop', function(e) {
        e.stopPropagation();
        e.preventDefault();
        this.classList.remove('drag-over');

        if (dragSrcEl !== this) {
          const draggedId = e.dataTransfer.getData('text/plain');
          const targetId = this.getAttribute('data-id');

          const draggedIndex = tasksData.findIndex(t => (t._id === draggedId || t.tempId === draggedId));
          const targetIndex = tasksData.findIndex(t => (t._id === targetId || t.tempId === targetId));

          if (draggedIndex !== -1 && targetIndex !== -1) {
            // Swap items in memory array
            const [draggedItem] = tasksData.splice(draggedIndex, 1);
            tasksData.splice(targetIndex, 0, draggedItem);
            
            // Save custom priority order to storage
            const orderedIds = tasksData.map(t => t._id || t.tempId);
            chrome.storage.local.set({ task_order_today: orderedIds }, () => {
              renderTasks();
            });
          }
        }
        return false;
      });

      item.addEventListener('dragend', function(e) {
        this.classList.remove('dragging');
        items.forEach(it => it.classList.remove('drag-over'));
      });
    });
  }

  // Helper to escape HTML tags
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // Add Task
  if (taskAddForm && taskNewInput) {
    console.log('[TASKS] Bound task add form submit listener');
    taskAddForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = taskNewInput.value.trim();
      console.log('[TASKS] Adding new task:', text);
      if (!text) return;

      taskNewInput.value = '';

      chrome.storage.local.get(['token', 'local_tasks'], (result) => {
        const token = result.token;
        const localTasks = result.local_tasks || [];
        const todayStr = new Date().toLocaleDateString('en-CA');

        if (token) {
          console.log('[TASKS] Sending create_task to background worker...');
          chrome.runtime.sendMessage({
            action: 'create_task',
            token,
            payload: { text, dateString: todayStr }
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('[TASKS] create_task sendMessage error:', chrome.runtime.lastError.message);
            } else {
              console.log('[TASKS] create_task response:', response);
            }
            fetchTasks();
          });
        } else {
          // Offline local fallback
          console.log('[TASKS] Saving task locally (offline fallback)...');
          const newTask = {
            tempId: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            text,
            completed: false,
            dateString: todayStr
          };
          localTasks.push(newTask);
          chrome.storage.local.set({ local_tasks: localTasks }, () => {
            tasksData = localTasks;
            renderTasks();
          });
        }
      });
    });
  }

  // Toggle Task Completed
  function toggleTask(id, completed) {
    console.log('[TASKS] Toggling task:', id, '| completed:', completed);
    chrome.storage.local.get(['token', 'local_tasks'], (result) => {
      const token = result.token;
      let localTasks = result.local_tasks || [];

      // Update in memory first
      const taskObj = tasksData.find(t => (t._id === id || t.tempId === id));
      if (taskObj) taskObj.completed = completed;
      renderTasks();

      if (token && !id.startsWith('temp_')) {
        chrome.runtime.sendMessage({
          action: 'update_task',
          token,
          taskId: id,
          payload: { completed }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[TASKS] update_task sendMessage error:', chrome.runtime.lastError.message);
          }
          fetchTasks();
        });
      } else {
        // Offline / Local
        localTasks = localTasks.map(t => {
          if (t._id === id || t.tempId === id) {
            t.completed = completed;
          }
          return t;
        });
        chrome.storage.local.set({ local_tasks: localTasks }, () => {
          fetchTasks();
        });
      }
    });
  }

  // Delete Task
  function deleteTask(id) {
    console.log('[TASKS] Deleting task:', id);
    chrome.storage.local.get(['token', 'local_tasks'], (result) => {
      const token = result.token;
      let localTasks = result.local_tasks || [];

      // Remove from memory
      tasksData = tasksData.filter(t => (t._id !== id && t.tempId !== id));
      renderTasks();

      if (token && !id.startsWith('temp_')) {
        chrome.runtime.sendMessage({
          action: 'delete_task',
          token,
          taskId: id
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[TASKS] delete_task sendMessage error:', chrome.runtime.lastError.message);
          }
          fetchTasks();
        });
      } else {
        // Offline / Local
        localTasks = localTasks.filter(t => (t._id !== id && t.tempId !== id));
        chrome.storage.local.set({ local_tasks: localTasks }, () => {
          fetchTasks();
        });
      }
    });
  }

  // Save edited task
  function saveEdit(id, newText) {
    if (!newText) return;
    console.log('[TASKS] Saving edited task:', id, 'new text:', newText);
    chrome.storage.local.get(['token', 'local_tasks'], (result) => {
      const token = result.token;
      let localTasks = result.local_tasks || [];

      // Update in memory first
      const taskObj = tasksData.find(t => (t._id === id || t.tempId === id));
      if (taskObj) taskObj.text = newText;
      renderTasks();

      if (token && !id.startsWith('temp_')) {
        chrome.runtime.sendMessage({
          action: 'update_task',
          token,
          taskId: id,
          payload: { text: newText }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[TASKS] update_task sendMessage error:', chrome.runtime.lastError.message);
          }
          fetchTasks();
        });
      } else {
        // Offline / Local
        localTasks = localTasks.map(t => {
          if (t._id === id || t.tempId === id) {
            t.text = newText;
          }
          return t;
        });
        chrome.storage.local.set({ local_tasks: localTasks }, () => {
          fetchTasks();
        });
      }
    });
  }

  function updatePopup() {
    console.log('[POPUP] Running updatePopup refresh...');
    fetchCloudStats();
    fetchTasks();
    checkForUpdates();
  }

  function checkForUpdates() {
    const localVersion = chrome.runtime.getManifest().version;
    console.log('[UPDATE] Checking for extension updates. Local Version:', localVersion);
    chrome.runtime.sendMessage({ action: 'check_version' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[UPDATE] Version check failed or connection unreachable:', chrome.runtime.lastError.message);
        return;
      }
      if (!response || !response.success) {
        console.warn('[UPDATE] Version check returned unsuccessful state');
        return;
      }
      const data = response.data;
      if (data && data.latestVersion) {
        console.log('[UPDATE] Latest Version available on server:', data.latestVersion);
        if (data.latestVersion !== localVersion) {
          const banner = document.getElementById('popup-update-banner');
          const latestVerSpan = document.getElementById('popup-latest-ver');
          const updateLink = document.getElementById('popup-update-link');
          if (banner && latestVerSpan && updateLink) {
            latestVerSpan.textContent = data.latestVersion;
            updateLink.href = data.downloadUrl;
            banner.classList.remove('hidden');
          }
        } else {
          // Hide banner if local is up-to-date
          const banner = document.getElementById('popup-update-banner');
          if (banner) banner.classList.add('hidden');
        }
      }
    });
  }

  // Startup hooks
  updateAuthUI();
  fetchCloudStats();
  fetchTasks();
  checkForUpdates();
  setInterval(tick, 1000);
});
