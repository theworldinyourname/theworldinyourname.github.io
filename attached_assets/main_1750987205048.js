// Chat functionality for WhatsApp-style interface
document.addEventListener('DOMContentLoaded', function() {
    // Initialize chat if on chat page
    if (window.location.pathname === '/chat') {
        initializeChat();
    }
});

// Global chat variables
let currentUser = null;
let currentUsername = '';
let partnerId = null;
let messages = [];
let isTyping = false;
let typingTimeout;
let lastSeen = new Date();
let isOnline = true;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// Load emoji data
const emojiData = {
    smileys: ['😊', '😂', '😍', '😘', '😉', '😋', '😎', '😇', '🥰', '😜', '🤗', '😚', '😙', '😗', '😆', '😅', '🤣', '😭', '😌', '😏', '😪', '🥳'],
    hearts: ['❤️', '💕', '💖', '💗', '💓', '💝', '💟', '♥️', '💘', '💌', '💋', '😻', '💯', '💫', '⭐', '🌟', '✨', '🌹', '🥀', '💐', '🎀', '💎'],
    animals: ['🐶', '🐱', '🐰', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐧', '🐦', '🐾', '🐕', '🐈', '🐇', '🦋', '🐢', '🐠', '🐝', '🦄', '🐙'],
    food: ['🍕', '🍔', '🌮', '🍰', '🍪', '🍩', '🍫', '🍭', '🍯', '🍓', '🍒', '🍑', '🍊', '🍋', '🍌', '🍉', '🍇', '🥞', '🧁', '🍦', '🥤', '☕']
};

function initializeChat() {
    // Get current user from global variable
    if (typeof window.currentUserId !== 'undefined') {
        currentUser = window.currentUserId;
        currentUsername = document.querySelector('.partner-name') ? 
            (currentUser === 1 ? 'navu' : 'spu') : 'user';
        partnerId = currentUser === 1 ? 2 : 1;
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
    setupEventListeners();
}

function setupEventListeners() {
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

function initializeEmojiPicker() {
    showEmojiCategory('smileys');
}

// Message Management
function loadMessages() {
    const stored = localStorage.getItem('chatMessages');
    if (stored) {
        try {
            messages = JSON.parse(stored);
            displayMessages();
        } catch (e) {
            console.error('Error parsing stored messages:', e);
            messages = [];
        }
    }
    fetchLatestMessages();
}

function saveMessages() {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
}

function fetchLatestMessages() {
    fetch('/api/messages')
        .then(response => response.json())
        .then(data => {
            if (Array.isArray(data)) {
                messages = data.map(msg => ({
                    id: msg.id,
                    server_id: msg.id,
                    sender_id: msg.sender_id,
                    receiver_id: partnerId,
                    content: msg.content,
                    message_type: msg.message_type,
                    file_url: msg.file_url,
                    timestamp: msg.timestamp,
                    is_read: msg.is_read,
                    is_edited: msg.is_edited,
                    reactions: msg.reactions,
                    delivered: true
                }));
                saveMessages();
                displayMessages();
                markMessagesAsRead();
            }
        })
        .catch(error => {
            console.error('Error fetching messages:', error);
        });
}

function syncMessages() {
    fetch('/api/messages')
        .then(response => response.json())
        .then(data => {
            if (Array.isArray(data)) {
                // Replace the entire messages array to ensure synchronization
                const serverMessages = data.map(msg => ({
                    id: msg.id,
                    server_id: msg.id,
                    sender_id: msg.sender_id,
                    receiver_id: msg.receiver_id,
                    content: msg.content,
                    message_type: msg.message_type,
                    file_url: msg.file_url,
                    timestamp: msg.timestamp,
                    is_read: msg.is_read,
                    is_edited: msg.is_edited,
                    reactions: msg.reactions,
                    delivered: true,
                    deleted_for_everyone: msg.deleted_for_everyone,
                    deleted_for_sender: msg.deleted_for_sender,
                    deleted_for_receiver: msg.deleted_for_receiver
                }));

                const oldLength = messages.length;
                messages = serverMessages;
                saveMessages();
                displayMessages();

                // Play sound for new messages only
                if (serverMessages.length > oldLength && document.hasFocus()) {
                    playSound('receive');
                }

                if (document.hasFocus()) {
                    markMessagesAsRead();
                }
            }
        })
        .catch(error => {
            console.error('Sync error:', error);
            // Continue with local messages if sync fails
        });
}

function displayMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    container.innerHTML = '';
    let lastDate = null;

    messages.forEach((msg, index) => {
        const msgDate = new Date(msg.timestamp).toDateString();

        // Add date divider
        if (msgDate !== lastDate) {
            const divider = createDateDivider(new Date(msg.timestamp));
            container.appendChild(divider);
            lastDate = msgDate;
        }

        const bubble = createMessageBubble(msg, index);
        container.appendChild(bubble);
    });

    scrollToBottom();
}

function createDateDivider(date) {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const msgDate = date.toDateString();

    let label;
    if (msgDate === today) {
        label = 'Today';
    } else if (msgDate === yesterday) {
        label = 'Yesterday';
    } else {
        label = date.toLocaleDateString();
    }

    const divider = document.createElement('div');
    divider.className = 'date-divider';
    divider.innerHTML = `<span>${label}</span>`;
    return divider;
}

function createMessageBubble(msg, index) {
    const bubble = document.createElement('div');
    const isSent = msg.sender_id === currentUser;
    bubble.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
    bubble.dataset.messageId = msg.id || index;

    let messageContent = '';

    // Handle deleted messages
    if (msg.deleted_for_everyone) {
        messageContent = `
            <div class="message-content deleted-message">
                <div class="message-text">
                    <i class="fas fa-ban"></i> This message was deleted
                </div>
                <div class="message-meta">
                    <span class="message-time">${formatTime(new Date(msg.timestamp))}</span>
                </div>
            </div>
        `;
    } else if ((isSent && msg.deleted_for_sender) || (!isSent && msg.deleted_for_receiver)) {
        // Message deleted for current user - don't show it
        return document.createElement('div');
    } else {
        // Regular message content
        let mediaContent = '';

        if (msg.file_url) {
            if (msg.message_type === 'image') {
                mediaContent = `
                    <div class="message-media">
                        <img src="${msg.file_url}" alt="Shared image" class="message-image" 
                             onclick="openImageModal('${msg.file_url}')" loading="lazy">
                    </div>
                `;
            } else if (msg.message_type === 'video') {
                mediaContent = `
                    <div class="message-media">
                        <video controls class="message-video" preload="metadata">
                            <source src="${msg.file_url}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                `;
            } else if (msg.file_url.includes('.wav') || msg.file_url.includes('.mp3') || msg.file_url.includes('.m4a')) {
                mediaContent = `
                    <div class="message-media">
                        <div class="voice-message">
                            <button class="play-voice-btn" onclick="playVoiceMessage('${msg.file_url}', this)">
                                <i class="fas fa-play"></i>
                            </button>
                            <span class="voice-duration">🎤 Voice message</span>
                        </div>
                    </div>
                `;
            }
        }

        // Format reactions
        let reactionsHtml = '';
        if (msg.reactions && Object.keys(msg.reactions).length > 0) {
            reactionsHtml = '<div class="message-reactions-container">';
            reactionsHtml += '<div class="message-reactions show">';
            for (const [emoji, users] of Object.entries(msg.reactions)) {
                reactionsHtml += `<span class="reaction" title="${users.join(', ')}">${emoji} ${users.length}</span>`;
            }
            reactionsHtml += '</div>';
            reactionsHtml += '</div>';
        }

        messageContent = `
            <div class="message-content" onclick="showMessageOptions(${index}, event)">
                ${mediaContent}
                ${msg.content ? `<div class="message-text">${escapeHtml(msg.content)}</div>` : ''}
                <div class="message-meta">
                    <span class="message-time">${formatTime(new Date(msg.timestamp))}</span>
                    ${isSent ? `<span class="message-status">${getMessageStatus(msg)}</span>` : ''}
                </div>
            </div>
            ${reactionsHtml}
        `;
    }

    // Add avatar for received messages
    if (!isSent) {
        const avatarLetter = currentUsername === 'navu' ? 'D' : 'N';
        messageContent = `
            <div class="message-avatar">
                <div class="message-avatar-placeholder">
                    <span class="avatar-letter-small">${avatarLetter}</span>
                </div>
            </div>
        ` + messageContent;
    }

    bubble.innerHTML = messageContent;

        // Adjust alignment based on sender
    if (isSent) {
        bubble.style.marginLeft = 'auto'; // Push sent messages to the right
        bubble.style.marginRight = '0';
    } else {
        bubble.style.marginRight = 'auto'; // Push received messages to the left
        bubble.style.marginLeft = '0';
    }

    return bubble;
}

function getMessageStatus(msg) {
    if (msg.is_read) {
        return '<span class="tick blue-double"></span>';
    } else if (msg.delivered) {
        return '<span class="tick double"></span>';
    } else {
        return '<span class="tick single"></span>';
    }
}

function getPartnerAvatar() {
    // Return empty string since we're using letter avatars now
    return '';
}

function updatePartnerAvatar() {
    // No longer needed since we use letter avatars
    return;
}

// Message Sending
function sendMessage() {
    const input = document.getElementById('messageInput');
    if (!input) return;

    const content = input.textContent.trim();
    if (!content) return;

    const message = {
        id: Date.now(),
        sender_id: currentUser,
        receiver_id: partnerId,
        content: content,
        timestamp: new Date().toISOString(),
        message_type: 'text',
        delivered: false,
        is_read: false
    };

    // Add to local storage immediately
    messages.push(message);
    saveMessages();
    displayMessages();

    // Clear input
    input.textContent = '';
    updateSendButton();

    // Send to server
    fetch('/api/send_message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success || data.status === 'success') {
            // Update message with server ID
            const localMsg = messages.find(m => m.id === message.id);
            if (localMsg) {
                localMsg.server_id = data.message_id || data.id;
                localMsg.delivered = true;
                saveMessages();
                displayMessages();
            }
            // Force immediate sync to ensure other user gets the message
            setTimeout(syncMessages, 100);
        }
    })
    .catch(error => {
        console.error('Send error:', error);
        // Mark as failed delivery
        const localMsg = messages.find(m => m.id === message.id);
        if (localMsg) {
            localMsg.delivered = false;
            saveMessages();
            displayMessages();
        }
    });

    playSound('send');
}

// Input handling
function handleInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function handleTyping() {
    if (!isTyping) {
        isTyping = true;
        showTypingIndicator(true);
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        isTyping = false;
        showTypingIndicator(false);
    }, 1000);

    updateSendButton();
}

function showTypingIndicator(show) {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.display = show ? 'block' : 'none';
        if (show) {
            scrollToBottom();
        }
    }
}

function updateSendButton() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const voiceBtn = document.getElementById('voiceBtn');

    if (!input || !sendBtn || !voiceBtn) return;

    const hasText = input.textContent.trim().length > 0;
    sendBtn.style.display = hasText ? 'flex' : 'none';
    voiceBtn.style.display = hasText ? 'none' : 'flex';
}

// Emoji functionality
function toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    if (picker) {
        picker.classList.toggle('show');
        if (picker.classList.contains('show')) {
            showEmojiCategory('smileys');
        }
    }
}

function showEmojiCategory(category) {
    const grid = document.getElementById('emojiGrid');
    if (!grid) return;

    const emojis = emojiData[category] || [];
    grid.innerHTML = emojis.map(emoji => 
        `<div class="emoji-item" onclick="insertEmoji('${emoji}')">${emoji}</div>`
    ).join('');

    // Update active category
    document.querySelectorAll('.emoji-cat').forEach(btn => btn.classList.remove('active'));

    // Find the active button by data attribute or onclick content
    const buttons = document.querySelectorAll('.emoji-cat');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(category)) {
            btn.classList.add('active');
        }
    });
}

function insertEmoji(emoji) {
    const input = document.getElementById('messageInput');
    if (!input) return;

    // Focus the input first
    input.focus();

    // Insert emoji at current cursor position
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const emojiNode = document.createTextNode(emoji);
        range.deleteContents();
        range.insertNode(emojiNode);
        range.setStartAfter(emojiNode);
        range.setEndAfter(emojiNode);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        // If no selection, append to end
        input.textContent += emoji;
        // Move cursor to end
        const range = document.createRange();
        range.selectNodeContents(input);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Close emoji picker
    const picker = document.getElementById('emojiPicker');
    if (picker) {
        picker.classList.remove('show');
    }

    handleTyping();
}

// File handling
function toggleAttachMenu() {
    const menu = document.getElementById('attachMenu');
    if (menu) {
        menu.classList.toggle('show');
    }
}

function selectFile(type) {
    const input = document.getElementById('fileInput');
    if (input) {
        input.accept = type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : '*/*';
        input.click();
    }
    document.getElementById('attachMenu').classList.remove('show');
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    console.log('File selected:', file);

    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    // Show loading
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        const originalHtml = sendBtn.innerHTML;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        sendBtn.disabled = true;

        fetch('/api/upload_file', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Upload response:', data);
            if (data.status === 'success') {
                sendMessageWithFile('', data.file_url);
            } else {
                alert('Error uploading file: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Upload error:', error);
            alert('Error uploading file: ' + error.message);
        })
        .finally(() => {
            sendBtn.innerHTML = originalHtml;
            sendBtn.disabled = false;
            event.target.value = '';
        });
    }
}

function sendMessageWithFile(content, fileUrl) {
    const messageData = {
        content: content || '',
        file_url: fileUrl || ''
    };

    const tempMessage = {
        id: Date.now(),
        sender_id: currentUser,
        receiver_id: partnerId,
        content: content,
        file_url: fileUrl,
        timestamp: new Date().toISOString(),
        message_type: fileUrl.includes('.mp4') || fileUrl.includes('.mov') ? 'video' : 
                     fileUrl.includes('.wav') || fileUrl.includes('.mp3') ? 'audio' : 'image',
        delivered: false,
        is_read: false
    };

    messages.push(tempMessage);
    saveMessages();
    displayMessages();

    fetch('/api/send_message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success || data.status === 'success') {
            const localMsg = messages.find(m => m.id === tempMessage.id);
            if (localMsg) {
                localMsg.server_id = data.message_id || data.id;
                localMsg.delivered = true;
                saveMessages();
                displayMessages();
            }
        }
    })
    .catch(error => {
        console.error('Send error:', error);
    });

    playSound('send');
}

// Voice recording
function toggleVoiceRecording() {
    if (!isRecording) {
        startVoiceRecording();
    } else {
        stopVoiceRecording();
    }
}

function startVoiceRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            uploadVoiceMessage(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;

        const voiceBtn = document.getElementById('voiceBtn');
        voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
        voiceBtn.style.background = '#dc3545';

        setTimeout(() => {
            if (isRecording) {
                stopVoiceRecording();
            }
        }, 60000);
    })
    .catch(error => {
        console.error('Error accessing microphone:', error);
        alert('Cannot access microphone. Please check permissions.');
    });
}

function stopVoiceRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;

        const voiceBtn = document.getElementById('voiceBtn');
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.style.background = '#075e54';
    }
}

function uploadVoiceMessage(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice_message.wav');

    fetch('/api/upload_file', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            sendMessageWithFile('🎤 Voice message', data.file_url);
        } else {
            alert('Error uploading voice message');
        }
    })
    .catch(error => {
        console.error('Voice upload error:', error);
        alert('Error uploading voice message');
    });
}

function playVoiceMessage(url, button) {
    const audio = new Audio(url);
    const icon = button.querySelector('i');

    button.disabled = true;
    icon.className = 'fas fa-spinner fa-spin';

    audio.play()
    .then(() => {
        icon.className = 'fas fa-pause';
        button.disabled = false;
    })
    .catch(error => {
        console.error('Error playing voice message:', error);
        icon.className = 'fas fa-play';
        button.disabled = false;
    });

    audio.onended = () => {
        icon.className = 'fas fa-play';
        button.disabled = false;
    };
}

// Message options and reactions
function showMessageOptions(index, event) {
    event.stopPropagation();

    console.log('Message options for index:', index);

    const message = messages[index];
    if (!message) {
        console.log('No message found for index:', index);
        return;
    }

    const existingMenu = document.querySelector('.message-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'message-context-menu';
    menu.style.cssText = 'position: fixed; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 8px 0; z-index: 10000; min-width: 150px; max-width: 200px; animation: fadeInScale 0.2s ease;';

    const options = [
        { text: '❤️ React', action: function() { reactToMessage(message.server_id || message.id, '❤️'); } },
        { text: '😂 React', action: function() { reactToMessage(message.server_id || message.id, '😂'); } },
        { text: '👍 React', action: function() { reactToMessage(message.server_id || message.id, '👍'); } },
        { text: '💕 React', action: function() { reactToMessage(message.server_id || message.id, '💕'); } }
    ];

    if (message.sender_id === currentUser) {
        options.push(
            { text: 'Delete for me', action: function() { deleteMessage(message.server_id || message.id, 'for_me'); } },
            { text: 'Delete for everyone', action: function() { deleteMessage(message.server_id || message.id, 'for_everyone'); } }
        );
    }

    options.forEach(function(option) {
        const item = document.createElement('div');
        item.textContent = option.text;
        item.style.cssText = 'padding: 12px 16px; cursor: pointer; transition: background 0.2s; font-size: 14px; white-space: nowrap;';
        item.onmouseover = function() { item.style.background = '#f5f5f5'; };
        item.onmouseout = function() { item.style.background = ''; };
        item.onclick = function(e) {
            e.stopPropagation();
            option.action();
            menu.remove();
        };
        menu.appendChild(item);
    });

    // Position the menu
    try {
        const rect = event.target.closest('.message-content').getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const menuWidth = 200;
        const menuHeight = options.length * 40;

        let left = rect.right + 10;
        let top = rect.top;

        // Adjust if menu would go off screen
        if (left + menuWidth > viewportWidth) {
            left = rect.left - menuWidth - 10;
        }

        if (top + menuHeight > viewportHeight) {
            top = viewportHeight - menuHeight - 10;
        }

        if (left < 10) left = 10;
        if (top < 10) top = 10;

        menu.style.left = left + 'px';
        menu.style.top = top + 'px';

        document.body.appendChild(menu);

        // Remove menu when clicking outside
        setTimeout(function() {
            const handleClick = function(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', handleClick);
                }
            };
            document.addEventListener('click', handleClick);
        }, 10);
    } catch (error) {
        console.error('Error positioning menu:', error);
        menu.remove();
    }
}

function reactToMessage(messageId, emoji) {
    if (!messageId) {
        console.error('No message ID provided for reaction');
        return;
    }

    console.log('Reacting to message:', messageId, 'with emoji:', emoji);

    fetch(`/api/react_message/${messageId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji: emoji })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Reaction response:', data);
        if (data.status === 'success') {
            setTimeout(() => {
                syncMessages();
            }, 500);
        } else {
            console.error('Reaction failed:', data.error);
        }
    })
    .catch(error => {
        console.error('React error:', error);
    });
}

function deleteMessage(messageId, deleteType) {
    if (!messageId) {
        console.error('No message ID provided for deletion');
        return;
    }

    const confirmMsg = deleteType === 'for_everyone' 
        ? 'Delete this message for everyone? This cannot be undone.'
        : 'Delete this message for you?';

    if (!confirm(confirmMsg)) {
        return;
    }

    console.log('Deleting message:', messageId, 'type:', deleteType);

    fetch(`/api/delete_message/${messageId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ delete_type: deleteType })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Delete response:', data);
        if (data.status === 'success') {
            // Update local messages immediately
            const msgIndex = messages.findIndex(m => 
                (m.server_id === messageId || m.id === messageId)
            );

            if (msgIndex !== -1) {
                if (deleteType === 'for_everyone') {
                    messages[msgIndex].deleted_for_everyone = true;
                } else if (messages[msgIndex].sender_id === currentUser) {
                    messages[msgIndex].deleted_for_sender = true;
                } else {
                    messages[msgIndex].deleted_for_receiver = true;
                }
                saveMessages();
                displayMessages();
            }

            setTimeout(() => {
                syncMessages();
            }, 500);
        } else {
            console.error('Delete failed:', data.error);
            alert('Failed to delete message: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Delete error:', error);
        alert('Error deleting message: ' + error.message);
    });
}

// Utility functions
function formatTime(date) {
    return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function openImageModal(imageUrl) {
    // Create modal for image viewing
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
    `;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
    `;

    modal.appendChild(img);
    document.body.appendChild(modal);

    modal.onclick = () => modal.remove();
}

// Presence and status
function initializePresence() {
    updateOnlineStatus(true);
    setInterval(() => {
        if (document.hasFocus()) {
            lastSeen = new Date();
            localStorage.setItem('lastSeen', lastSeen.toISOString());
        }
    }, 30000);
}

function updateOnlineStatus(online) {
    isOnline = online;
    const indicator = document.getElementById('onlineIndicator');
    const status = document.getElementById('partnerStatus');

    if (indicator && status) {
        if (online) {
            status.textContent = 'online';
            indicator.style.display = 'block';
        } else {
            status.textContent = 'last seen recently';
            indicator.style.display = 'none';
        }
    }
}

function updatePresence() {
    const random = Math.random();
    const partnerOnline = random > 0.3;
    updateOnlineStatus(partnerOnline);
}

function markMessagesAsRead() {
    const unreadMessages = messages.filter(msg => 
        msg.sender_id !== currentUser && !msg.is_read
    );

    if (unreadMessages.length > 0) {
        unreadMessages.forEach(msg => msg.is_read = true);
        saveMessages();

        fetch('/api/mark_read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message_ids: unreadMessages.map(m => m.server_id || m.id) 
            })
        });
    }
}

// Settings
function loadSettings() {
    const theme = localStorage.getItem('chatTheme') || 'love';
    const backgroundEnabled = localStorage.getItem('backgroundEnabled') !== 'false';
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';

    changeTheme(theme);

    const backgroundToggle = document.getElementById('backgroundToggle');
    const soundToggle = document.getElementById('soundToggle');

    if (backgroundToggle) backgroundToggle.checked = backgroundEnabled;
    if (soundToggle) soundToggle.checked = soundEnabled;

    if (!backgroundEnabled) {
        toggleBackground();
    }
}

function changeTheme(theme) {
    const container = document.querySelector('.whatsapp-container');
    if (container) {
        container.className = `whatsapp-container ${theme}`;
    }

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    localStorage.setItem('chatTheme', theme);
}

function toggleBackground() {
    const background = document.querySelector('.whatsapp-background');
    const toggle = document.getElementById('backgroundToggle');

    if (background && toggle) {
        const enabled = toggle.checked;
        background.style.display = enabled ? 'block' : 'none';
        localStorage.setItem('backgroundEnabled', enabled);
    }
}

function toggleSounds() {
    const toggle = document.getElementById('soundToggle');
    if (toggle) {
        const enabled = toggle.checked;
        localStorage.setItem('soundEnabled', enabled);
    }
}

function playSound(type) {
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    if (!soundEnabled) return;

    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'send') {
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        } else if (type === 'receive') {
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        }

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
        console.log('Sound not supported');
    }
}

// Menu functions
function toggleChatMenu() {
    const menu = document.getElementById('chatMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    if (panel) {
        panel.classList.toggle('open');
    }
}

function clearChat() {
    if (confirm('Clear all messages? This cannot be undone.')) {
        messages = [];
        saveMessages();
        displayMessages();
        const chatMenu = document.getElementById('chatMenu');
        if (chatMenu) chatMenu.style.display = 'none';
    }
}

function exportChat() {
    const data = {
        messages: messages,
        exportDate: new Date().toISOString(),
        participants: [currentUsername, currentUser === 1 ? 'spu' : 'navu']
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const chatMenu = document.getElementById('chatMenu');
    if (chatMenu) chatMenu.style.display = 'none';
}

function searchMessages() {
    const query = prompt('Search messages:');
    if (!query) return;

    const results = messages.filter(msg => 
        msg.content.toLowerCase().includes(query.toLowerCase())
    );

    if (results.length === 0) {
        alert('No messages found.');
        return;
    }

    console.log('Search results:', results);
    const chatMenu = document.getElementById('chatMenu');
    if (chatMenu) chatMenu.style.display = 'none';
}

// Placeholder functions for menu items
function viewContactInfo() {
    alert('Contact info feature coming soon!');
    const chatMenu = document.getElementById('chatMenu');
    if (chatMenu) chatMenu.style.display = 'none';
}

function selectMessages() {
    alert('Message selection feature coming soon!');
    const chatMenu = document.getElementById('chatMenu');
    if (chatMenu) chatMenu.style.display = 'none';
}

function muteNotifications() {
    alert('Mute notifications feature coming soon!');
    const chatMenu = document.getElementById('chatMenu');
    if (chatMenu) chatMenu.style.display = 'none';
}

// Main JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize AOS
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true
        });
    }

    // Chat functionality
    if (window.location.pathname === '/chat') {
        initializeChat();
    }

    // Period tracker
    if (window.location.pathname === '/period') {
        initializePeriodTracker();
    }
});

// Show options menu
document.addEventListener('click', function(e) {
    if (e.target.closest('.message-options-btn')) {
        const messageElement = e.target.closest('.message');
        const optionsMenu = messageElement.querySelector('.message-options');

        if (optionsMenu) {
            // Hide all other options menus
            document.querySelectorAll('.message-options').forEach(menu => {
                if (menu !== optionsMenu) {
                    menu.style.display = 'none';
                }
            });

            // Toggle current menu
            optionsMenu.style.display = optionsMenu.style.display === 'block' ? 'none' : 'block';
        }
    } else {
        // Hide all options menus when clicking outside
        document.querySelectorAll('.message-options').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

function initializePeriodTracker() {
    try {
        const lastPeriodInput = document.querySelector('input[name="last_period"]');
        const cycleLengthInput = document.querySelector('input[name="cycle_length"]');

        if (lastPeriodInput) {
            lastPeriodInput.max = new Date().toISOString().split('T')[0];
        }

        if (cycleLengthInput) {
            cycleLengthInput.addEventListener('input', function() {
                const value = parseInt(this.value);
                if (value < 21) this.value = 21;
                if (value > 35) this.value = 35;
            });
        }
    } catch (error) {
        console.error('Error initializing period tracker:', error);
    }
}