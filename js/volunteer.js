let activeStream = null;
let scanAnimationId = null;
let currentTeamId = null;
let currentTeamQrId = null;
let activeTeamData = null;
let originalSubmissionCardHTML = null;

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
        let totalHints = 0;
        const history = teamData.submissions || teamData.history || teamData.checkpoint_history || teamData.checkpoints || [];
        if (history.length > 0) {
            history.forEach(item => {
                const h = parseInt(item.hints_used || item.hint_count || item.hints || 0);
                totalHints += h;
            });
        } else {
            totalHints = parseInt(localStorage.getItem(`codequest_team_${teamData.id}_hints_used`) || '0');
        }

        const finalPoints = teamData.total_points !== undefined ? teamData.total_points : 0;

        document.getElementById('t-points').textContent = finalPoints;
        const attempted = parseInt(teamData.attempted_questions !== undefined ? teamData.attempted_questions : 0) || 0;
        document.getElementById('t-attempted').textContent = attempted;

        // Local storage fallbacks for question details not returned in direct API
        const localQuestion = localStorage.getItem(`codequest_team_${teamData.id}_current_question`) || 'None';

        document.getElementById('t-current-question').textContent = localQuestion;
        document.getElementById('t-hints-used').textContent = totalHints;

        // Status Dropdown Setup
        let mappedStatus = (teamData.status || 'ongoing').toLowerCase();
        if (mappedStatus === 'winner') mappedStatus = 'completed';
        document.getElementById('team-status-select').value = mappedStatus;

        if (attempted >= 7) {
            // Disable the submission form and show the success screen instead
            submissionCard.innerHTML = `
                <div style="text-align: center; padding: 1.5rem 1rem; background: var(--card-bg);">
                    <div style="font-size: 3.5rem; margin-bottom: 1rem;">🎉</div>
                    <h3 style="color: var(--primary); margin-bottom: 0.75rem; font-weight: 800;">Congratulations!</h3>
                    <p style="color: var(--text-main); font-weight: 700; font-size: 1.05rem; margin-bottom: 0.5rem; line-height: 1.4;">
                        You have successfully completed all 7 checkpoints.
                    </p>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.4;">
                        Please proceed to <strong style="color: var(--primary);">📍 AG-3 Lab</strong> for the Final Coding Round.
                    </p>
                    <div style="color: var(--error); font-weight: 700; font-size: 0.85rem; margin-bottom: 1.5rem; background-color: rgba(239, 68, 68, 0.05); padding: 0.75rem; border: 1px dashed var(--error); border-radius: var(--radius-sm); line-height: 1.4;">
                        This team has already completed all checkpoints.
                        <br>
                        Please direct them to AG-3 Lab for the Final Coding Round.
                    </div>
                    <button type="button" class="btn btn-primary" onclick="closeTeamDetails()" style="width: auto; padding-left: 2rem; padding-right: 2rem; margin: 0 auto; display: block;">
                        Go to AG-3 Lab
                    </button>
                </div>
            `;
            // Disable status form elements
            document.getElementById('team-status-select').disabled = true;
            const saveStatusBtn = document.querySelector('#team-card button[type="submit"]');
            if (saveStatusBtn) saveStatusBtn.disabled = true;
        } else {
            // Restore original submission card HTML
            if (originalSubmissionCardHTML) {
                submissionCard.innerHTML = originalSubmissionCardHTML;
            }
            // Re-enable status form elements
            document.getElementById('team-status-select').disabled = false;
            const saveStatusBtn = document.querySelector('#team-card button[type="submit"]');
            if (saveStatusBtn) saveStatusBtn.disabled = false;
            
            // Rebind the input event listeners to the new form elements!
            bindVolunteerFormListeners();
        }

        // Show Team and Submission cards
        teamCard.style.display = 'block';
        submissionCard.style.display = 'block';
        teamCard.scrollIntoView({ behavior: 'smooth' });
        Utils.showToast('Team coordinates decrypted.');
    } catch (error) {
        console.error('Failed to load team details:', error);
        Utils.showToast('Lookup Failed: ' + error.message, 'error');
        teamCard.style.display = 'none';
        submissionCard.style.display = 'none';
    }
}

// Handle team status update
async function handleStatusUpdate(event) {
    event.preventDefault();
    if (!currentTeamQrId) return;

    const statusVal = document.getElementById('team-status-select').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }

    try {
        await CodeQuestAPI.updateVolunteerTeamStatus(currentTeamQrId, statusVal);
        Utils.showToast('Team status updated successfully.');
        await loadTeamDetails(currentTeamQrId);
    } catch (err) {
        console.error('Failed to update status:', err);
        Utils.showToast('Status Update Failed: ' + err.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Status';
        }
    }
}

// Shared validator for volunteer form inputs
function validateVolunteerInputs({ questionIdStr, hintsUsedStr, attemptsStr, pointsAwardedStr }, originalPoints = null) {
    // 1. Question ID validation
    if (!questionIdStr) {
        return { isValid: false, message: 'Question ID cannot be empty.' };
    }
    const questionId = parseFloat(questionIdStr);
    if (isNaN(questionId) || !Number.isInteger(questionId) || questionId <= 0) {
        return { isValid: false, message: 'Question ID must be a valid positive integer.' };
    }

    // 2. Attempts validation
    if (!attemptsStr) {
        return { isValid: false, message: 'Attempts cannot be empty.' };
    }
    const attempts = parseFloat(attemptsStr);
    if (isNaN(attempts) || !Number.isInteger(attempts) || attempts < 1 || attempts > 2) {
        return { isValid: false, message: 'Attempts must be 1 or 2.' };
    }

    // 3. Hints Used validation
    if (!hintsUsedStr) {
        return { isValid: false, message: 'Hints Used cannot be empty.' };
    }
    const hintsUsed = parseFloat(hintsUsedStr);
    if (isNaN(hintsUsed) || !Number.isInteger(hintsUsed) || hintsUsed < 0 || hintsUsed > 3) {
        return { isValid: false, message: 'Hints Used must be between 0 and 3.' };
    }

    // 4. Points Awarded validation
    if (pointsAwardedStr !== undefined && pointsAwardedStr !== null) {
        if (!pointsAwardedStr) {
            return { isValid: false, message: 'Points Awarded cannot be empty.' };
        }
        const pointsAwarded = parseFloat(pointsAwardedStr);
        if (isNaN(pointsAwarded) || !Number.isInteger(pointsAwarded) || pointsAwarded < 0) {
            return { isValid: false, message: 'Points Awarded must be a non-negative integer.' };
        }
        if (originalPoints !== null && pointsAwarded > originalPoints) {
            return { isValid: false, message: `Points Awarded cannot exceed the original Question Points (${originalPoints}).` };
        }
    }

    return { isValid: true };
}

// Handle question submission from Volunteer
async function handleQuestionSubmission(event) {
    event.preventDefault();
    if (!currentTeamQrId || !currentTeamId) {
        Utils.showToast('No active team loaded.', 'warning');
        return;
    }

    if (activeTeamData && activeTeamData.attempted_questions !== undefined && parseInt(activeTeamData.attempted_questions) >= 7) {
        Utils.showToast('This team has already completed all checkpoints. Submission blocked.', 'error');
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');

    const questionIdInputVal = document.getElementById('sub-question-id').value.trim();
    const rawStatus = document.getElementById('sub-status').value;
    const attemptsVal = document.getElementById('sub-attempts').value.trim();
    const hintsUsedVal = document.getElementById('sub-hints-used').value.trim();
    const pointsAwardedVal = document.getElementById('sub-points-awarded').value.trim();
    const note = document.getElementById('sub-note').value.trim() || null;

    // Call shared validator
    let originalPoints = null;
    try {
        const qId = parseInt(questionIdInputVal);
        if (Number.isInteger(qId) && qId > 0) {
            const question = await CodeQuestAPI.getQuestion(qId);
            if (question) {
                originalPoints = question.points !== undefined ? question.points : 0;
            }
        }
    } catch (e) {}

    const validation = validateVolunteerInputs({
        questionIdStr: questionIdInputVal,
        hintsUsedStr: hintsUsedVal,
        attemptsStr: attemptsVal,
        pointsAwardedStr: pointsAwardedVal
    }, originalPoints);

    if (!validation.isValid) {
        Utils.showToast(validation.message, 'error');
        return;
    }

    const questionId = parseInt(questionIdInputVal);
    const attempts = parseInt(attemptsVal);
    const hintsUsed = parseInt(hintsUsedVal);
    const pointsAwarded = parseInt(pointsAwardedVal);

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    }

    // Fetch question to validate pointsAwarded <= question.points
    try {
        const question = await CodeQuestAPI.getQuestion(questionId);
        if (!question) {
            Utils.showToast('Question ID does not exist.', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Question';
            }
            return;
        }
        const originalPointsVal = question.points !== undefined ? question.points : 0;
        if (pointsAwarded > originalPointsVal) {
            Utils.showToast(`Points Awarded cannot exceed the original Question Points (${originalPointsVal}).`, 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Question';
            }
            return;
        }
    } catch (err) {
        console.error('Failed to validate question points:', err);
        Utils.showToast('Failed to validate Question ID / Points with the backend.', 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Question';
        }
        return;
    }

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

        // Save local history record to localStorage
        const historyKey = `cq_team_history_${currentTeamQrId}`;
        const localHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
        
        // Try to compute time taken if start time is present in localStorage
        const startSec = parseInt(localStorage.getItem(`cq_timer_start_${questionId}`)) || null;
        const timeTakenVal = startSec ? (Math.floor(Date.now() / 1000) - startSec) : null;

        const historyItem = {
            question_id: questionId,
            status: rawStatus, // solved, skipped, wrong
            hints_used: hintsUsed,
            attempts: attempts,
            points_awarded: pointsAwarded,
            note: note,
            time_taken: timeTakenVal,
            timestamp: new Date().toISOString()
        };
        localHistory.push(historyItem);
        localStorage.setItem(historyKey, JSON.stringify(localHistory));

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
        Utils.showToast('Submission Failed: ' + err.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Question';
        }
    }
}

// Global hook for mock/console scanning
window.loadTeamDetails = loadTeamDetails;

// Real-time update on localStorage change
window.addEventListener('storage', (e) => {
    if (currentTeamQrId && e.key && (e.key.startsWith('cq_hints_') || e.key.includes('hints_used') || e.key.includes('history'))) {
        loadTeamDetails(currentTeamQrId);
    }
});

async function validateFormInputsRealTime() {
    const questionIdInput = document.getElementById('sub-question-id');
    const hintsUsedInput = document.getElementById('sub-hints-used');
    const attemptsInput = document.getElementById('sub-attempts');
    const pointsAwardedInput = document.getElementById('sub-points-awarded');

    const questionIdStr = questionIdInput ? questionIdInput.value.trim() : '';
    const hintsUsedStr = hintsUsedInput ? hintsUsedInput.value.trim() : '';
    const attemptsStr = attemptsInput ? attemptsInput.value.trim() : '';
    const pointsAwardedStr = pointsAwardedInput ? pointsAwardedInput.value.trim() : '';

    if (!questionIdStr && !hintsUsedStr && !attemptsStr && !pointsAwardedStr) {
        return;
    }

    let originalPoints = null;
    if (questionIdStr) {
        const questionId = parseFloat(questionIdStr);
        if (Number.isInteger(questionId) && questionId > 0) {
            try {
                const question = await CodeQuestAPI.getQuestion(questionId);
                if (question) {
                    originalPoints = question.points !== undefined ? question.points : 0;
                }
            } catch (e) {}
        }
    }

    const validation = validateVolunteerInputs({
        questionIdStr,
        hintsUsedStr,
        attemptsStr,
        pointsAwardedStr
    }, originalPoints);

    if (!validation.isValid) {
        Utils.showToast(validation.message, 'error');
    }
}

function closeTeamDetails() {
    const teamCard = document.getElementById('team-card');
    const submissionCard = document.getElementById('submission-card');
    if (teamCard) teamCard.style.display = 'none';
    if (submissionCard) submissionCard.style.display = 'none';
    currentTeamId = null;
    currentTeamQrId = null;
    activeTeamData = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.closeTeamDetails = closeTeamDetails;

function bindVolunteerFormListeners() {
    const questionIdInput = document.getElementById('sub-question-id');
    const hintsUsedInput = document.getElementById('sub-hints-used');
    const attemptsInput = document.getElementById('sub-attempts');
    const pointsAwardedInput = document.getElementById('sub-points-awarded');

    if (questionIdInput) {
        questionIdInput.addEventListener('input', validateFormInputsRealTime);
        questionIdInput.addEventListener('blur', validateFormInputsRealTime);
    }
    if (hintsUsedInput) {
        hintsUsedInput.addEventListener('input', validateFormInputsRealTime);
        hintsUsedInput.addEventListener('blur', validateFormInputsRealTime);
    }
    if (attemptsInput) {
        attemptsInput.addEventListener('input', validateFormInputsRealTime);
        attemptsInput.addEventListener('blur', validateFormInputsRealTime);
    }
    if (pointsAwardedInput) {
        pointsAwardedInput.addEventListener('input', validateFormInputsRealTime);
        pointsAwardedInput.addEventListener('blur', validateFormInputsRealTime);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const submissionCard = document.getElementById('submission-card');
    if (submissionCard) {
        originalSubmissionCardHTML = submissionCard.innerHTML;
    }

    bindVolunteerFormListeners();
});
