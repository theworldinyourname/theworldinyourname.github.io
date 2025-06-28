// Main application functionality from provided source files
document.addEventListener('DOMContentLoaded', function() {
    // Initialize AOS
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 1000,
            once: true
        });
    }

    // Initialize page-specific functionality
    initializePage();
});

function initializePage() {
    const path = window.location.pathname;
    
    if (path.includes('chat')) {
        initializeChat();
    } else if (path.includes('period-tracker')) {
        initializePeriodTracker();
    } else if (path.includes('photo-gallery')) {
        initializePhotoGallery();
    } else if (path.includes('about-her')) {
        initializeAboutHer();
    } else if (path.includes('apology')) {
        initializeApology();
    } else if (path.includes('journal')) {
        initializeJournal();
    }
}

// Chat functionality - Enhanced version from provided files
function initializeChat() {
    if (typeof window.currentUserId === 'undefined') {
        // Set current user from auth
        const currentUser = auth.getCurrentUser();
        if (currentUser) {
            window.currentUserId = currentUser.username === 'navaneet' ? 1 : 2;
            window.currentUser = currentUser;
        }
    }

    loadMessages();
    initializePresence();
    loadSettings();
    updatePartnerAvatar();
    initializeEmojiPicker();

    // Set up periodic sync - more frequent for better real-time experience
    setInterval(syncMessages, 1000);
    setInterval(updatePresence, 30000);

    // Set focus on message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.focus();
    }

    // Set up event listeners
    setupChatEventListeners();
}

function setupChatEventListeners() {
    // Click outside handlers
    document.addEventListener('click', function(event) {
        try {
            const chatMenu = document.getElementById('chatMenu');
            const emojiPicker = document.getElementById('emojiPicker');
            const attachMenu = document.getElementById('attachMenu');

            if (chatMenu && !event.target.closest('.header-btn') && chatMenu.style.display === 'block') {
                chatMenu.style.display = 'none';
            }

            if (emojiPicker && !event.target.closest('.emoji-btn') && !event.target.closest('.emoji-picker')) {
                emojiPicker.classList.remove('show');
            }

            if (attachMenu && !event.target.closest('.attach-btn') && !event.target.closest('.attach-menu')) {
                attachMenu.classList.remove('show');
            }
        } catch (error) {
            console.error('Error in click handler:', error);
        }
    });

    // Focus management
    document.addEventListener('focusin', markMessagesAsRead);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            markMessagesAsRead();
        }
    });
}

// Message Management
function loadMessages() {
    const messages = storage.getMessages();
    displayMessages(messages);
}

function displayMessages(messages = null) {
    if (!messages) {
        messages = storage.getMessages();
    }

    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = '';
    
    let lastDate = null;
    messages.forEach((message, index) => {
        // Add date divider if needed
        const messageDate = new Date(message.timestamp).toDateString();
        if (messageDate !== lastDate) {
            messagesContainer.appendChild(createDateDivider(messageDate));
            lastDate = messageDate;
        }
        
        messagesContainer.appendChild(createMessageBubble(message, index));
    });

    scrollToBottom();
}

function createDateDivider(date) {
    const divider = document.createElement('div');
    divider.className = 'date-divider';
    divider.innerHTML = `<div class="date-text">${formatDate(date)}</div>`;
    return divider;
}

function createMessageBubble(message, index) {
    const currentUser = auth.getCurrentUser();
    const isSent = currentUser && message.sender_username === currentUser.username;
    
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
    bubble.dataset.messageId = message.id;

    let content = '';
    
    // Handle deleted messages
    if (message.deleted_for_everyone) {
        content = '<em style="color: #999;">This message was deleted</em>';
    } else if ((isSent && message.deleted_for_sender) || (!isSent && message.deleted_for_receiver)) {
        return document.createElement('div'); // Return empty div for hidden messages
    } else {
        if (message.file_url) {
            if (message.message_type === 'image') {
                content += `<img src="${message.file_url}" class="message-image" onclick="openImageModal('${message.file_url}')" alt="Image">`;
            } else if (message.message_type === 'video') {
                content += `<video src="${message.file_url}" class="message-video" controls></video>`;
            }
        }
        
        if (message.content) {
            content += `<div class="message-text">${escapeHtml(message.content)}</div>`;
        }
    }

    const timeText = formatTime(new Date(message.timestamp));
    const status = getMessageStatus(message);
    
    bubble.innerHTML = `
        <div class="message-content">${content}</div>
        <div class="message-time">
            ${timeText}
            ${isSent ? status : ''}
        </div>
        <div class="message-reactions-container">
            <div class="message-reactions" id="reactions-${message.id}">
                ${getReactionsHTML(message.reactions)}
            </div>
        </div>
    `;

    // Add context menu
    bubble.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMessageOptions(index, e);
    });

    // Show reactions if they exist
    if (message.reactions && Object.keys(message.reactions).length > 0) {
        bubble.querySelector('.message-reactions').classList.add('show');
    }

    return bubble;
}

function getReactionsHTML(reactions) {
    if (!reactions) return '';
    
    let html = '';
    const reactionCounts = {};
    
    // Count reactions
    Object.values(reactions).forEach(emoji => {
        reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
    });
    
    // Generate HTML
    Object.entries(reactionCounts).forEach(([emoji, count]) => {
        html += `<span class="reaction">${emoji} ${count}</span>`;
    });
    
    return html;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input?.value?.trim();
    
    if (!content) return;

    const currentUser = auth.getCurrentUser();
    if (!currentUser) return;

    const message = {
        content: content,
        sender_username: currentUser.username,
        message_type: 'text',
        reactions: {}
    };

    storage.addMessage(message);
    loadMessages();
    
    input.value = '';
    updateSendButton();
    
    playSound('send');
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const currentUser = auth.getCurrentUser();
    if (!currentUser) return;

    // Save file to storage
    storage.saveFile(file, 'chat').then(fileData => {
        const message = {
            content: `Shared ${file.type.startsWith('image/') ? 'an image' : 'a file'}`,
            sender_username: currentUser.username,
            message_type: file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'file'),
            file_url: fileData.data
        };

        storage.addMessage(message);
        loadMessages();
        playSound('send');
    });

    // Clear the input
    event.target.value = '';
}

function syncMessages() {
    // In a real app, this would sync with server
    // For now, just update the display
    loadMessages();
}

function updatePresence() {
    storage.updatePresence();
}

function markMessagesAsRead() {
    // Mark messages as read in storage
    const messages = storage.getMessages();
    const currentUser = auth.getCurrentUser();
    
    if (!currentUser) return;
    
    let updated = false;
    messages.forEach(message => {
        if (message.sender_username !== currentUser.username && !message.is_read) {
            message.is_read = true;
            updated = true;
        }
    });
    
    if (updated) {
        storage.saveMessages(messages);
    }
}

// Period tracker functionality
function initializePeriodTracker() {
    loadPeriodData();
    
    const form = document.getElementById('periodForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            savePeriodData();
        });
    }
}

function loadPeriodData() {
    const data = storage.getPeriodData();
    
    if (data.last_period) {
        const input = document.getElementById('lastPeriod');
        if (input) {
            input.value = data.last_period.split('T')[0]; // Get date part only
        }
        calculateNextPeriod(data.last_period, data.cycle_length);
    }
    
    const cycleInput = document.getElementById('cycleLength');
    if (cycleInput) {
        cycleInput.value = data.cycle_length;
    }
}

function savePeriodData() {
    const lastPeriod = document.getElementById('lastPeriod')?.value;
    const cycleLength = parseInt(document.getElementById('cycleLength')?.value) || 28;
    
    if (lastPeriod) {
        const data = {
            last_period: lastPeriod,
            cycle_length: cycleLength
        };
        
        storage.savePeriodData(data);
        calculateNextPeriod(lastPeriod, cycleLength);
        
        showNotification('Period data updated successfully!', 'success');
    }
}

function calculateNextPeriod(lastPeriod, cycleLength) {
    const lastDate = new Date(lastPeriod);
    const nextDate = new Date(lastDate.getTime() + (cycleLength * 24 * 60 * 60 * 1000));
    const today = new Date();
    
    const daysUntilNext = Math.ceil((nextDate - today) / (24 * 60 * 60 * 1000));
    
    const statusElement = document.getElementById('periodStatus');
    if (statusElement) {
        if (daysUntilNext <= 0) {
            statusElement.innerHTML = '<i class="fas fa-circle text-danger"></i> <span>Period time</span> <small class="d-block">Take care of yourself</small>';
        } else {
            statusElement.innerHTML = `<i class="fas fa-circle text-success"></i> <span>Not on period</span> <small class="d-block">${daysUntilNext} days until next</small>`;
        }
    }
}

// Photo gallery functionality
function initializePhotoGallery() {
    loadPhotoMemories();
    
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handlePhotoUpload();
        });
    }
    
    const fileInput = document.getElementById('photoFile');
    if (fileInput) {
        fileInput.addEventListener('change', handlePhotoUpload);
    }
}

function loadPhotoMemories() {
    const memories = storage.getPhotoMemories();
    const gallery = document.getElementById('photoGallery');
    
    if (!gallery) return;
    
    if (memories.length === 0) {
        gallery.innerHTML = `
            <div class="empty-catalog">
                <div class="empty-catalog-card">
                    <div class="empty-icon">
                        <i class="fas fa-heart"></i>
                    </div>
                    <h3>Our Memory Catalog Awaits</h3>
                    <p>Start building your beautiful collection of memories together</p>
                </div>
            </div>
        `;
        return;
    }
    
    gallery.innerHTML = `
        <div class="catalog-grid">
            ${memories.map(memory => `
                <div class="memory-catalog-item" data-aos="zoom-in">
                    <div class="memory-card">
                        <div class="memory-image-wrapper">
                            <img src="${memory.data}" 
                                 alt="${memory.caption || 'Beautiful memory'}" 
                                 class="catalog-image"
                                 onclick="openMemoryLightbox('${memory.data}', '${memory.caption || ''}')">
                            <div class="memory-overlay">
                                <div class="memory-actions">
                                    <button class="action-btn view-btn" 
                                            onclick="openMemoryLightbox('${memory.data}', '${memory.caption || ''}')">
                                        <i class="fas fa-expand-alt"></i>
                                    </button>
                                    <button class="action-btn delete-btn" 
                                            onclick="deleteMemory('${memory.id}')">
                                        <i class="fas fa-heart-broken"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="memory-info">
                            <div class="memory-date">
                                <i class="fas fa-calendar-heart"></i>
                                ${formatDate(memory.uploaded_at)}
                            </div>
                            ${memory.caption ? `<p class="memory-caption">${memory.caption}</p>` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function handlePhotoUpload() {
    const fileInput = document.getElementById('photoFile');
    const captionInput = document.getElementById('photoCaption');
    
    if (!fileInput?.files[0]) return;
    
    const file = fileInput.files[0];
    const caption = captionInput?.value || '';
    
    storage.saveFile(file, 'photos').then(fileData => {
        const memory = {
            data: fileData.data,
            caption: caption,
            filename: file.name
        };
        
        storage.addPhotoMemory(memory);
        loadPhotoMemories();
        
        // Clear form
        if (fileInput) fileInput.value = '';
        if (captionInput) captionInput.value = '';
        
        showNotification('Memory added successfully!', 'success');
    });
}

function deleteMemory(memoryId) {
    if (confirm('Are you sure you want to delete this memory?')) {
        storage.deletePhotoMemory(memoryId);
        loadPhotoMemories();
        showNotification('Memory deleted', 'info');
    }
}

function openMemoryLightbox(imageUrl, caption) {
    openImageModal(imageUrl);
}

// About Her functionality
function initializeAboutHer() {
    loadProfilePhoto();
    setupProfilePhotoUpload();
    setupSensitiveInfoAccess();
}

function loadProfilePhoto() {
    const profileData = storage.getProfileData();
    const photoElement = document.getElementById('profilePhoto');
    const placeholderElement = document.getElementById('photoPlaceholder');
    const removeBtn = document.getElementById('removePhotoBtn');
    
    if (profileData.profile_photo && photoElement) {
        photoElement.src = profileData.profile_photo;
        photoElement.style.display = 'block';
        if (placeholderElement) placeholderElement.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'inline-block';
    }
}

function setupProfilePhotoUpload() {
    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleProfilePhotoUpload);
    document.body.appendChild(fileInput);
    
    window.selectProfilePhoto = function() {
        fileInput.click();
    };
    
    window.removeProfilePhoto = function() {
        if (confirm('Remove profile photo?')) {
            const profileData = storage.getProfileData();
            profileData.profile_photo = null;
            storage.saveProfileData(profileData);
            loadProfilePhoto();
        }
    };
}

function handleProfilePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    storage.saveFile(file, 'profile').then(fileData => {
        const profileData = storage.getProfileData();
        profileData.profile_photo = fileData.data;
        storage.saveProfileData(profileData);
        loadProfilePhoto();
        showNotification('Profile photo updated!', 'success');
    });
}

function setupSensitiveInfoAccess() {
    window.revealSensitiveInfo = function() {
        const password = document.getElementById('sensitive-password')?.value;
        if (!password) {
            alert('Please enter password');
            return;
        }
        
        if (auth.validateSensitiveAccess(password)) {
            // Show sensitive sections
            const sensitiveSections = document.querySelectorAll('.sensitive-info');
            sensitiveSections.forEach(section => {
                section.style.display = 'block';
            });
            
            // Hide password section
            const passwordSection = document.getElementById('password-section');
            if (passwordSection) {
                passwordSection.style.display = 'none';
            }
            
            showNotification('Sensitive information unlocked', 'success');
        } else {
            alert('Incorrect password');
        }
    };
}

// Apology page functionality
function initializeApology() {
    const apologyMessage = `My Dearest Darling,

I know I've hurt you, and my heart breaks knowing that I caused you pain. You mean everything to me, and seeing you upset because of my actions is unbearable.

I was wrong. I should have been more thoughtful, more understanding, more present. You deserve someone who listens to your heart, who values your feelings, and who never takes your love for granted.

I'm not asking for immediate forgiveness. I know trust needs to be rebuilt. But I want you to know that I'm committed to being better, to being the partner you deserve.

You are my world, my everything, and I will spend every day proving that to you.

With all my love and deepest regret,
Your Navu`;

    typewriterEffect('apology-text', apologyMessage, 50);
}

function typewriterEffect(elementId, text, speed = 50) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = '';
    let i = 0;
    
    function typeChar() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i) === '\n' ? '<br>' : text.charAt(i);
            i++;
            setTimeout(typeChar, speed);
        }
    }
    
    typeChar();
}

// Journal functionality
function initializeJournal() {
    // Journal loads automatically with CSS animations
    console.log('Journal page initialized');
}

// Utility functions
function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function openImageModal(imageUrl) {
    let modal = document.getElementById('imageModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.className = 'image-modal';
        modal.innerHTML = `
            <img class="modal-image" id="modalImage">
            <button class="modal-close" onclick="closeImageModal()">
                <i class="fas fa-times"></i>
            </button>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('modalImage').src = imageUrl;
    modal.classList.add('show');
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
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
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
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

function playSound(type) {
    // Placeholder for sound effects
    // In a real app, you would play actual sound files
    console.log(`Playing ${type} sound`);
}

// Chat-specific functions
function getMessageStatus(message) {
    if (message.is_read) {
        return '<span class="tick blue-double"></span>';
    } else {
        return '<span class="tick double"></span>';
    }
}

function updatePartnerAvatar() {
    const currentUser = auth.getCurrentUser();
    const partner = auth.getPartner();
    
    const avatarElements = document.querySelectorAll('.partner-avatar-placeholder .avatar-letter');
    avatarElements.forEach(el => {
        if (partner) {
            el.textContent = partner.display_name.charAt(0).toUpperCase();
        }
    });
}

function initializeEmojiPicker() {
    const emojiData = {
        smileys: ['😊', '😂', '😍', '😘', '😉', '😋', '😎', '😇', '🥰', '😜', '🤗', '😚', '😙', '😗', '😆', '😅', '🤣', '😭', '😌', '😏', '😪', '🥳'],
        hearts: ['❤️', '💕', '💖', '💗', '💓', '💝', '💟', '♥️', '💘', '💌', '💋', '😻', '💯', '💫', '⭐', '🌟', '✨', '🌹', '🥀', '💐', '🎀', '💎'],
        animals: ['🐶', '🐱', '🐰', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐧', '🐦', '🐾', '🐕', '🐈', '🐇', '🦋', '🐢', '🐠', '🐝', '🦄', '🐙'],
        food: ['🍕', '🍔', '🌮', '🍰', '🍪', '🍩', '🍫', '🍭', '🍯', '🍓', '🍒', '🍑', '🍊', '🍋', '🍌', '🍉', '🍇', '🥞', '🧁', '🍦', '🥤', '☕']
    };
    
    showEmojiCategory('smileys', emojiData);
}

function showEmojiCategory(category, emojiData = null) {
    if (!emojiData) {
        emojiData = {
            smileys: ['😊', '😂', '😍', '😘', '😉', '😋', '😎', '😇', '🥰', '😜'],
            hearts: ['❤️', '💕', '💖', '💗', '💓', '💝', '💟', '♥️', '💘', '💌'],
            animals: ['🐶', '🐱', '🐰', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵'],
            food: ['🍕', '🍔', '🌮', '🍰', '🍪', '🍩', '🍫', '🍭', '🍯', '🍓']
        };
    }
    
    const emojiGrid = document.getElementById('emojiGrid');
    if (emojiGrid && emojiData[category]) {
        emojiGrid.innerHTML = emojiData[category].map(emoji => 
            `<button class="emoji-item" onclick="insertEmoji('${emoji}')">${emoji}</button>`
        ).join('');
    }
}

function insertEmoji(emoji) {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.value += emoji;
        messageInput.focus();
    }
}

function updateSendButton() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (input && sendBtn) {
        if (input.value.trim()) {
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            sendBtn.onclick = sendMessage;
        } else {
            sendBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            sendBtn.onclick = toggleVoiceRecording;
        }
    }
}

function toggleVoiceRecording() {
    // Placeholder for voice recording
    console.log('Voice recording not implemented in this demo');
    showNotification('Voice recording not available in this demo', 'info');
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function showMessageOptions(messageIndex, event) {
    // Placeholder for message context menu
    console.log('Message options for message', messageIndex);
}

function loadSettings() {
    // Load chat settings
    const settings = storage.getChatSettings();
    console.log('Chat settings loaded:', settings);
}

// Event listeners for chat input
document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', updateSendButton);
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Setup file input for chat
    const fileInput = document.getElementById('chatFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
});