# ActiveTime Tracker Extension 📊

A modern, cross-browser website activity tracking extension that dynamically monitors your active browsing time and synchronizes telemetry in real-time under a single user account.

Designed with glassmorphic aesthetics, this extension runs in the background of **Chrome, Brave, and Edge** to analyze your digital focus footprint.

---

## Key Features 🚀

- **Cross-Browser Sync**: Track time across Brave, Chrome, and Edge, and view consolidated statistics under one account.
- **Smart Focus Tracking**: Only tracks the tab you are actively focusing on.
- **Audible Background Bypass**: Tracks media tabs (like YouTube or music players) even if they are in the background, provided they are audible.
- **Self-Healing Focus Safeties**: Pauses tracking within 2 seconds if you switch to another OS window (e.g., VS Code or Discord) or lock your system.
- **Idle Safeguard**: Pauses tracking if you go away from your computer (60-second idle detection threshold) and retroactively deducts the idle buffer.
- **Offline Ingestion Queue**: If you lose internet connection, your logs are safely queued in local storage and synced automatically when you go online.
- **Web Analytics Dashboard**: Access a full analytics dashboard displaying detailed timelines, browser distributions, and ranked leaderboards.

---

## How to Install (For Free) 🛠️

Since this is a developer extension, you can install it on any Chromium browser without accessing the Web Store:

1.  **Download the Code**: Click **Code -> Download ZIP** on this repository and extract it on your computer.
2.  **Open Extensions Settings**:
    *   In Chrome, navigate to: `chrome://extensions`
    *   In Brave, navigate to: `brave://extensions`
    *   In Microsoft Edge, navigate to: `edge://extensions`
3.  **Enable Developer Mode**: Turn **ON** the "Developer Mode" toggle switch in the top-right corner of the extensions page.
4.  **Load the Extension**:
    *   Click the **Load unpacked** button in the top-left corner.
    *   Select the extracted `extension/` directory (the folder containing `manifest.json`).
5.  **Pin the Extension**: Click the puzzle icon 🧩 in your browser toolbar, and click the pin icon next to **ActiveTime**.

---

## How to Use ⏱️

### 1. Register or Log In
- Click the extension icon in your toolbar to open the popup dashboard.
- Click the **Sync to Cloud** button at the bottom.
- Toggle the form to **Register** to create an account, or **Log In** if you already have one.
- *Once logged in, your active times will automatically sync in the background!*

### 2. View your Stats
- **Today's Total**: Displays the sum of your active browsing time today.
- **Top Websites Today**: Shows a leaderboard list of your top 3 most-visited domains with minutes spent.
- **Detailed Analytics Dashboard**: Click the **`📊` (chart)** icon in the popup header to open the full dashboard page (`http://localhost:5000`) in a new tab!

---

## How it Tracks (Rules) 📏

- **Foreground Rule**: Tracking only occurs when the browser window is in focus and you are interacting with a tab.
- **Audio Rule**: If you play a video/audio (e.g. YouTube music) in a background tab, it will continue tracking that domain as `Passive Listening` until you pause it or mute the audio.
- **OS Window Rule**: If you click out of Chrome to write code or play a game, the extension pauses tracking immediately.
- **Idle Rule**: If you walk away from your desk for more than 60 seconds, the extension pauses and retroactively subtracts the idle 60 seconds from your total time.
