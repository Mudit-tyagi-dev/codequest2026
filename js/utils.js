const Utils = {
    // Format image URLs from relative to absolute
    formatImageUrl(path) {
        if (!path) return '';
        // If it's already an absolute URL (starts with http:// or https://) or a data URI/blob URL, return it as is
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
            return path;
        }
        const base = window.CodeQuestAPI ? window.CodeQuestAPI.BASE_URL : 'https://api.shubhjain.info';
        if (path.startsWith('/')) {
            return base + path;
        }
        return base + '/' + path;
    },

    // URL Params
    getQueryParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },
    
    // Modal Helpers
    openModal(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },
    
    closeModal(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    },
    
    // Custom Loader HTML
    getLoaderHTML(message = 'Decrypting Mission Data...') {
        return `
            <div class="loader-container">
                <div class="dots-loader">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <p style="font-weight: 600; font-size: 0.9rem; color: var(--primary);">${message}</p>
            </div>
        `;
    },
    
    // Local Storage Helpers
    saveTeamAnswer(qrId, answer) {
        localStorage.setItem(`cq_ans_${qrId}`, JSON.stringify({
            answer,
            timestamp: new Date().toISOString()
        }));
    },
    
    getTeamAnswer(qrId) {
        const data = localStorage.getItem(`cq_ans_${qrId}`);
        return data ? JSON.parse(data) : null;
    },
    
    // Helper to reveal hint
    revealHint(qrId, orderNo) {
        const revealed = this.getRevealedHints(qrId);
        if (!revealed.includes(orderNo)) {
            revealed.push(orderNo);
            localStorage.setItem(`cq_hints_${qrId}`, JSON.stringify(revealed));
        }
    },
    
    getRevealedHints(qrId) {
        const data = localStorage.getItem(`cq_hints_${qrId}`);
        return data ? JSON.parse(data) : [];
    },
    
    // Human readable types
    getQuestionTypeLabel(type) {
        const types = {
            'mcq': 'Multiple Choice (MCQ)',
            'qna': 'Text / Short Answer',
            'coding': 'Reverse Coding / Code Snippet',
            'puzzle': 'Logic Puzzle / Riddle'
        };
        return types[type] || type.toUpperCase();
    },
    
    // Escape HTML strings to prevent XSS
    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    activeToasts: new Set(),
    
    // Multi-state Toast Notification
    showToast(message, type = 'success', duration = 3500) {
        if (!message) return;
        const msgKey = message.trim();
        if (this.activeToasts.has(msgKey)) {
            return; // Prevent duplicate toast
        }
        this.activeToasts.add(msgKey);

        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        
        let icon = '🔔';
        let bgStyle = 'var(--card-bg)';
        let borderStyle = '1px solid var(--border)';
        let borderLeft = '4px solid var(--primary)';
        let textColor = 'var(--text-main)';

        if (type === 'success') {
            icon = '✅';
            borderLeft = '4px solid var(--success)';
            bgStyle = 'rgba(16, 185, 129, 0.05)';
        } else if (type === 'error') {
            icon = '❌';
            borderLeft = '4px solid var(--error)';
            bgStyle = 'rgba(239, 68, 68, 0.05)';
            duration = duration === 3500 ? 5500 : duration; // Show error longer
        } else if (type === 'warning') {
            icon = '⚠️';
            borderLeft = '4px solid var(--accent)';
            bgStyle = 'rgba(244, 180, 0, 0.05)';
        } else if (type === 'info') {
            icon = 'ℹ️';
            borderLeft = '4px solid var(--info)';
            bgStyle = 'rgba(59, 130, 246, 0.05)';
        }

        toast.style.backgroundColor = bgStyle;
        toast.style.border = borderStyle;
        toast.style.borderLeft = borderLeft;
        toast.style.color = textColor;
        toast.style.fontWeight = '600';

        toast.innerHTML = `<span style="font-size: 1.1rem; flex-shrink: 0; line-height: 1;">${icon}</span> <span style="flex-grow: 1; line-height: 1.35;">${message}</span>`;
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 50);
        
        // Fade out & delete
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
                this.activeToasts.delete(msgKey);
            }, 300);
        }, duration);
    },

    // Promise-based Modern Alert Modal
    alert(title, message) {
        return new Promise((resolve) => {
            const modalId = 'alert-modal-' + Date.now();
            const modalOverlay = document.createElement('div');
            modalOverlay.id = modalId;
            modalOverlay.className = 'modal-overlay';
            modalOverlay.style.zIndex = '2000';
            
            modalOverlay.innerHTML = `
                <div class="modal-container" style="max-width: 400px; text-align: center;">
                    <div class="modal-header" style="justify-content: center; position: relative;">
                        <h3 class="modal-title" style="font-size: 1.2rem;">${this.escapeHtml(title)}</h3>
                    </div>
                    <div class="modal-body" style="padding: 1.5rem; font-size: 0.95rem; color: var(--text-main); line-height: 1.5;">
                        ${message}
                    </div>
                    <div class="modal-footer" style="justify-content: center; padding: 1rem 1.5rem;">
                        <button type="button" class="btn btn-primary btn-sm" id="${modalId}-ok" style="width: auto; min-width: 100px;">
                            OK
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modalOverlay);
            setTimeout(() => modalOverlay.classList.add('active'), 50);

            const cleanUp = () => {
                modalOverlay.classList.remove('active');
                setTimeout(() => {
                    modalOverlay.remove();
                    resolve();
                }, 250);
            };

            document.getElementById(`${modalId}-ok`).addEventListener('click', cleanUp);
        });
    },

    // Promise-based Modern Confirm Modal
    confirm(title, message, options = {}) {
        return new Promise((resolve) => {
            const confirmBtnText = options.confirmText || 'Confirm';
            const cancelBtnText = options.cancelText || 'Cancel';
            const isDanger = options.isDanger || false;

            const modalId = 'confirm-modal-' + Date.now();
            const modalOverlay = document.createElement('div');
            modalOverlay.id = modalId;
            modalOverlay.className = 'modal-overlay';
            modalOverlay.style.zIndex = '2000';
            
            modalOverlay.innerHTML = `
                <div class="modal-container" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3 class="modal-title" style="font-size: 1.2rem;">${this.escapeHtml(title)}</h3>
                    </div>
                    <div class="modal-body" style="padding: 1.5rem; font-size: 0.95rem; color: var(--text-main); line-height: 1.5;">
                        ${message}
                    </div>
                    <div class="modal-footer" style="display: flex; gap: 0.75rem; justify-content: flex-end; padding: 1rem 1.5rem;">
                        <button type="button" class="btn btn-secondary btn-sm" id="${modalId}-cancel" style="width: auto;">
                            ${this.escapeHtml(cancelBtnText)}
                        </button>
                        <button type="button" class="btn ${isDanger ? 'btn-danger' : 'btn-primary'} btn-sm" id="${modalId}-confirm" style="width: auto;">
                            ${this.escapeHtml(confirmBtnText)}
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modalOverlay);
            setTimeout(() => modalOverlay.classList.add('active'), 50);

            const cleanUp = (value) => {
                modalOverlay.classList.remove('active');
                setTimeout(() => {
                    modalOverlay.remove();
                    resolve(value);
                }, 250);
            };

            document.getElementById(`${modalId}-confirm`).addEventListener('click', () => cleanUp(true));
            document.getElementById(`${modalId}-cancel`).addEventListener('click', () => cleanUp(false));
        });
    },
    
    // Render Error Message Banner
    renderError(container, message, onRetry = null) {
        container.innerHTML = `
            <div class="card text-center" style="border-color: var(--error); padding: 3rem 1.5rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h3 style="color: var(--error); margin-bottom: 0.5rem;">Communication Failed</h3>
                <p style="margin-bottom: 1.5rem; max-width: 400px; margin-left: auto; margin-right: auto;">${message}</p>
                ${onRetry ? `<button class="btn btn-primary btn-sm" id="retry-btn" style="max-width: 150px; margin: 0 auto;">Retry</button>` : ''}
            </div>
        `;
        if (onRetry) {
            document.getElementById('retry-btn').addEventListener('click', onRetry);
        }
    },

    calculateHintPenalty(hintsUsed) {
        let penalty = 0;
        for (let i = 1; i <= hintsUsed; i++) {
            penalty += Math.max(0, i - 1);
        }
        return penalty;
    }
};

window.Utils = Utils;
