` tags.

```
<replit_final_file>
// Local Storage Management System
class StorageManager {
    constructor() {
        this.version = '1.0.0';
        this.init();
    }

    init() {
        this.migrateData();
        console.log('Storage system initialized');
    }

    migrateData() {
        const currentVersion = this.get('app_version');
        if (currentVersion !== this.version) {
            console.log('Migrating data to version', this.version);
            this.set('app_version', this.version);
        }
    }

    // Generic storage methods
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    }

    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Storage error:', e);
            return defaultValue;
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    }

    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    }

    // Authentication
    setCurrentUser(user) {
        this.set('current_user', user);
    }

    getCurrentUser() {
        return this.get('current_user');
    }

    clearCurrentUser() {
        this.remove('current_user');
    }

    // Chat Messages
    getMessages() {
        return this.get('chat_messages', []);
    }

    saveMessages(messages) {
        return this.set('chat_messages', messages);
    }

    addMessage(message) {
        const messages = this.getMessages();
        message.id = Date.now() + Math.random();
        message.timestamp = new Date().toISOString();
        messages.push(message);
        this.saveMessages(messages);
        return message;
    }

    deleteMessage(messageId, deleteType = 'for_me') {
        const messages = this.getMessages();
        const currentUser = this.getCurrentUser();

        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return false;

        const message = messages[messageIndex];

        if (deleteType === 'for_everyone') {
            message.deleted_for_everyone = true;
            message.content = 'This message was deleted';
        } else {
            if (currentUser && currentUser.username === 'navaneet') {
                message.deleted_for_sender = true;
            } else {
                message.deleted_for_receiver = true;
            }
        }

        this.saveMessages(messages);
        return true;
    }

    reactToMessage(messageId, emoji) {
        const messages = this.getMessages();
        const currentUser = this.getCurrentUser();

        const message = messages.find(m => m.id === messageId);
        if (!message) return false;

        if (!message.reactions) {
            message.reactions = {};
        }

        const userId = currentUser ? currentUser.username : 'guest';
        message.reactions[userId] = emoji;

        this.saveMessages(messages);
        return true;
    }

    // Period Tracker
    getPeriodData() {
        return this.get('period_data', {
            last_period: null,
            cycle_length: 26,
            period_length: 3,
            updated_at: null
        });
    }

    savePeriodData(data) {
        data.updated_at = new Date().toISOString();
        return this.set('period_data', data);
    }

    // Food Memories
    getFoodMemories() {
        return this.get('food_memories', []);
    }

    saveFoodMemories(memories) {
        return this.set('food_memories', memories);
    }

    addFoodMemory(memory) {
        const memories = this.getFoodMemories();
        memory.id = Date.now() + Math.random();
        memory.created_at = new Date().toISOString();
        memories.push(memory);
        this.saveFoodMemories(memories);
        return memory;
    }

    // Photo memories
    getPhotoMemories() {
        const memories = this.get('photo_memories', []);
        console.log('Retrieved photo memories:', memories.length, 'total');
        // Ensure all memories have proper data URLs and sort by newest first
        const validMemories = memories.filter(memory => {
            const isValid = memory && memory.data && (memory.data.startsWith('data:') || memory.data.startsWith('blob:'));
            if (!isValid) {
                console.log('Filtering out invalid memory:', memory);
            }
            return isValid;
        });
        
        // Sort by upload date (newest first)
        return validMemories.sort((a, b) => {
            const dateA = new Date(a.uploaded_at || a.uploadedAt || 0);
            const dateB = new Date(b.uploaded_at || b.uploadedAt || 0);
            return dateB - dateA;
        });
    }

    savePhotoMemories(memories) {
        console.log('Saving photo memories:', memories.length, 'total');
        // Filter out any invalid memories before saving
        const validMemories = memories.filter(memory => {
            const isValid = memory && memory.data && (memory.data.startsWith('data:') || memory.data.startsWith('blob:'));
            if (!isValid) {
                console.log('Removing invalid memory during save:', memory);
            }
            return isValid;
        });
        return this.set('photo_memories', validMemories);
    }

    addPhotoMemory(memory) {
        // Validate memory has proper data
        if (!memory || !memory.data || (!memory.data.startsWith('data:') && !memory.data.startsWith('blob:'))) {
            console.error('Invalid memory data:', memory);
            return null;
        }
        
        const memories = this.getPhotoMemories();
        memory.id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
        memory.uploaded_at = new Date().toISOString();
        memory.uploadedAt = memory.uploaded_at; // Ensure both formats are available
        memory.title = memory.title || memory.caption || memory.filename || 'Beautiful Memory';
        
        // Add to beginning of array (newest first)
        memories.unshift(memory);
        
        console.log('Adding new memory:', {
            id: memory.id,
            title: memory.title,
            hasData: !!memory.data,
            dataType: memory.data ? memory.data.substring(0, 20) + '...' : 'none'
        });
        
        const success = this.savePhotoMemories(memories);
        if (success) {
            console.log('Memory saved successfully. Total memories:', memories.length);
        } else {
            console.error('Failed to save memory');
        }
        
        return memory;
    }

    deletePhotoMemory(memoryId) {
        const memories = this.getPhotoMemories();
        const filteredMemories = memories.filter(m => m.id !== memoryId);
        this.savePhotoMemories(filteredMemories);
        return true;
    }

    // Profile Data
    getProfileData() {
        return this.get('profile_data', {
            profile_photo: null,
            sensitive_info: null
        });
    }

    saveProfileData(data) {
        return this.set('profile_data', data);
    }

    // Settings
    getSettings() {
        return this.get('app_settings', {
            theme: 'romantic',
            background: true,
            sounds: true,
            notifications: true
        });
    }

    saveSettings(settings) {
        return this.set('app_settings', settings);
    }

    // Chat Settings
    getChatSettings() {
        return this.get('chat_settings', {
            theme: 'light',
            background: true,
            sounds: true,
            typing_indicators: true,
            read_receipts: true
        });
    }

    saveChatSettings(settings) {
        return this.set('chat_settings', settings);
    }

    // User Presence
    getPresence() {
        return this.get('user_presence', {
            last_seen: new Date().toISOString(),
            is_online: true
        });
    }

    updatePresence() {
        const presence = {
            last_seen: new Date().toISOString(),
            is_online: true
        };
        this.set('user_presence', presence);
        return presence;
    }

    // Backup and Restore
    exportData() {
        const data = {
            version: this.version,
            exported_at: new Date().toISOString(),
            messages: this.getMessages(),
            period_data: this.getPeriodData(),
            food_memories: this.getFoodMemories(),
            photo_memories: this.getPhotoMemories(),
            profile_data: this.getProfileData(),
            settings: this.getSettings(),
            chat_settings: this.getChatSettings()
        };
        return JSON.stringify(data, null, 2);
    }

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);

            if (data.messages) this.saveMessages(data.messages);
            if (data.period_data) this.savePeriodData(data.period_data);
            if (data.food_memories) this.saveFoodMemories(data.food_memories);
            if (data.photo_memories) this.savePhotoMemories(data.photo_memories);
            if (data.profile_data) this.saveProfileData(data.profile_data);
            if (data.settings) this.saveSettings(data.settings);
            if (data.chat_settings) this.saveChatSettings(data.chat_settings);

            return true;
        } catch (e) {
            console.error('Import error:', e);
            return false;
        }
    }

    // File handling
    async saveFile(file, category = 'general') {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileData = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: e.target.result,
                    category: category,
                    uploaded_at: new Date().toISOString()
                };

                const files = this.get('uploaded_files', []);
                files.push(fileData);
                this.set('uploaded_files', files);

                resolve(fileData);
            };
            reader.readAsDataURL(file);
        });
    }

    getFiles(category = null) {
        const files = this.get('uploaded_files', []);
        return category ? files.filter(f => f.category === category) : files;
    }

    deleteFile(fileId) {
        const files = this.getFiles();
        const filteredFiles = files.filter(f => f.id !== fileId);
        this.set('uploaded_files', filteredFiles);
        return true;
    }

    // Journal Entries
    getJournalEntries() {
        return this.get('journal_entries', []);
    }

    saveJournalEntries(entries) {
        return this.set('journal_entries', entries);
    }

    addJournalEntry(entry) {
        const entries = this.getJournalEntries();
        entry.id = Date.now() + Math.random();
        entry.created_at = new Date().toISOString();
        entries.push(entry);
        this.saveJournalEntries(entries);
        return entry;
    }

    deleteJournalEntry(entryId) {
        const entries = this.getJournalEntries();
        const filteredEntries = entries.filter(e => e.id !== entryId);
        this.saveJournalEntries(filteredEntries);
        return true;
    }

    // Utility methods
    getStorageUsage() {
        let totalSize = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalSize += localStorage[key].length;
            }
        }
        return {
            used: totalSize,
            usedMB: (totalSize / 1024 / 1024).toFixed(2),
            available: 5 * 1024 * 1024 - totalSize, // Assuming 5MB limit
            availableMB: ((5 * 1024 * 1024 - totalSize) / 1024 / 1024).toFixed(2)
        };
    }

    cleanupOldData(daysOld = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        // Clean old messages
        const messages = this.getMessages();
        const recentMessages = messages.filter(m => {
            const messageDate = new Date(m.timestamp);
            return messageDate >= cutoffDate;
        });
        if (recentMessages.length !== messages.length) {
            this.saveMessages(recentMessages);
        }

        // Clean old files
        const files = this.getFiles();
        const recentFiles = files.filter(f => {
            const fileDate = new Date(f.uploaded_at);
            return fileDate >= cutoffDate;
        });
        if (recentFiles.length !== files.length) {
            this.set('uploaded_files', recentFiles);
        }

        return {
            messages_cleaned: messages.length - recentMessages.length,
            files_cleaned: files.length - recentFiles.length
        };
    }

    // Save love messages to localStorage
    saveLoveMessages: function(messages) {
        localStorage.setItem('loveMessages', JSON.stringify(messages));
    },

    // Get love messages from localStorage
    getLoveMessages: function() {
        const messages = localStorage.getItem('loveMessages');
        return messages ? JSON.parse(messages) : [];
    },

    // Save custom food places to localStorage
    saveCustomFoodPlaces: function(places) {
        localStorage.setItem('customFoodPlaces', JSON.stringify(places));
    },

    // Get custom food places from localStorage
    getCustomFoodPlaces: function() {
        const places = localStorage.getItem('customFoodPlaces');
        return places ? JSON.parse(places) : [];
    }
}

// Initialize storage manager
const storage = new StorageManager();

// Export for use in other scripts
window.storage = storage;