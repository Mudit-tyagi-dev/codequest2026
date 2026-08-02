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
    
    // Success Toast Notification
    showToast(message) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span>🔔</span> <span>${message}</span>`;
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 50);
        
        // Fade out & delete
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
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
    }
};

window.Utils = Utils;
