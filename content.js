// content.js - Sync login credentials from web dashboard to extension in real-time
try {
  localStorage.setItem('active_extension_version', chrome.runtime.getManifest().version);
} catch (e) {
  // Gracefully ignore
}

function syncAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      chrome.runtime.sendMessage({
        action: 'sync_auth',
        token,
        user
      }, (response) => {
        // Suppress message response errors if channel closes
        if (chrome.runtime.lastError) {
          // Gracefully ignore
        }
      });
    } catch (e) {
      console.error('[ActiveTime Sync] Error parsing user details:', e);
    }
  } else {
    // Clear credentials inside extension storage if user logged out on the dashboard
    chrome.runtime.sendMessage({
      action: 'clear_auth'
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Gracefully ignore
      }
    });
  }
}

// Perform initial check on dashboard load
syncAuth();

// Listen for local window storage events to capture logins or logouts in real-time
window.addEventListener('storage', (e) => {
  if (e.key === 'token' || e.key === 'user') {
    syncAuth();
  }
});

// Setup a fallback interval check to synchronize SPA layout route changes
setInterval(syncAuth, 3000);
