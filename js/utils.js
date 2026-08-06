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

    toastQueue: [],
    isToastActive: false,
    currentToastMessage: null,
    
    // Queue-based Toast Notification (one visible at a time)
    showToast(message, type = 'success', duration = 2800) {
        if (!message) return;
        
        const msgText = message.trim();
        const isDuplicate = this.toastQueue.some(t => t.message === msgText) || 
                            (this.isToastActive && this.currentToastMessage === msgText);
        if (isDuplicate) {
            return;
        }

        this.toastQueue.push({ message: msgText, type, duration });
        this.processToastQueue();
    },

    processToastQueue() {
        if (this.isToastActive || this.toastQueue.length === 0) {
            return;
        }

        const current = this.toastQueue.shift();
        this.currentToastMessage = current.message;
        this.isToastActive = true;

        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        container.style.setProperty('z-index', '99999', 'important');

        const toast = document.createElement('div');
        toast.className = 'toast';
        
        let icon = '🔔';
        let bgStyle = '';

        if (current.type === 'success') {
            icon = '✅';
            bgStyle = '#10b981';
        } else if (current.type === 'error') {
            icon = '❌';
            bgStyle = '#ef4444';
        } else if (current.type === 'warning') {
            icon = '⚠️';
            bgStyle = '#f59e0b';
        } else if (current.type === 'info') {
            icon = 'ℹ️';
            bgStyle = '#3b82f6';
        } else {
            bgStyle = '#6366f1';
        }

        toast.style.setProperty('background-color', bgStyle, 'important');
        toast.style.setProperty('color', '#ffffff', 'important');
        toast.style.setProperty('border-left', 'none', 'important');
        toast.style.setProperty('padding', '0.75rem 1.25rem', 'important');
        toast.style.setProperty('box-shadow', '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', 'important');
        
        if (window.innerWidth <= 768) {
            toast.style.setProperty('margin', '0 auto', 'important');
            toast.style.setProperty('width', '100%', 'important');
            toast.style.setProperty('max-width', '340px', 'important');
        } else {
            toast.style.setProperty('margin-left', 'auto', 'important');
            toast.style.setProperty('margin-right', '0', 'important');
            toast.style.setProperty('width', '100%', 'important');
            toast.style.setProperty('max-width', '320px', 'important');
        }

        toast.innerHTML = `<span style="font-size: 1.1rem; flex-shrink: 0; line-height: 1;">${icon}</span> <span style="flex-grow: 1; line-height: 1.4;">${current.message}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 50);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
                this.currentToastMessage = null;
                this.isToastActive = false;
                this.processToastQueue();
            }, 300);
        }, current.duration);
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
