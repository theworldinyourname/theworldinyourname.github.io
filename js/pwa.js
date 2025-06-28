// PWA Installation and Service Worker Registration
let deferredPrompt;
let isInstallable = false;

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Handle PWA installation
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  isInstallable = true;
  
  // Show install button
  showInstallButton();
});

// Handle successful installation
window.addEventListener('appinstalled', (evt) => {
  console.log('Love App PWA was installed');
  hideInstallButton();
});

function showInstallButton() {
  // Create install button if it doesn't exist
  let installButton = document.getElementById('pwa-install-button');
  
  if (!installButton) {
    installButton = document.createElement('button');
    installButton.id = 'pwa-install-button';
    installButton.innerHTML = '<i class="fas fa-download"></i> Install App';
    installButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--romantic-pink);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 25px;
      font-size: 14px;
      cursor: pointer;
      box-shadow: var(--romantic-shadow);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
      font-family: 'Poppins', sans-serif;
    `;
    
    installButton.addEventListener('mouseenter', () => {
      installButton.style.transform = 'scale(1.05)';
      installButton.style.boxShadow = 'var(--romantic-glow)';
    });
    
    installButton.addEventListener('mouseleave', () => {
      installButton.style.transform = 'scale(1)';
      installButton.style.boxShadow = 'var(--romantic-shadow)';
    });
    
    installButton.addEventListener('click', installPWA);
    document.body.appendChild(installButton);
  }
  
  installButton.style.display = 'flex';
}

function hideInstallButton() {
  const installButton = document.getElementById('pwa-install-button');
  if (installButton) {
    installButton.style.display = 'none';
  }
}

async function installPWA() {
  if (!deferredPrompt) {
    return;
  }
  
  // Show the install prompt
  deferredPrompt.prompt();
  
  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    console.log('User accepted the install prompt');
  } else {
    console.log('User dismissed the install prompt');
  }
  
  // Clear the deferredPrompt variable
  deferredPrompt = null;
  hideInstallButton();
}

// Check if app is running as PWA
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true;
}

// Add PWA-specific styles when running as installed app
if (isPWA()) {
  document.documentElement.classList.add('pwa-mode');
  
  // Add status bar padding for iOS
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    document.documentElement.style.paddingTop = 'env(safe-area-inset-top)';
  }
}

// Handle online/offline status
window.addEventListener('online', () => {
  console.log('App is online');
  document.body.classList.remove('offline');
  // Sync any pending messages
  if (window.syncMessages) {
    window.syncMessages();
  }
});

window.addEventListener('offline', () => {
  console.log('App is offline');
  document.body.classList.add('offline');
});

// Add offline indicator styles
const offlineStyles = `
  .offline::before {
    content: 'Offline';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #ff9800;
    color: white;
    text-align: center;
    padding: 5px;
    font-size: 12px;
    z-index: 10001;
    font-family: 'Poppins', sans-serif;
  }
  
  .offline {
    padding-top: 30px;
  }
  
  .pwa-mode .romantic-nav {
    position: sticky;
    top: 0;
  }
  
  .pwa-mode body {
    padding-top: 0;
  }
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = offlineStyles;
document.head.appendChild(styleSheet);

// Update service worker on page focus
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.update();
    });
  }
});

// Handle PWA share functionality
if (navigator.share) {
  window.shareContent = function(title, text, url) {
    navigator.share({
      title: title || 'Love App',
      text: text || 'Check out this romantic love app!',
      url: url || window.location.href
    }).then(() => {
      console.log('Successful share');
    }).catch((error) => {
      console.log('Error sharing', error);
    });
  };
} else {
  // Fallback for browsers that don't support Web Share API
  window.shareContent = function(title, text, url) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url || window.location.href).then(() => {
        showNotification('Link copied to clipboard!', 'success');
      });
    } else {
      // Further fallback
      const textArea = document.createElement('textarea');
      textArea.value = url || window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showNotification('Link copied to clipboard!', 'success');
    }
  };
}

// Handle PWA manifest and theme
function updateThemeColor(color) {
  let themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    document.head.appendChild(themeColorMeta);
  }
  themeColorMeta.content = color;
}

// Set theme color based on current page
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('chat')) {
    updateThemeColor('#075e54');
  } else {
    updateThemeColor('#ff6b9d');
  }
});

// Export functions for global use
window.isPWA = isPWA;
window.installPWA = installPWA;