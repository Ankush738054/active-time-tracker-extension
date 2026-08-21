// popup.js - Basic mockup tracking logic
document.addEventListener('DOMContentLoaded', () => {
  const statusContainer = document.getElementById('status-container');
  const statusText = document.getElementById('status-text');
  const domainText = document.getElementById('current-domain');
  const timerText = document.getElementById('current-timer');
  const mockBtn = document.getElementById('mock-btn');

  let activeSeconds = 872; // Start with 14m 32s (872 seconds)
  let isTracking = true;
  let timerInterval = null;

  // Helper to format seconds to HH:MM:SS
  function formatTime(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }

  // Start incrementing timer
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      activeSeconds++;
      timerText.textContent = formatTime(activeSeconds);
    }, 1000);
  }

  // Stop incrementing timer
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Setup initial timer
  timerText.textContent = formatTime(activeSeconds);
  startTimer();

  // Handle mock interaction state toggles
  mockBtn.addEventListener('click', () => {
    isTracking = !isTracking;
    
    if (isTracking) {
      statusText.textContent = 'Tracking';
      statusContainer.style.background = 'rgba(56, 189, 248, 0.1)';
      statusContainer.style.borderColor = 'rgba(56, 189, 248, 0.2)';
      statusContainer.style.color = '#38bdf8';
      document.querySelector('.status-dot').style.backgroundColor = '#38bdf8';
      document.querySelector('.status-dot').style.boxShadow = '0 0 8px #38bdf8';
      domainText.textContent = 'youtube.com';
      startTimer();
    } else {
      statusText.textContent = 'Paused';
      statusContainer.style.background = 'rgba(244, 63, 94, 0.1)'; // Rose red
      statusContainer.style.borderColor = 'rgba(244, 63, 94, 0.2)';
      statusContainer.style.color = '#f43f5e';
      document.querySelector('.status-dot').style.backgroundColor = '#f43f5e';
      document.querySelector('.status-dot').style.boxShadow = '0 0 8px #f43f5e';
      domainText.textContent = '[Inactive/Idle]';
      stopTimer();
    }
  });
});
