function setupNotificationSystem() {
    // Check for BroadcastChannel support with comprehensive fallback
    if ('BroadcastChannel' in window) {
        try {
            // Attempt to create BroadcastChannel
            window.broadcastChannel = new BroadcastChannel('ability-updates');
            console.log('✅ BroadcastChannel initialized successfully');
        } catch (error) {
            console.warn('⚠ BroadcastChannel creation failed, using fallback', error);
            window.broadcastChannel = createFallbackChannel();
        }
    } else {
        console.warn('⚠ BroadcastChannel not supported, using fallback');
        window.broadcastChannel = createFallbackChannel();
    }

    // Fallback channel implementation
    function createFallbackChannel() {
        const listeners = [];
        return {
            postMessage: (message) => {
                // Use localStorage as a fallback communication method
                localStorage.setItem('ability-updates', JSON.stringify(message));
                listeners.forEach(listener => listener(message));
            },
            addEventListener: (event, callback) => {
                if (event === 'message') {
                    const storageListener = (e) => {
                        if (e.key === 'ability-updates') {
                            const message = JSON.parse(e.newValue);
                            callback({ data: message });
                        }
                    };
                    window.addEventListener('storage', storageListener);
                    listeners.push(callback);
                }
            },
            close: () => {
                // Clean up listeners
                listeners.length = 0;
            }
        };
    }

    // Notification sound check
    try {
        console.log('playNotificationSound في النافذة العامة', typeof window.playNotificationSound);
    } catch (error) {
        console.error('❌ خطأ في إعداد نظام الإشعارات', error);
    } finally {
        console.groupEnd();
    }
}

// Call the setup function
setupNotificationSystem();
