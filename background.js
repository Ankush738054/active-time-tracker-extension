// background.js - Phase 2: Active Tab Detection

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

// Track and print active tab changes
async function handleTabChange(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url) return;
    
    const domain = normalizeDomain(tab.url);
    if (domain) {
      console.log(`[ACTIVE TAB] ID: ${tabId} | Domain: ${domain} (Original: ${tab.url})`);
    } else {
      console.log(`[ACTIVE TAB] ID: ${tabId} | Non-trackable URL (Original: ${tab.url})`);
    }
  } catch (error) {
    console.error(`Error retrieving tab info: ${error}`);
  }
}

// Listen for tab activation (user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log(`Tab activated. Active Info:`, activeInfo);
  handleTabChange(activeInfo.tabId);
});

// Listen for tab updates (navigation in current tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    console.log(`Tab updated. ID: ${tabId} | URL changed to: ${changeInfo.url}`);
    handleTabChange(tabId);
  }
});

console.log("Background Service Worker Initialized.");
