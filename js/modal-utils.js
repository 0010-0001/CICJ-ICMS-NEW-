/**
 * Custom Modal System - Replaces browser's alert() and confirm()
 * Matches the system design with Bootstrap Icons
 */

// Initialize modal container on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('custom-modal-container')) {
        const container = document.createElement('div');
        container.id = 'custom-modal-container';
        document.body.appendChild(container);
    }
});

/**
 * Show a custom alert modal
 * @param {string} message - The message to display
 * @param {string} type - 'success', 'error', 'warning', or 'info' (auto-detected if not specified)
 * @returns {Promise} - Resolves when modal is closed
 */
function showAlert(message, type = null) {
    // Auto-detect type from message prefix if not specified
    if (!type) {
        if (message.startsWith('SUCCESS:') || message.includes('successfully') || message.includes('Successfully')) {
            type = 'success';
            message = message.replace(/^SUCCESS:\s*/, '');
        } else if (message.startsWith('ERROR:') || message.startsWith('Error:')) {
            type = 'error';
            message = message.replace(/^ERROR:\s*/, '');
        } else if (message.startsWith('WARNING:')) {
            type = 'warning';
            message = message.replace(/^WARNING:\s*/, '');
        } else {
            type = 'info';
        }
    }
    
    return new Promise((resolve) => {
        const container = document.getElementById('custom-modal-container') || document.body;
        
        // Determine icon and color based on type
        const config = {
            success: { icon: 'bi-check-circle-fill', color: '#2dad50', title: 'Success' },
            error: { icon: 'bi-x-circle-fill', color: '#ef4444', title: 'Error' },
            warning: { icon: 'bi-exclamation-triangle-fill', color: '#f59e0b', title: 'Warning' },
            info: { icon: 'bi-info-circle-fill', color: '#16a34a', title: 'Information' }
        };
        const { icon, color, title } = config[type] || config.info;
        
        // Format message (convert \n to <br>)
        const formattedMessage = message.replace(/\n/g, '<br>');
        
        // Create modal HTML
        const modalHTML = `
            <div class="custom-modal-overlay" id="alert-modal-overlay">
                <div class="custom-modal" style="--modal-accent:${color}; width: min(92vw, 640px); max-width: 640px;">
                    <div class="custom-modal-header">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="bi ${icon}" style="font-size: 28px; color: ${color};"></i>
                            <h3 style="margin: 0; color: ${color};">${title}</h3>
                        </div>
                    </div>
                    <div class="custom-modal-body">
                        <p style="white-space: pre-line; line-height: 1.6; margin: 0;">${formattedMessage}</p>
                    </div>
                    <div class="custom-modal-footer" style="justify-content: flex-end;">
                        <button class="btn-primary" id="alert-ok-btn">
                            OK
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = modalHTML;
        
        const overlay = document.getElementById('alert-modal-overlay');
        const okBtn = document.getElementById('alert-ok-btn');
        
        // Focus on OK button
        setTimeout(() => okBtn.focus(), 100);
        
        // Handle close
        const closeModal = () => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                container.innerHTML = '';
                resolve();
            }, 200);
        };
        
        okBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        
        // Allow Enter key to close
        const handleKeyPress = (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keypress', handleKeyPress);
            }
        };
        document.addEventListener('keypress', handleKeyPress);
    });
}

/**
 * Show a custom confirm modal
 * @param {string} message - The message to display
 * @param {string} title - Optional title (default: 'Confirm')
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
function showConfirm(message, title = 'Confirm Action') {
    return new Promise((resolve) => {
        const container = document.getElementById('custom-modal-container') || document.body;
        
        // Format message
        const formattedMessage = message.replace(/\n/g, '<br>');
        
        // Create modal HTML
        const modalHTML = `
            <div class="custom-modal-overlay" id="confirm-modal-overlay">
                <div class="custom-modal" style="--modal-accent:#2dad50; width: min(92vw, 640px); max-width: 640px;">
                    <div class="custom-modal-header">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="bi bi-question-circle-fill" style="font-size: 28px; color: #2dad50;"></i>
                            <h3 style="margin: 0; color: #2dad50;">${title}</h3>
                        </div>
                    </div>
                    <div class="custom-modal-body">
                        <p style="white-space: pre-line; line-height: 1.6; margin: 0;">${formattedMessage}</p>
                    </div>
                    <div class="custom-modal-footer" style="justify-content: flex-end; gap: 12px;">
                        <button class="btn-outline" id="confirm-cancel-btn">
                            <i class="bi bi-x-circle"></i> Cancel
                        </button>
                        <button class="btn-primary" id="confirm-ok-btn" style="background: #2dad50; border-color: #2dad50;">
                            <i class="bi bi-check-circle"></i> Confirm
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = modalHTML;
        
        const overlay = document.getElementById('confirm-modal-overlay');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        
        // Focus on confirm button
        setTimeout(() => okBtn.focus(), 100);
        
        // Handle close
        const closeModal = (result) => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                container.innerHTML = '';
                resolve(result);
            }, 200);
        };
        
        okBtn.addEventListener('click', () => closeModal(true));
        cancelBtn.addEventListener('click', () => closeModal(false));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(false);
        });
        
        // Handle keyboard
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                closeModal(true);
                document.removeEventListener('keypress', handleKeyPress);
            } else if (e.key === 'Escape') {
                closeModal(false);
                document.removeEventListener('keypress', handleKeyPress);
            }
        };
        document.addEventListener('keypress', handleKeyPress);
    });
}

/**
 * Show a custom prompt modal with input
 * @param {string} message - The message to display
 * @param {string} defaultValue - Default input value
 * @param {string} title - Modal title
 * @returns {Promise<string|null>} - Resolves to input value if confirmed, null if cancelled
 */
function showPrompt(message, defaultValue = '', title = 'Input Required') {
    return new Promise((resolve) => {
        const container = document.getElementById('custom-modal-container') || document.body;
        
        // Format message
        const formattedMessage = message.replace(/\n/g, '<br>');
        
        // Create modal HTML
        const modalHTML = `
            <div class="custom-modal-overlay" id="prompt-modal-overlay">
                <div class="custom-modal" style="--modal-accent:#2dad50; width: min(92vw, 640px); max-width: 640px;">
                    <div class="custom-modal-header">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="bi bi-pencil-square" style="font-size: 28px; color: #2dad50;"></i>
                            <h3 style="margin: 0; color: #2dad50;">${title}</h3>
                        </div>
                    </div>
                    <div class="custom-modal-body">
                        <p style="white-space: pre-line; line-height: 1.6; margin-bottom: 16px;">${formattedMessage}</p>
                        <input type="text" class="modern-input" id="prompt-input" value="${defaultValue}" 
                               style="width: 100%; padding: 12px; font-size: 16px;">
                    </div>
                    <div class="custom-modal-footer" style="justify-content: flex-end; gap: 12px;">
                        <button class="btn-outline" id="prompt-cancel-btn">
                            <i class="bi bi-x-circle"></i> Cancel
                        </button>
                        <button class="btn-primary" id="prompt-ok-btn">
                            <i class="bi bi-check-circle"></i> Confirm
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = modalHTML;
        
        const overlay = document.getElementById('prompt-modal-overlay');
        const input = document.getElementById('prompt-input');
        const okBtn = document.getElementById('prompt-ok-btn');
        const cancelBtn = document.getElementById('prompt-cancel-btn');
        
        // Focus on input and select text
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
        
        // Handle close
        const closeModal = (result) => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                container.innerHTML = '';
                resolve(result);
            }, 200);
        };
        
        okBtn.addEventListener('click', () => closeModal(input.value));
        cancelBtn.addEventListener('click', () => closeModal(null));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(null);
        });
        
        // Handle Enter in input
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                closeModal(input.value);
            }
        });
        
        // Handle Escape
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                closeModal(null);
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    });
}

// Export for use in other files
window.showAlert = showAlert;
window.showConfirm = showConfirm;
window.showPrompt = showPrompt;
