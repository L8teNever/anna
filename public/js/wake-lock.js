// Screen Wake Lock API utility to prevent display from sleep mode during gameplay

let wakeLock = null;
let isEnabled = false;

/**
 * Requests a screen wake lock if supported by the browser.
 */
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    console.warn('Screen Wake Lock is not supported by this browser.');
    updateWakeLockStatus(false);
    return;
  }

  try {
    // Only request if not already active
    if (!wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      isEnabled = true;
      console.log('Screen Wake Lock activated successfully.');
      
      // Listen for release event (can be released by system, e.g. low battery)
      wakeLock.addEventListener('release', () => {
        console.log('Screen Wake Lock was released by the browser.');
        wakeLock = null;
        isEnabled = false;
        updateWakeLockStatus(false);
      });
      
      updateWakeLockStatus(true);
    }
  } catch (err) {
    console.error(`Failed to activate Screen Wake Lock: ${err.name}, ${err.message}`);
    updateWakeLockStatus(false);
  }
}

/**
 * Releases the screen wake lock if active.
 */
function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
    isEnabled = false;
    console.log('Screen Wake Lock manually released.');
    updateWakeLockStatus(false);
  }
}

/**
 * Returns whether wake lock is currently active.
 */
function isWakeLockActive() {
  return isEnabled && wakeLock !== null;
}

/**
 * Update UI badges or state for Wake Lock
 */
function updateWakeLockStatus(active) {
  const badges = document.querySelectorAll('.indicator-wake-lock');
  badges.forEach(badge => {
    if (active) {
      badge.textContent = 'Screen ON';
      badge.classList.remove('inactive');
    } else {
      badge.textContent = 'Screen Auto';
      badge.classList.add('inactive');
    }
  });
}

// Automatically re-request Wake Lock if page is refocused
document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible' && isEnabled) {
    console.log('Tab visible again, re-requesting Wake Lock...');
    wakeLock = null;
    await requestWakeLock();
  }
});

// Export utilities globally for simple module-free imports
window.WakeLock = {
  request: requestWakeLock,
  release: releaseWakeLock,
  isActive: isWakeLockActive
};
