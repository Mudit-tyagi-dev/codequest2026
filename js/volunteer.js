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
    const submissionCard = document.getElementById('submission-card');
    Utils.showToast('Loading team details...');

    try {
        const teamData = await CodeQuestAPI.getVolunteerTeam(qrId);
        if (!teamData) {
            throw new Error('No team found for the scanned QR.');
        }

        currentTeamId = teamData.id;
        currentTeamQrId = qrId;
        activeTeamData = teamData;

        // Display permitted Team Information details
        document.getElementById('t-name').textContent = teamData.team_name || 'Unnamed Team';
        document.getElementById('t-leader').textContent = teamData.leader_name || 'None';
        document.getElementById('t-id').textContent = teamData.id || '-';
        document.getElementById('t-status').textContent = teamData.status || 'ongoing';
        document.getElementById('t-points').textContent = teamData.total_points !== undefined ? teamData.total_points : 0;
        document.getElementById('t-attempted').textContent = teamData.attempted_questions !== undefined ? teamData.attempted_questions : 0;

        // Local storage fallbacks for question details not returned in direct API
        const localQuestion = localStorage.getItem(`codequest_team_${teamData.id}_current_question`) || 'None';
        const localHintsUsed = localStorage.getItem(`codequest_team_${teamData.id}_hints_used`) || '0';

        document.getElementById('t-current-question').textContent = localQuestion;
        document.getElementById('t-hints-used').textContent = localHintsUsed;

        // Status Dropdown Setup
        let mappedStatus = (teamData.status || 'ongoing').toLowerCase();
        if (mappedStatus === 'winner') mappedStatus = 'completed';
        document.getElementById('team-status-select').value = mappedStatus;

        // Show Team and Submission cards
        teamCard.style.display = 'block';
        submissionCard.style.display = 'block';
        teamCard.scrollIntoView({ behavior: 'smooth' });
        Utils.showToast('Team coordinates decrypted.');
    } catch (error) {
        console.error('Failed to load team details:', error);
        alert('Lookup Failed: ' + error.message);
        teamCard.style.display = 'none';
        submissionCard.style.display = 'none';
    }
}

// Handle team status update
async function handleStatusUpdate(event) {
    event.preventDefault();
    if (!currentTeamQrId) return;

    const statusVal = document.getElementById('team-status-select').value;
    try {
        await CodeQuestAPI.updateVolunteerTeamStatus(currentTeamQrId, statusVal);
        Utils.showToast('Team status updated successfully.');
        await loadTeamDetails(currentTeamQrId);
    } catch (err) {
        console.error('Failed to update status:', err);
        alert('Status Update Failed: ' + err.message);
    }
}

// Handle question submission from Volunteer
async function handleQuestionSubmission(event) {
    event.preventDefault();
    if (!currentTeamQrId || !currentTeamId) {
        alert('No active team loaded.');
        return;
    }

    const questionId = parseInt(document.getElementById('sub-question-id').value);
    const rawStatus = document.getElementById('sub-status').value;
    const attempts = parseInt(document.getElementById('sub-attempts').value);
    const hintsUsed = parseInt(document.getElementById('sub-hints-used').value);
    const pointsAwarded = parseInt(document.getElementById('sub-points-awarded').value);
    const note = document.getElementById('sub-note').value.trim() || null;

    // Map wrong status to failed for the backend schema
    const apiStatus = rawStatus === 'wrong' ? 'failed' : rawStatus;

    const payload = {
        question_id: questionId,
        status: apiStatus,
        note: note,
        hints_used: hintsUsed,
        attempts: attempts,
        points_awarded: pointsAwarded
    };

    try {
        await CodeQuestAPI.submitVolunteerSubmission(currentTeamQrId, payload);
        
        // Save stats to LocalStorage to reflect in UI on refresh/re-scan
        localStorage.setItem(`codequest_team_${currentTeamId}_current_question`, 'Question ' + questionId);
        const prevHints = parseInt(localStorage.getItem(`codequest_team_${currentTeamId}_hints_used`) || '0');
        localStorage.setItem(`codequest_team_${currentTeamId}_hints_used`, prevHints + hintsUsed);

        Utils.showToast('Question submission recorded successfully.');
        
        // Reset form fields
        document.getElementById('sub-question-id').value = '';
        document.getElementById('sub-status').value = 'solved';
        document.getElementById('sub-attempts').value = '1';
        document.getElementById('sub-hints-used').value = '0';
        document.getElementById('sub-points-awarded').value = '0';
        document.getElementById('sub-note').value = '';

        // Reload details
        await loadTeamDetails(currentTeamQrId);
    } catch (err) {
        console.error('Submission failed:', err);
        alert('Submission Failed: ' + err.message);
    }
}

// Global hook for mock/console scanning
window.loadTeamDetails = loadTeamDetails;
