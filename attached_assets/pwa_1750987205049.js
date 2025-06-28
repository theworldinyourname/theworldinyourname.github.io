
// PWA Installation and Service Worker Registration
let deferredPrompt;
let isInstallable = false;

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/js/sw.js')
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
  console.log('Love Chat PWA was installed');
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
      background: #075e54;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 25px;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
    `;
    
    installButton.addEventListener('mouseenter', () => {
      installButton.style.transform = 'scale(1.05)';
      installButton.style.background = '#054d44';
    });
    
    installButton.addEventListener('mouseleave', () => {
      installButton.style.transform = 'scale(1)';
      installButton.style.background = '#075e54';
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
    content: "Offline - Messages will sync when connection is restored";
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #ff9800;
    color: white;
    text-align: center;
    padding: 8px;
    font-size: 12px;
    z-index: 10001;
  }
  
  .pwa-mode .whatsapp-header {
    padding-top: env(safe-area-inset-top);
  }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = offlineStyles;
document.head.appendChild(styleSheet);
