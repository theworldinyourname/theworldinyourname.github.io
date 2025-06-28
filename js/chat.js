// Chat system for Love App
// Handles messaging, reactions, and file sharing

// Message types
const MESSAGE_TYPES = {
    TEXT: 'text',
    IMAGE: 'image',
    VIDEO: 'video',
    FILE: 'file'
};

// Chat state
let messages = [];
let messageReactions = [];
let currentChatUser = null;
let typingTimer = null;
let selectedMessageId = null;

// Initialize chat system
function initializeChat() {
    loadMessages();
    loadMessageReactions();
    setupChatListeners();
    currentChatUser = getCurrentUser();
    
    // Mark messages as read when chat loads
    markMessagesAsRead();
}

// Load messages from storage
function loadMessages() {
    messages = getFromStorage('messages') || [];
    displayMessages();
}

// Load message reactions from storage
function loadMessageReactions() {
    messageReactions = getFromStorage('messageReactions') || [];
}

// Save messages to storage
function saveMessages() {
    saveToStorage('messages', messages);
}

// Save message reactions to storage
function saveMessageReactions() {
    saveToStorage('messageReactions', messageReactions);
}

// Display messages in chat
function displayMessages() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const currentUser = getCurrentUser();
    
    messagesContainer.innerHTML = messages.map(message => {
        const isSent = message.senderId === currentUser;
        const messageClass = isSent ? 'sent' : 'received';
        const reactions = getMessageReactions(message.id);
        
        let content = '';
        
        switch (message.type) {
            case MESSAGE_TYPES.TEXT:
                content = `<p>${sanitizeHTML(message.content)}</p>`;
                break;
            case MESSAGE_TYPES.IMAGE:
                content = `
                    <div class="message-image">
                        <img src="${message.fileUrl}" alt="Shared image" onclick="openImageModal('${message.fileUrl}')">
                    </div>
                    ${message.content ? `<p>${sanitizeHTML(message.content)}</p>` : ''}
                `;
                break;
            case MESSAGE_TYPES.VIDEO:
                content = `
                    <div class="message-video">
                        <video controls>
                            <source src="${message.fileUrl}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                    ${message.content ? `<p>${sanitizeHTML(message.content)}</p>` : ''}
                `;
                break;
            default:
                content = `<p>${sanitizeHTML(message.content)}</p>`;
        }
        
        return `
            <div class="message ${messageClass}" data-message-id="${message.id}">
                <div class="message-content" oncontextmenu="showMessageMenu(event, '${message.id}')">
                    ${content}
                    <div class="message-time">
                        ${formatMessageTime(message.timestamp)}
                        ${message.isEdited ? '<i class="fas fa-edit" title="Edited"></i>' : ''}
                        ${isSent && message.isRead ? '<i class="fas fa-check-double" title="Read"></i>' : ''}
                    </div>
                    ${reactions.length > 0 ? `
                        <div class="message-reactions">
                            ${reactions.map(reaction => `
                                <span class="reaction" onclick="toggleReaction('${message.id}', '${reaction.emoji}')">
                                    ${reaction.emoji} ${reaction.count}
                                </span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    scrollToBottom();
}

// Send a message
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    const content = messageInput.value.trim();
    if (!content) return;
    
    const message = {
        id: generateMessageId(),
        senderId: getCurrentUser(),
        receiverId: getOtherUser(),
        content: content,
        type: MESSAGE_TYPES.TEXT,
        timestamp: new Date().toISOString(),
        isRead: false,
        isEdited: false,
        deletedFor: []
    };
    
    // Add message
    messages.push(message);
    saveMessages();
    
    // Clear input
    messageInput.value = '';
    
    // Update display
    displayMessages();
    
    // Show typing stopped
    hideTypingIndicator();
    
    // Simulate message delivery (in real app, this would be handled by server)
    setTimeout(() => {
        markMessageAsDelivered(message.id);
    }, 100);
}

// Handle file upload
function handleFileUpload(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const fileUrl = e.target.result;
        let messageType = MESSAGE_TYPES.FILE;
        
        if (file.type.startsWith('image/')) {
            messageType = MESSAGE_TYPES.IMAGE;
        } else if (file.type.startsWith('video/')) {
            messageType = MESSAGE_TYPES.VIDEO;
        }
        
        const message = {
            id: generateMessageId(),
            senderId: getCurrentUser(),
            receiverId: getOtherUser(),
            content: '',
            type: messageType,
            fileUrl: fileUrl,
            fileName: file.name,
            fileSize: file.size,
            timestamp: new Date().toISOString(),
            isRead: false,
            isEdited: false,
            deletedFor: []
        };
        
        messages.push(message);
        saveMessages();
        displayMessages();
        
        // Mark as delivered
        setTimeout(() => {
            markMessageAsDelivered(message.id);
        }, 100);
    };
    
    reader.readAsDataURL(file);
}

// Handle key press in message input
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    } else {
        showTypingIndicator();
    }
}

// Show typing indicator
function showTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.display = 'block';
        scrollToBottom();
    }
    
    // Clear existing timer
    if (typingTimer) {
        clearTimeout(typingTimer);
    }
    
    // Hide after 3 seconds of no typing
    typingTimer = setTimeout(() => {
        hideTypingIndicator();
    }, 3000);
}

// Hide typing indicator
function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
    
    if (typingTimer) {
        clearTimeout(typingTimer);
        typingTimer = null;
    }
}

// Show message context menu
function showMessageMenu(event, messageId) {
    event.preventDefault();
    selectedMessageId = messageId;
    
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const currentUser = getCurrentUser();
    const isOwnMessage = message.senderId === currentUser;
    
    // Remove existing menu
    const existingMenu = document.querySelector('.message-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'message-context-menu';
    menu.style.cssText = `
        position: fixed;
        top: ${event.clientY}px;
        left: ${event.clientX}px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        min-width: 150px;
    `;
    
    const menuItems = [
        { text: 'React', icon: 'fas fa-smile', action: () => openEmojiModal() },
        { text: 'Copy', icon: 'fas fa-copy', action: () => copyMessage(messageId) }
    ];
    
    if (isOwnMessage) {
        menuItems.push(
            { text: 'Edit', icon: 'fas fa-edit', action: () => editMessage(messageId) },
            { text: 'Delete for me', icon: 'fas fa-trash', action: () => deleteMessage(messageId, 'me') },
            { text: 'Delete for everyone', icon: 'fas fa-trash-alt', action: () => deleteMessage(messageId, 'everyone') }
        );
    }
    
    menu.innerHTML = menuItems.map(item => `
        <div class="menu-item" onclick="${item.action.name}(); closeMessageMenu();" style="
            padding: 10px 15px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
        ">
            <i class="${item.icon}"></i>
            ${item.text}
        </div>
    `).join('');
    
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeMessageMenu, { once: true });
    }, 100);
}

// Close message context menu
function closeMessageMenu() {
    const menu = document.querySelector('.message-context-menu');
    if (menu) {
        menu.remove();
    }
}

// Open emoji modal for reactions
function openEmojiModal() {
    const modal = new bootstrap.Modal(document.getElementById('emojiModal'));
    modal.show();
}

// Add reaction to message
function addReaction(emoji) {
    if (!selectedMessageId) return;
    
    const currentUser = getCurrentUser();
    const existingReaction = messageReactions.find(
        r => r.messageId === selectedMessageId && r.userId === currentUser && r.emoji === emoji
    );
    
    if (existingReaction) {
        // Remove reaction
        const index = messageReactions.indexOf(existingReaction);
        messageReactions.splice(index, 1);
    } else {
        // Add reaction
        messageReactions.push({
            id: generateMessageId(),
            messageId: selectedMessageId,
            userId: currentUser,
            emoji: emoji,
            createdAt: new Date().toISOString()
        });
    }
    
    saveMessageReactions();
    displayMessages();
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('emojiModal'));
    modal.hide();
}

// Toggle reaction
function toggleReaction(messageId, emoji) {
    selectedMessageId = messageId;
    addReaction(emoji);
}

// Get reactions for a message
function getMessageReactions(messageId) {
    const reactions = messageReactions.filter(r => r.messageId === messageId);
    const grouped = {};
    
    reactions.forEach(reaction => {
        if (!grouped[reaction.emoji]) {
            grouped[reaction.emoji] = {
                emoji: reaction.emoji,
                count: 0,
                users: []
            };
        }
        grouped[reaction.emoji].count++;
        grouped[reaction.emoji].users.push(reaction.userId);
    });
    
    return Object.values(grouped);
}

// Copy message content
function copyMessage(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const text = message.content || 'Media message';
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Message copied to clipboard', 'success');
        });
    }
}

// Edit message
function editMessage(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (!message || message.senderId !== getCurrentUser()) return;
    
    const newContent = prompt('Edit message:', message.content);
    if (newContent !== null && newContent.trim() !== '') {
        message.content = newContent.trim();
        message.isEdited = true;
        message.editedAt = new Date().toISOString();
        
        saveMessages();
        displayMessages();
        
        showNotification('Message edited', 'success');
    }
}

// Delete message
function deleteMessage(messageId, deleteType) {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const currentUser = getCurrentUser();
    
    if (deleteType === 'everyone' && message.senderId !== currentUser) {
        showNotification('You can only delete your own messages for everyone', 'error');
        return;
    }
    
    if (deleteType === 'everyone') {
        // Mark message as deleted for everyone
        message.deletedFor = ['everyone'];
        message.content = 'This message was deleted';
        message.type = MESSAGE_TYPES.TEXT;
        message.deletedAt = new Date().toISOString();
    } else {
        // Mark message as deleted for current user only
        if (!message.deletedFor.includes(currentUser)) {
            message.deletedFor.push(currentUser);
        }
    }
    
    saveMessages();
    displayMessages();
    
    showNotification('Message deleted', 'success');
}

// Mark messages as read
function markMessagesAsRead() {
    const currentUser = getCurrentUser();
    let hasUnread = false;
    
    messages.forEach(message => {
        if (message.receiverId === currentUser && !message.isRead) {
            message.isRead = true;
            message.readAt = new Date().toISOString();
            hasUnread = true;
        }
    });
    
    if (hasUnread) {
        saveMessages();
        displayMessages();
    }
}

// Mark message as delivered
function markMessageAsDelivered(messageId) {
    const message = messages.find(m => m.id === messageId);
    if (message) {
        message.isDelivered = true;
        message.deliveredAt = new Date().toISOString();
        saveMessages();
        displayMessages();
    }
}

// Clear chat history
function clearChat() {
    if (confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
        messages = [];
        messageReactions = [];
        saveMessages();
        saveMessageReactions();
        displayMessages();
        
        showNotification('Chat history cleared', 'success');
    }
}

// Scroll to bottom of messages
function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }
}

// Format message timestamp
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // Less than 1 minute
        return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m ago`;
    } else if (date.toDateString() === now.toDateString()) { // Today
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

// Generate unique message ID
function generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Open image in modal
function openImageModal(imageUrl) {
    // Create modal if not exists
    let modal = document.getElementById('imageModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Image</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img id="modalImage" src="" alt="" class="img-fluid">
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Set image source and show modal
    document.getElementById('modalImage').src = imageUrl;
    new bootstrap.Modal(modal).show();
}

// Setup chat event listeners
function setupChatListeners() {
    // Listen for storage changes (for real-time updates across tabs)
    window.addEventListener('storage', function(e) {
        if (e.key === 'messages') {
            loadMessages();
        } else if (e.key === 'messageReactions') {
            loadMessageReactions();
            displayMessages();
        }
    });
    
    // Auto-save message draft
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', debounce(() => {
            const draft = messageInput.value;
            if (draft.trim()) {
                saveToStorage('messageDraft', draft);
            } else {
                removeFromStorage('messageDraft');
            }
        }, 500));
        
        // Load saved draft
        const savedDraft = getFromStorage('messageDraft');
        if (savedDraft) {
            messageInput.value = savedDraft;
        }
    }
}

// Initialize chat when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('chatMessages')) {
        initializeChat();
    }
});

// Export functions for global use
window.ChatAPI = {
    sendMessage,
    handleFileUpload,
    handleKeyPress,
    clearChat,
    addReaction,
    editMessage,
    deleteMessage,
    markMessagesAsRead,
    loadMessages,
    displayMessages
};
