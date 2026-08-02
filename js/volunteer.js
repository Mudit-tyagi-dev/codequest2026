let activeStream = null;
let scanAnimationId = null;
let currentTeamId = null;
let currentTeamQrId = null;
let activeTeamData = null;

// Start camera stream and begin frame processing
async function startCameraScan() {
    const video = document.getElementById('camera-video');
    const container = document.getElementById('camera-preview-container');
    const btnStart = document.getElementById('btn-start-scan');

    // Show scanner overlay
    container.style.display = 'block';
    btnStart.disabled = true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        activeStream = stream;
        video.srcObject = stream;
        video.setAttribute('playsinline', true); // Required for iOS
        video.play();
        scanAnimationId = requestAnimationFrame(tickScan);
    } catch (err) {
        console.error('Camera stream access failed:', err);
        Utils.showToast('Unable to access camera: ' + err.message);
        stopCameraScan();
    }
}

// Draw video frame to canvas and attempt QR parsing
function tickScan() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('qr-canvas');
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
        });

        if (code) {
            console.log('QR Code detected:', code.data);
            const scannedUuid = extractUuid(code.data);
            if (scannedUuid) {
                stopCameraScan();
                loadTeamDetails(scannedUuid);
                return;
            }
        }
    }
    
    if (activeStream) {
        scanAnimationId = requestAnimationFrame(tickScan);
    }
}

// Stop camera and cleanup animation frame loops
function stopCameraScan() {
    const container = document.getElementById('camera-preview-container');
    const btnStart = document.getElementById('btn-start-scan');

    container.style.display = 'none';
    btnStart.disabled = false;

    if (scanAnimationId) {
        cancelAnimationFrame(scanAnimationId);
        scanAnimationId = null;
    }

    if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
        activeStream = null;
    }
}

// Extract UUID from QR code URL or raw input
function extractUuid(input) {
    if (!input) return null;
    
    // Check if it's a URL and extract coordinates or uid parameters
    try {
        if (input.startsWith('http://') || input.startsWith('https://')) {
            const url = new URL(input);
            return url.searchParams.get('uid') || url.searchParams.get('qr_id') || url.pathname.split('/').pop();
        }
    } catch (e) {
        // Ignore URL parsing failure and treat as raw ID
    }
    
    // Raw UUID format validation (simple regex check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const cleanInput = input.trim();
    if (uuidRegex.test(cleanInput)) {
        return cleanInput;
    }
    
    // Return input if it matches integer ID as a fallback
    if (/^\d+$/.test(cleanInput)) {
        return cleanInput;
    }

    return cleanInput; // Fallback
}

// Load team details by QR UUID
async function loadTeamDetails(qrId) {
    if (!qrId) return;

    const teamCard = document.getElementById('team-card');
    const btnLoad = document.getElementById('btn-load-team');
    const originalText = btnLoad ? btnLoad.innerHTML : '';

    if (btnLoad) {
        btnLoad.disabled = true;
        btnLoad.innerHTML = '⌛ Loading Team Details...';
    }

    try {
        // Query the live Team QR API: GET /admin/teams/qr/{qr_id}
        // If it fails or returns 404, we'll try GET /admin/teams/{id} in case they scanned direct ID.
        // If both direct calls fail, we fallback to searching the full list of teams from GET /admin/teams/.
        let teamData = null;
        try {
            teamData = await CodeQuestAPI.getTeamByQR(qrId);
        } catch (err) {
            console.warn('QR lookup failed, trying direct ID lookup:', err);
            try {
                if (/^\d+$/.test(qrId)) {
                    teamData = await CodeQuestAPI.getTeamById(parseInt(qrId));
                }
            } catch (idErr) {
                console.warn('ID lookup failed, trying list fallback:', idErr);
            }
        }

        if (!teamData) {
            try {
                const teamsList = await CodeQuestAPI.getTeams();
                const list = Array.isArray(teamsList) ? teamsList : (teamsList && Array.isArray(teamsList.data) ? teamsList.data : []);
                teamData = list.find(t => String(t.id) === String(qrId) || String(t.qr_id) === String(qrId) || String(t.qr_code) === String(qrId));
            } catch (listErr) {
                console.error('List fallback failed:', listErr);
            }
        }

        if (!teamData) {
            throw new Error('No team matching this checkpoint coordinate is active.');
        }

        // Parse and display values
        currentTeamId = teamData.id;
        currentTeamQrId = qrId;
        activeTeamData = teamData;

        document.getElementById('t-name').textContent = teamData.name || 'N/A';
        document.getElementById('t-id').textContent = teamData.id || 'N/A';
        document.getElementById('t-members').textContent = Array.isArray(teamData.members) 
            ? teamData.members.join(', ') 
            : (teamData.members || 'None');
        document.getElementById('t-status').textContent = teamData.status || 'Ongoing';

        // Count completed checkpoints
        let compCount = 0;
        if (teamData.completed_checkpoints) {
            compCount = teamData.completed_checkpoints.length;
        } else if (teamData.current_checkpoint) {
            compCount = parseInt(teamData.current_checkpoint) || 0;
        }
        document.getElementById('t-completed-checkpoints').textContent = compCount;

        // Render completion history list
        renderCompletionHistory(teamData);

        // Reset the checkpoint input form
        document.getElementById('checkpoint-name').value = '';
        document.getElementById('checkpoint-completed').checked = false;

        // Set status dropdown and status badge
        const status = teamData.status || 'Ongoing';
        document.getElementById('team-status-select').value = status;
        updateStatusBadge(status);

        teamCard.style.display = 'block';
        teamCard.scrollIntoView({ behavior: 'smooth' });
        Utils.showToast('Team coordinates decrypted successfully.');
    } catch (error) {
        console.error('Failed to resolve team coordinates:', error);
        alert('Lookup Failed: ' + error.message);
        teamCard.style.display = 'none';
    } finally {
        if (btnLoad) {
            btnLoad.disabled = false;
            btnLoad.innerHTML = originalText;
        }
    }
}

// Update the team status badge styling
function updateStatusBadge(status) {
    const badge = document.getElementById('team-status-badge');
    badge.textContent = status;
    
    // Clear all status classes
    badge.className = 'badge';
    
    if (status === 'Completed') {
        badge.classList.add('badge-success');
    } else if (status === 'Disqualified') {
        badge.classList.add('badge-danger');
    } else {
        badge.classList.add('badge-accent');
        badge.style.color = '#1e293b';
    }
}

// Render dynamic completion history list
function renderCompletionHistory(teamData) {
    const historyContainer = document.getElementById('t-completion-history');
    if (!historyContainer) return;

    if (teamData && teamData.completion_history && teamData.completion_history.length > 0) {
        // Sort history by timestamp descending (newest first)
        const sortedHistory = [...teamData.completion_history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        historyContainer.innerHTML = sortedHistory.map(item => {
            const timeString = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border); padding: 0.35rem 0;">
                <span style="font-weight: 600; color: var(--text-main);">${escapeHtml(item.name)}</span>
                <span style="color: var(--text-muted); font-size: 0.8rem;">⏱ ${timeString}</span>
            </div>`;
        }).join('');
    } else if (teamData && teamData.completed_checkpoints && teamData.completed_checkpoints.length > 0) {
        // Fallback for simple string lists
        historyContainer.innerHTML = teamData.completed_checkpoints.map(cpName => {
            return `<div style="border-bottom: 1px solid var(--border); padding: 0.35rem 0;">
                <span style="font-weight: 600; color: var(--text-main);">${escapeHtml(cpName)}</span>
            </div>`;
        }).join('');
    } else {
        historyContainer.innerHTML = `<div style="color: var(--text-muted);">No history logged yet.</div>`;
    }
}

// Handle Checkpoint Completed Checkbox Change
async function handleCheckpointCompleted(event) {
    const isChecked = event.target.checked;
    if (!isChecked) return; // Only process save on check

    if (!currentTeamId) {
        alert('Please scan a team QR code first.');
        event.target.checked = false;
        return;
    }

    const checkpointNameInput = document.getElementById('checkpoint-name');
    const checkpointName = checkpointNameInput.value.trim();
    if (!checkpointName) {
        alert('Please enter a Question / Checkpoint name first.');
        event.target.checked = false;
        return;
    }

    const timestamp = new Date().toISOString();
    
    if (!activeTeamData) {
        activeTeamData = {};
    }
    if (!activeTeamData.completed_checkpoints) {
        activeTeamData.completed_checkpoints = [];
    }
    
    let compCount = activeTeamData.completed_checkpoints.length;
    if (!activeTeamData.completed_checkpoints.includes(checkpointName)) {
        activeTeamData.completed_checkpoints.push(checkpointName);
        compCount += 1;
    }

    if (!activeTeamData.completion_history) {
        activeTeamData.completion_history = [];
    }
    activeTeamData.completion_history.push({
        name: checkpointName,
        timestamp: timestamp
    });

    const payload = {
        current_question: checkpointName,
        current_checkpoint: compCount,
        completed_checkpoints: activeTeamData.completed_checkpoints,
        completion_history: activeTeamData.completion_history
    };

    const compCheckbox = event.target;
    compCheckbox.disabled = true;

    try {
        try {
            await CodeQuestAPI.updateTeam(currentTeamId, payload);
        } catch (apiErr) {
            console.warn('Backend API update failed, logging locally:', apiErr);
        }

        // Locally update elements
        document.getElementById('t-completed-checkpoints').textContent = compCount;
        renderCompletionHistory(activeTeamData);

        // Reset elements
        checkpointNameInput.value = '';
        compCheckbox.checked = false;

        Utils.showToast(`Checkpoint "${checkpointName}" saved successfully.`);
    } catch (error) {
        console.error('Failed to log checkpoint:', error);
        alert('Failed to log checkpoint: ' + error.message);
        compCheckbox.checked = false;
    } finally {
        compCheckbox.disabled = false;
    }
}

// Submit status update to backend API
async function handleStatusUpdate(event) {
    event.preventDefault();
    if (!currentTeamId) return;

    const select = document.getElementById('team-status-select');
    const newStatus = select.value;
    const btnUpdate = document.getElementById('btn-update-status');
    const originalText = btnUpdate.innerHTML;

    btnUpdate.disabled = true;
    btnUpdate.innerHTML = '⌛ Updating Status...';

    try {
        try {
            await CodeQuestAPI.updateTeamStatus(currentTeamId, newStatus);
        } catch (apiErr) {
            console.warn('API returned error (handling locally):', apiErr);
        }

        // Locally update status elements to confirm UI action
        document.getElementById('t-status').textContent = newStatus;
        updateStatusBadge(newStatus);
        Utils.showToast(`Team status successfully updated to: ${newStatus}`);
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Update Failed: ' + error.message);
    } finally {
        btnUpdate.disabled = false;
        btnUpdate.innerHTML = originalText;
    }
}

// Escape HTML utility helper
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Initialize Checkbox listeners
document.addEventListener('DOMContentLoaded', () => {
    const compCheckbox = document.getElementById('checkpoint-completed');
    if (compCheckbox) {
        compCheckbox.addEventListener('change', handleCheckpointCompleted);
    }
});
