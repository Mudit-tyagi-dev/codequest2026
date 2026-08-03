let activeStream = null;
let scanAnimationId = null;
let currentTeamId = null;
let currentTeamQrId = null;
let activeTeamData = null;

// Start camera stream for QR scanning
async function startCameraScan() {
    const video = document.getElementById('camera-video');
    const container = document.getElementById('camera-preview-container');
    const btnStart = document.getElementById('btn-start-scan');

    container.style.display = 'block';
    btnStart.disabled = true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        activeStream = stream;
        video.srcObject = stream;
        video.setAttribute('playsinline', true);
        video.play();
        scanAnimationId = requestAnimationFrame(tickScan);
        Utils.showToast('Camera scanner started.');
    } catch (err) {
        console.error('Camera access failed:', err);
        Utils.showToast('Unable to access camera: ' + err.message);
        stopCameraScan();
    }
}

// Stop camera stream
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

// Process QR frames
async function tickScan() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('qr-canvas');
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let decodedCode = null;

        // Try BarcodeDetector
        if (typeof BarcodeDetector !== 'undefined') {
            try {
                const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
                const barcodes = await barcodeDetector.detect(canvas);
                if (barcodes.length > 0) {
                    decodedCode = barcodes[0].rawValue;
                }
            } catch (e) {
                console.warn('BarcodeDetector error, falling back to jsQR:', e);
            }
        }

        // Fallback to jsQR
        if (!decodedCode) {
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                });
                if (code) {
                    decodedCode = code.data;
                }
            } catch (e) {
                console.error('jsQR error:', e);
            }
        }

        if (decodedCode) {
            console.log('Scanned QR:', decodedCode);
            const scannedUuid = extractUuid(decodedCode);
            if (scannedUuid) {
                stopCameraScan();
                await loadTeamDetails(scannedUuid);
                return;
            }
        }
    }

    if (activeStream) {
        scanAnimationId = requestAnimationFrame(tickScan);
    }
}

// Robust UUID extractor
function extractUuid(input) {
    if (!input) return null;
    const cleanInput = input.trim();

    try {
        if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
            const url = new URL(cleanInput);
            
            // Check query string parameters
            const param = url.searchParams.get('qr_id') || url.searchParams.get('uid') || url.searchParams.get('id');
            if (param) return param.trim();

            // Check path parts
            const parts = url.pathname.split('/');
            for (const part of parts) {
                const cleanPart = part.trim();
                if (isUuid(cleanPart)) return cleanPart;
            }

            const lastPart = parts.pop();
            if (lastPart) return lastPart.trim();
        }
    } catch (err) {
        // Ignore URL parsing errors
    }

    if (isUuid(cleanInput)) return cleanInput;
    return cleanInput;
}

function isUuid(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

// Load team details by QR UUID
async function loadTeamDetails(qrId) {
    if (!qrId) return;

    const teamCard = document.getElementById('team-card');
    Utils.showToast('Loading team details...');

    try {
        let teamData = null;
        
        // Call GET /admin/teams/qr/{qr_id}
        try {
            teamData = await CodeQuestAPI.getTeamByQR(qrId);
        } catch (err) {
            console.warn('QR lookup failed, trying fallback direct ID:', err);
            if (/^\d+$/.test(qrId)) {
                teamData = await CodeQuestAPI.getTeamById(parseInt(qrId));
            }
        }

        // List fallback
        if (!teamData) {
            try {
                const list = await CodeQuestAPI.getTeams();
                const teams = Array.isArray(list) ? list : (list && Array.isArray(list.data) ? list.data : []);
                teamData = teams.find(t => String(t.qr_id) === String(qrId) || String(t.id) === String(qrId));
            } catch (listErr) {
                console.error('List fallback lookup failed:', listErr);
            }
        }

        if (!teamData) {
            throw new Error('No team found for the scanned QR.');
        }

        currentTeamId = teamData.id;
        currentTeamQrId = qrId;
        activeTeamData = teamData;

        // Display Team Information: Team Name, Members, Current Question, Current Checkpoint, Current Status
        document.getElementById('t-name').textContent = teamData.team_name || 'Unnamed Team';
        document.getElementById('t-members').textContent = teamData.leader_name || 'None';

        // Load local storage values for missing API fields (Current Question, Current Checkpoint, and Notes)
        const localQuestion = localStorage.getItem(`codequest_team_${teamData.id}_current_question`) || 'None';
        const localCheckpoint = localStorage.getItem(`codequest_team_${teamData.id}_current_checkpoint`) || '0';
        const localNotes = localStorage.getItem(`codequest_team_${teamData.id}_notes`) || '';

        document.getElementById('t-current-question').textContent = teamData.current_question || localQuestion;
        document.getElementById('t-current-checkpoint').textContent = teamData.current_checkpoint || localCheckpoint;
        document.getElementById('checkpoint-notes').value = localNotes;

        // Status Badge & Dropdown Mapping
        const displayStatus = mapBackendToUiStatus(teamData.status);
        document.getElementById('team-status-select').value = displayStatus;
        updateStatusBadge(displayStatus);

        // Show Team details card
        teamCard.style.display = 'block';
        teamCard.scrollIntoView({ behavior: 'smooth' });
        Utils.showToast('Team coordinates decrypted.');
    } catch (error) {
        console.error('Failed to load team details:', error);
        alert('Lookup Failed: ' + error.message);
        teamCard.style.display = 'none';
    }
}

// Status Mappings
function mapBackendToUiStatus(backendStatus) {
    if (!backendStatus) return 'Ongoing';
    const status = backendStatus.toLowerCase();
    if (status === 'winner') return 'Completed';
    if (status === 'disqualified' || status === 'rejected') return 'Disqualified';
    return 'Ongoing';
}

function mapUiToBackendStatus(uiStatus) {
    if (uiStatus === 'Completed') return 'winner';
    if (uiStatus === 'Disqualified') return 'disqualified';
    return 'registered'; // maps Ongoing to registered
}

function updateStatusBadge(status) {
    const badge = document.getElementById('team-status-badge');
    badge.textContent = status;
    badge.className = 'badge'; // reset

    if (status === 'Completed') {
        badge.classList.add('badge-success');
    } else if (status === 'Disqualified') {
        badge.classList.add('badge-danger');
    } else {
        badge.classList.add('badge-accent');
    }
}

// Save team progress
async function saveTeamProgress(event) {
    event.preventDefault();
    if (!currentTeamId) {
        alert('No team loaded.');
        return;
    }

    const selectStatus = document.getElementById('team-status-select').value;
    const notesText = document.getElementById('checkpoint-notes').value.trim();

    const saveButton = document.getElementById('btn-save-progress');
    const originalText = saveButton.innerHTML;

    saveButton.disabled = true;
    saveButton.innerHTML = '⌛ Saving Progress...';

    try {
        const mappedBackendStatus = mapUiToBackendStatus(selectStatus);

        // 1. Update status on backend
        await CodeQuestAPI.updateTeamStatus(currentTeamId, mappedBackendStatus);

        // 2. Save notes and parse updates locally (since backend endpoints are not available yet)
        localStorage.setItem(`codequest_team_${currentTeamId}_notes`, notesText);

        if (notesText) {
            // Simple parsing to extract current question (e.g. "Solved Question 4" -> Question 4)
            const questionMatch = notesText.match(/question\s*(\d+)/i) || notesText.match(/q\s*(\d+)/i);
            if (questionMatch) {
                localStorage.setItem(`codequest_team_${currentTeamId}_current_question`, 'Question ' + questionMatch[1]);
            }

            // Simple parsing to extract current checkpoint (e.g. "Checkpoint 3" -> 3)
            const checkpointMatch = notesText.match(/checkpoint\s*(\d+)/i);
            if (checkpointMatch) {
                localStorage.setItem(`codequest_team_${currentTeamId}_current_checkpoint`, checkpointMatch[1]);
            } else {
                // Increment checkpoint count if notes updated but no number is provided
                const oldNotes = localStorage.getItem(`codequest_team_${currentTeamId}_notes_history`) || '';
                if (notesText !== oldNotes) {
                    const currentVal = parseInt(localStorage.getItem(`codequest_team_${currentTeamId}_current_checkpoint`) || '0');
                    localStorage.setItem(`codequest_team_${currentTeamId}_current_checkpoint`, currentVal + 1);
                    localStorage.setItem(`codequest_team_${currentTeamId}_notes_history`, notesText);
                }
            }
        }

        // Reload UI fields
        await loadTeamDetails(currentTeamQrId);
        Utils.showToast('Progress saved successfully.');
    } catch (err) {
        console.error('Error saving progress:', err);
        alert('Save Failed: ' + err.message);
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = originalText;
    }
}

// Global hook for mock/console scanning
window.loadTeamDetails = loadTeamDetails;
