// Authentication System (Disabled)
class AuthManager {
    constructor() {
        this.users = {
            'navaneet': {
                username: 'navaneet',
                display_name: 'Navaneet',
                password: '112404',
                role: 'sender'
            },
            'darling': {
                username: 'darling',
                display_name: 'Darling',
                password: '112404',
                role: 'receiver'
            }
        };
        this.init();
    }

    init() {
        // Authentication disabled - no checks needed
        this.setupAuthForms();
    }

    checkAuth() {
        // Always return true - no authentication required
        return true;
    }

    setupAuthForms() {
        // Setup login form if it exists
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Setup logout buttons
        const logoutBtns = document.querySelectorAll('.logout-btn');
        logoutBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        });
    }

    async handleLogin() {
        const username = document.getElementById('username')?.value?.toLowerCase()?.trim();
        const password = document.getElementById('password')?.value;
        const rememberMe = document.getElementById('rememberMe')?.checked || false;
        const errorDiv = document.getElementById('loginError');
        const submitBtn = document.getElementById('loginBtn');

        // Clear previous errors
        if (errorDiv) errorDiv.textContent = '';

        // Disable submit button
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
        }

        try {
            if (!username || !password) {
                throw new Error('Please enter both username and password');
            }

            const user = this.users[username];
            if (!user || user.password !== password) {
                throw new Error('Invalid username or password');
            }

            // Login successful
            const loginData = {
                username: user.username,
                display_name: user.display_name,
                role: user.role,
                login_time: new Date().toISOString()
            };

            storage.setCurrentUser(loginData);

            // Handle remember me
            if (rememberMe) {
                this.rememberUser(loginData);
            } else {
                this.forgetUser();
            }

            console.log('Login successful for:', user.display_name);

            // Show success message
            this.showNotification('Welcome back, ' + user.display_name + '!', 'success');

            // Redirect to home after a brief delay
            setTimeout(() => {
                this.redirectToHome();
            }, 1000);

        } catch (error) {
            if (errorDiv) {
                errorDiv.textContent = error.message;
            }
            console.error('Login error:', error);
        } finally {
            // Re-enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-heart me-2"></i>Login';
            }
        }
    }

    logout() {
        storage.clearCurrentUser();
        this.forgetUser();
        this.showNotification('Logged out successfully', 'info');
        this.redirectToHome(); // Redirect to home.html after logout
    }

    // Remember me functionality
    rememberUser(userData) {
        const rememberData = {
            username: userData.username,
            display_name: userData.display_name,
            role: userData.role,
            remembered_at: new Date().toISOString()
        };
        localStorage.setItem('remembered_user', JSON.stringify(rememberData));
    }

    getRememberedUser() {
        try {
            const data = localStorage.getItem('remembered_user');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error getting remembered user:', e);
            return null;
        }
    }

    forgetUser() {
        localStorage.removeItem('remembered_user');
    }

    restoreSession(rememberedUser) {
        const sessionData = {
            username: rememberedUser.username,
            display_name: rememberedUser.display_name,
            role: rememberedUser.role,
            login_time: new Date().toISOString(),
            restored_session: true
        };
        storage.setCurrentUser(sessionData);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    getCurrentUser() {
        return storage.getCurrentUser();
    }

    isAuthenticated() {
        return !!this.getCurrentUser();
    }

    redirectToLogin() {
        window.location.href = 'home.html'; // Redirect to home.html
    }

    redirectToHome() {
        window.location.href = 'home.html'; // Redirect to home.html
    }

    // Get partner information
    getPartner() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return null;

        if (currentUser.username === 'navaneet') {
            return this.users['darling'];
        } else {
            return this.users['navaneet'];
        }
    }

    // Update user display elements
    updateUserDisplay() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return;

        // Update username displays
        const usernameElements = document.querySelectorAll('.current-username');
        usernameElements.forEach(el => {
            el.textContent = currentUser.display_name;
        });

        // Update partner name displays
        const partner = this.getPartner();
        const partnerElements = document.querySelectorAll('.partner-name');
        partnerElements.forEach(el => {
            el.textContent = partner ? partner.display_name : 'Partner';
        });

        // Update role-specific content
        this.updateRoleContent(currentUser.username);
    }

    updateRoleContent(username) {
        // Show/hide content based on user role
        const userSpecificElements = document.querySelectorAll(`[data-user="${username}"]`);
        userSpecificElements.forEach(el => {
            el.style.display = 'block';
        });

        // Hide other user content
        const otherUser = username === 'navaneet' ? 'darling' : 'navaneet';
        const otherUserElements = document.querySelectorAll(`[data-user="${otherUser}"]`);
        otherUserElements.forEach(el => {
            el.style.display = 'none';
        });
    }

    // Initialize user-specific features
    initUserFeatures() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return;

        // Set global user ID for chat
        window.currentUserId = currentUser.username === 'navaneet' ? 1 : 2;
        window.currentUser = currentUser;

        // Update presence
        storage.updatePresence();

        // Update display
        this.updateUserDisplay();
    }

    // Check if user can access sensitive information
    canAccessSensitive() {
        const currentUser = this.getCurrentUser();
        return currentUser && currentUser.username === 'navaneet';
    }

    // Validate sensitive access with password
    validateSensitiveAccess(password) {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return false;

        // For sensitive access, require the same password
        return currentUser.password === password;
    }
}

// Initialize auth manager
const auth = new AuthManager();

// Export for use in other scripts
window.auth = auth;

// Initialize user features when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (auth.isAuthenticated()) {
        auth.initUserFeatures();
    }
});