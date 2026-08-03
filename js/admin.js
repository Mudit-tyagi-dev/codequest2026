let selectedImageBlob = null;
let questionsList = [];

document.addEventListener('DOMContentLoaded', () => {
    loadQuestionsList();
    loadTeamsList();
});

// Switch Tab logic
function switchTab(tabId) {
    // Update button states
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Find matching button and activate
    const activeBtn = Array.from(buttons).find(btn => btn.getAttribute('onclick').includes(tabId));
    if (activeBtn) activeBtn.classList.add('active');

    // Update tab visibility
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

// Fetch and render saved questions
async function loadQuestionsList() {
    const tableBody = document.getElementById('questions-table-body');
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 2rem;">⌛ Loading questions...</td></tr>`;

    try {
        const responseData = await CodeQuestAPI.getQuestions();
        let questions = [];
        if (Array.isArray(responseData)) {
            questions = responseData;
        } else if (responseData) {
            if (Array.isArray(responseData.data)) {
                questions = responseData.data;
            } else if (Array.isArray(responseData.questions)) {
                questions = responseData.questions;
            } else if (Array.isArray(responseData.items)) {
                questions = responseData.items;
            }
        }

        console.log("Questions:", questions);

        questionsList = questions;
        populateQuestionsDropdown();
        tableBody.innerHTML = '';

        if (questions && questions.length > 0) {
            questions.forEach(q => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight: 600; color: var(--text-main);">${escapeHtml(q.title)}</td>
                    <td><span class="badge badge-primary" style="font-size: 0.65rem; text-transform: capitalize;">${q.question_type}</span></td>
                    <td><span class="badge badge-accent" style="font-size: 0.65rem; color: #1e293b;">${q.points} Pts</span></td>
                    <td>
                        <span class="badge ${q.is_active ? 'badge-success' : 'badge-neutral'}" style="font-size: 0.65rem;">
                            ${q.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td style="text-align: center;">
                        <button class="btn btn-secondary btn-sm" onclick="showQRModal(${q.id}, '${escapeHtml(q.title)}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto; border-radius: var(--radius-sm);">
                            🔍 View QR
                        </button>
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-secondary btn-sm" onclick="previewQuestion(${q.id})" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; border-radius: var(--radius-sm); margin-right: 0.25rem;">👁 Preview</button>
                        <button class="btn btn-secondary btn-sm" onclick="editQuestion(${q.id})" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; border-radius: var(--radius-sm); margin-right: 0.25rem; border-color: var(--info); color: var(--info);">✏️ Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteQuestion(${q.id})" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; border-radius: var(--radius-sm);">🗑 Delete</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        } else {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center" style="padding: 3rem;">
                        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📭</div>
                        <h4 style="color: var(--text-muted);">No Questions Found</h4>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Failed to load questions:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="padding: 2rem; color: var(--error);">
                    Failed to retrieve questions. <span style="text-decoration: underline; cursor: pointer; font-weight: bold;" onclick="loadQuestionsList()">Retry</span>
                </td>
            </tr>
        `;
    }
}

// Fetch and render scoreboard/teams list
async function loadTeamsList() {
    const tableBody = document.getElementById('teams-table-body');
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 2rem;">⌛ Loading teams...</td></tr>`;

    try {
        let teams = [];
        try {
            const responseData = await CodeQuestAPI.getTeams();
            if (Array.isArray(responseData)) {
                teams = responseData;
            } else if (responseData && Array.isArray(responseData.data)) {
                teams = responseData.data;
            }
        } catch (apiErr) {
            console.warn('Listing teams failed (GET /admin/teams/ returns 404). Adding search fallback.');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center" style="padding: 2rem;">
                        <p style="margin-bottom: 1rem; color: var(--text-muted);">
                            The backend scoreboard is currently structured for direct team lookup.
                        </p>
                        <div style="display: flex; gap: 0.5rem; justify-content: center; max-width: 420px; margin: 0 auto;">
                            <input type="text" id="team-lookup-id" class="form-control" placeholder="Enter Team ID or QR UUID..." style="padding: 0.5rem 1rem;">
                            <button class="btn btn-primary btn-sm" onclick="lookupTeamFromScoreboard()" style="width: auto;">Search</button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = '';
        if (teams && teams.length > 0) {
            renderTeams(teams);
        } else {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center" style="padding: 3rem;">
                        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📭</div>
                        <h4 style="color: var(--text-muted);">No Active Teams Registered</h4>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Failed to load scoreboard:', error);
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 2rem; color: var(--error);">Error loading scoreboard.</td></tr>`;
    }
}

// Lookup a specific team in tab-teams
async function lookupTeamFromScoreboard() {
    const searchId = document.getElementById('team-lookup-id').value.trim();
    if (!searchId) {
        Utils.showToast('Please enter a team ID or UUID.');
        return;
    }

    const tableBody = document.getElementById('teams-table-body');
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 2rem;">⌛ Decrypting team coordinates...</td></tr>`;

    try {
        let teamData = null;
        try {
            teamData = await CodeQuestAPI.getTeamByQR(searchId);
        } catch (err) {
            if (/^\d+$/.test(searchId)) {
                teamData = await CodeQuestAPI.getTeamById(parseInt(searchId));
            } else {
                throw err;
            }
        }

        if (teamData) {
            renderTeams([teamData]);
        } else {
            throw new Error('Team not found.');
        }
    } catch (error) {
        Utils.showToast('Team not found: ' + error.message);
        loadTeamsList(); // Restore search box
    }
}

function renderTeams(teams) {
    const tableBody = document.getElementById('teams-table-body');
    tableBody.innerHTML = '';
    teams.forEach(t => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.title = 'Click to manage team progress';
        tr.onclick = (event) => {
            if (event.target.closest('button') || event.target.closest('a')) {
                return;
            }
            loadAdminTeamDetails(t.qr_id || t.id);
        };
        
        const teamName = t.team_name || t.name || 'Unnamed Team';
        const membersVal = Array.isArray(t.members) ? t.members.join(', ') : (t.members || t.leader_name || 'None');
        const displayStatus = mapBackendToUiStatus(t.status);
        
        let statusClass = 'badge-neutral';
        if (displayStatus === 'Completed') statusClass = 'badge-success';
        if (displayStatus === 'Disqualified') statusClass = 'badge-danger';
        if (displayStatus === 'Ongoing') statusClass = 'badge-accent';

        const currentCheckpoint = t.current_checkpoint || localStorage.getItem(`codequest_team_${t.id}_current_checkpoint`) || '0';
        const currentQuestion = t.current_question || localStorage.getItem(`codequest_team_${t.id}_current_question`) || 'None';

        const qrUrl = t.qr_url;
        const qrFullUrl = qrUrl ? (CodeQuestAPI.BASE_URL + qrUrl) : '';
        
        let actionButtons = '';
        if (qrUrl) {
            actionButtons = `
                <button type="button" class="btn btn-secondary btn-sm" onclick="showTeamQRModal('${escapeHtml(teamName)}', '${t.qr_id}', '${escapeHtml(qrUrl)}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto; border-radius: var(--radius-sm); margin-right: 0.25rem;">🔍 Preview QR</button>
                <a href="${qrFullUrl}" download="team_${teamName.replace(/\s+/g, '_')}_QR.png" class="btn btn-primary btn-sm" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto; border-radius: var(--radius-sm); text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">📥 Download QR</a>
            `;
        } else {
            actionButtons = `
                <button type="button" class="btn btn-secondary btn-sm" onclick="showTeamQRModal('${escapeHtml(teamName)}', '${t.qr_id}', '')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto; border-radius: var(--radius-sm); margin-right: 0.25rem;">🔍 Preview QR</button>
                <button type="button" class="btn btn-primary btn-sm" disabled style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto; border-radius: var(--radius-sm); opacity: 0.5;">📥 Download QR</button>
            `;
        }

        tr.innerHTML = `
            <td style="font-family: monospace; font-size: 0.85rem; font-weight: 700;">${t.id}</td>
            <td style="font-weight: 600; color: var(--text-main);">${escapeHtml(teamName)}</td>
            <td style="font-size: 0.85rem;">${escapeHtml(membersVal)}</td>
            <td><span class="badge ${statusClass}" style="font-size: 0.65rem;">${displayStatus}</span></td>
            <td><span class="badge badge-primary" style="font-size: 0.65rem;">CP #${currentCheckpoint}</span></td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(currentQuestion)}</td>
            <td style="text-align: right; white-space: nowrap;">
                ${actionButtons}
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// CRUD: Edit Question
async function editQuestion(id) {
    try {
        const q = await CodeQuestAPI.getQuestionById(id);
        if (!q) throw new Error('Question data not found.');

        openCreateModal(true);
        document.getElementById('modal-title-text').textContent = 'Edit Question';
        document.getElementById('edit-question-id').value = q.id;

        document.getElementById('title').value = q.title;
        document.getElementById('description').value = q.description;
        document.getElementById('question_type').value = q.question_type;
        document.getElementById('points').value = q.points;
        document.getElementById('time_limit_seconds').value = q.time_limit_seconds || '';
        document.getElementById('is_active').checked = q.is_active;

        toggleTypeSpecificSections();

        if (q.question_type !== 'mcq') {
            document.getElementById('correct_ans').value = q.correct_ans || '';
        } else {
            const container = document.getElementById('options-container');
            container.innerHTML = '';
            if (q.options && q.options.length > 0) {
                q.options.forEach(opt => {
                    addOptionRow(opt.text, opt.is_correct, opt.label);
                });
            }
        }

        // Render Hints
        const hintsContainer = document.getElementById('hints-container');
        hintsContainer.innerHTML = '';
        if (q.hints && q.hints.length > 0) {
            q.hints.sort((a, b) => a.order_no - b.order_no).forEach(hint => {
                addHintRow(hint.text, hint.penalty);
            });
        }

        // Image Preview
        if (q.image_url) {
            showImagePreview(Utils.formatImageUrl(q.image_url));
        }

    } catch (err) {
        console.error('Failed to load edit model:', err);
        alert('Load Edit Failed: ' + err.message);
    }
}

// CRUD: Delete Question
async function deleteQuestion(id) {
    if (confirm('Are you absolutely sure you want to delete this challenge? This action is permanent.')) {
        try {
            await CodeQuestAPI.deleteQuestion(id);
            Utils.showToast('Question deleted successfully.');
            loadQuestionsList();
        } catch (error) {
            console.error('Delete question failed:', error);
            alert('Delete Failed: ' + error.message);
        }
    }
}

// Show QR Code in Modal Viewer
async function showQRModal(id, title) {
    const modalImage = document.getElementById('qr-modal-image');
    const modalId = document.getElementById('qr-modal-id');
    const modalDownload = document.getElementById('qr-modal-download');
    
    document.getElementById('qr-modal-title').textContent = `${title} • QR Coordinates`;
    modalImage.src = '';
    modalImage.alt = 'Generating QR...';
    modalId.textContent = `ID: ${id}`;
    
    Utils.openModal('qr-modal');

    try {
        const qrRes = await CodeQuestAPI.generateQR(id);
        let qrUrl = '';
        if (qrRes && qrRes.isBlob) {
            qrUrl = URL.createObjectURL(qrRes.blob);
        } else if (typeof qrRes === 'string') {
            qrUrl = Utils.formatImageUrl(qrRes);
        } else if (qrRes && (qrRes.qr_code || qrRes.qr_path || qrRes.qr_url || qrRes.path || qrRes.url)) {
            const path = qrRes.qr_code || qrRes.qr_path || qrRes.qr_url || qrRes.path || qrRes.url;
            qrUrl = Utils.formatImageUrl(path);
        }

        if (qrUrl) {
            modalImage.src = qrUrl;
            modalImage.alt = 'QR Code';
            modalImage.style.display = 'block';
            modalDownload.style.display = 'inline-flex';
            
            modalDownload.href = qrUrl;
            modalDownload.download = `question_QR_${id}.png`;
        } else {
            throw new Error('API response did not return a valid QR.');
        }
    } catch (err) {
        console.error('QR display error:', err);
        modalImage.alt = 'Failed to generate QR: ' + err.message;
    }
}

// Question Live Preview in Modal
function previewQuestion(id) {
    const q = questionsList.find(item => item.id === id);
    if (!q) return;

    // Use volunteer modal template logic locally inside an overlay (reusing HTML5 preview if wanted)
    // Simply opening in question.html page as a preview is cleaner
    window.open(`question.html?id=${q.id}`, '_blank');
}

// Modal open/close controls
function openCreateModal(isEdit = false) {
    document.getElementById('question-modal').classList.add('active');
    document.body.style.overflow = 'hidden';

    if (!isEdit) {
        document.getElementById('modal-title-text').textContent = 'Create Question';
        document.getElementById('question-form').reset();
        document.getElementById('edit-question-id').value = '';
        document.getElementById('options-container').innerHTML = '';
        document.getElementById('hints-container').innerHTML = '';
        clearSelectedImage();
        toggleTypeSpecificSections();
    }
}

function closeQuestionModal() {
    document.getElementById('question-modal').classList.remove('active');
    document.body.style.overflow = '';
}

// Toggle MCQ Options layout
function toggleTypeSpecificSections() {
    const question_type = document.getElementById('question_type').value;
    const correctAnsContainer = document.getElementById('correct-ans-container');
    const mcqOptionsSection = document.getElementById('mcq-options-section');
    
    if (question_type === 'mcq') {
        correctAnsContainer.style.display = 'none';
        mcqOptionsSection.style.display = 'block';
        
        const optionsContainer = document.getElementById('options-container');
        if (optionsContainer.querySelectorAll('.option-item-row').length === 0) {
            addOptionRow('', false);
            addOptionRow('', false);
            addOptionRow('', false);
            addOptionRow('', false);
        }
    } else {
        correctAnsContainer.style.display = 'block';
        mcqOptionsSection.style.display = 'none';
    }
}

// Add MCQ Option row
function addOptionRow(text = '', isCorrect = false, fixedLabel = null) {
    const container = document.getElementById('options-container');
    const existingRows = container.querySelectorAll('.option-item-row');
    if (existingRows.length >= 4) {
        Utils.showToast('Maximum of 4 options allowed (A, B, C, D).');
        return;
    }
    
    const labels = ['A', 'B', 'C', 'D'];
    const nextLabel = fixedLabel || labels[existingRows.length];
    
    const row = document.createElement('div');
    row.className = 'option-item-row';
    row.style.border = '1px solid var(--border)';
    row.style.borderRadius = 'var(--radius-sm)';
    row.style.padding = '0.75rem 1rem';
    row.style.marginBottom = '0.5rem';
    row.style.backgroundColor = 'var(--bg)';
    
    row.innerHTML = `
        <div class="dynamic-row dynamic-row-options" style="grid-template-columns: 80px 3fr 100px 50px; align-items: center; gap: 0.75rem; margin: 0;">
            <div>
                <select class="form-control option-label" required style="padding: 0.4rem 0.6rem;">
                    <option value="A" ${nextLabel === 'A' ? 'selected' : ''}>A</option>
                    <option value="B" ${nextLabel === 'B' ? 'selected' : ''}>B</option>
                    <option value="C" ${nextLabel === 'C' ? 'selected' : ''}>C</option>
                    <option value="D" ${nextLabel === 'D' ? 'selected' : ''}>D</option>
                </select>
            </div>
            <div>
                <input type="text" class="form-control option-text" placeholder="Option text..." value="${escapeHtml(text)}" required style="border-radius: var(--radius-sm); padding: 0.4rem 0.6rem;">
            </div>
            <div style="text-align: center;">
                <input type="checkbox" class="option-is-correct" style="width: 1.1rem; height: 1.1rem; accent-color: var(--primary);" ${isCorrect ? 'checked' : ''} onchange="handleOptionCorrectChange(this)">
            </div>
            <div style="text-align: right;">
                <button type="button" class="btn btn-danger btn-sm" onclick="removeOption(this)" style="padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 1rem; width: auto;">&times;</button>
            </div>
        </div>
    `;
    container.appendChild(row);
    updateOptionLabels();
}

function removeOption(btn) {
    btn.closest('.option-item-row').remove();
    updateOptionLabels();
}

function updateOptionLabels() {
    const container = document.getElementById('options-container');
    const rows = container.querySelectorAll('.option-item-row');
    const labels = ['A', 'B', 'C', 'D'];
    
    rows.forEach((row, index) => {
        const select = row.querySelector('.option-label');
        if (select) select.value = labels[index] || 'A';
    });
}

function handleOptionCorrectChange(checkbox) {
    if (checkbox.checked) {
        const checkboxes = document.querySelectorAll('.option-is-correct');
        checkboxes.forEach(cb => {
            if (cb !== checkbox) cb.checked = false;
        });
    }
}

// Add Decryption Hint row
function addHintRow(text = '', penalty = '') {
    const container = document.getElementById('hints-container');
    const existingRows = container.querySelectorAll('.hint-item-row');
    const nextOrder = existingRows.length + 1;
    
    const row = document.createElement('div');
    row.className = 'hint-item-row';
    row.style.border = '1px solid var(--border)';
    row.style.borderRadius = 'var(--radius-sm)';
    row.style.padding = '0.75rem 1rem';
    row.style.marginBottom = '0.5rem';
    row.style.backgroundColor = 'var(--bg)';
    
    row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
            <strong class="hint-order-label" style="font-size: 0.8rem; color: var(--primary);">Hint #${nextOrder}</strong>
            <button type="button" class="btn btn-danger btn-sm" onclick="removeHint(this)" style="padding: 0.2rem 0.4rem; border-radius: var(--radius-sm); font-size: 0.7rem; width: auto;">Delete</button>
        </div>
        <div class="dynamic-row" style="grid-template-columns: 2fr 1fr; gap: 0.5rem; margin: 0;">
            <div>
                <input type="text" class="form-control hint-text" placeholder="Hint details..." value="${escapeHtml(text)}" required style="border-radius: var(--radius-sm); padding: 0.4rem 0.6rem;">
            </div>
            <div>
                <input type="number" class="form-control hint-penalty" placeholder="e.g. 10" min="0" value="${penalty}" required style="border-radius: var(--radius-sm); padding: 0.4rem 0.6rem;">
            </div>
        </div>
    `;
    container.appendChild(row);
}

function removeHint(btn) {
    btn.closest('.hint-item-row').remove();
    updateHintOrderNumbers();
}

function updateHintOrderNumbers() {
    const container = document.getElementById('hints-container');
    const rows = container.querySelectorAll('.hint-item-row');
    rows.forEach((row, index) => {
        const label = row.querySelector('.hint-order-label');
        if (label) label.textContent = `Hint #${index + 1}`;
    });
}

// Image File upload preview and compression
function triggerImageFileInput() {
    document.getElementById('image-file-input').click();
}

function handleImageFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check size limit: 5 MB is 5242880 bytes
    const sizeLimit = 5 * 1024 * 1024;
    
    if (file.size > sizeLimit) {
        Utils.showToast('Image size exceeds 5 MB. Compressing image...');
        compressAndSetImage(file);
    } else {
        selectedImageBlob = file;
        showImagePreview(URL.createObjectURL(file));
    }
}

// Canvas-based image compression
function compressAndSetImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Cap dimensions to reduce file size
            const maxDim = 1200;
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to blob
            canvas.toBlob((blob) => {
                selectedImageBlob = blob;
                showImagePreview(URL.createObjectURL(blob));
                Utils.showToast('Compression complete.');
            }, 'image/jpeg', 0.8);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function showImagePreview(url) {
    document.getElementById('upload-prompt').style.display = 'none';
    
    const previewContainer = document.getElementById('upload-preview-container');
    previewContainer.style.display = 'flex';
    document.getElementById('upload-preview').src = url;
}

function clearSelectedImage(event) {
    if (event) event.stopPropagation(); // Avoid triggering file selection
    
    selectedImageBlob = null;
    document.getElementById('image-file-input').value = '';
    
    document.getElementById('upload-prompt').style.display = 'block';
    document.getElementById('upload-preview-container').style.display = 'none';
    document.getElementById('upload-preview').src = '';
}

// Submit Question Handler
async function handleFormSubmit(event) {
    event.preventDefault();

    const form = document.getElementById('question-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const editId = document.getElementById('edit-question-id').value;
    
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const question_type = document.getElementById('question_type').value;
    const points = parseInt(document.getElementById('points').value);
    
    const timeLimitInput = document.getElementById('time_limit_seconds').value;
    const time_limit_seconds = timeLimitInput ? parseInt(timeLimitInput) : null;
    
    const is_active = document.getElementById('is_active').checked;
    
    // Hints
    const hintRows = document.querySelectorAll('.hint-item-row');
    const hints = [];
    hintRows.forEach((row, index) => {
        const text = row.querySelector('.hint-text').value.trim();
        const penalty = parseInt(row.querySelector('.hint-penalty').value);
        hints.push({ order_no: index + 1, text, penalty });
    });
    
    // MCQ Options & Correct answer
    let options = [];
    let correct_ans = null;
    
    if (question_type === 'mcq') {
        const optionRows = document.querySelectorAll('.option-item-row');
        if (optionRows.length === 0) {
            Utils.showToast('Please add options for MCQ.');
            return;
        }
        
        let correctOptionLabel = null;
        optionRows.forEach(row => {
            const label = row.querySelector('.option-label').value;
            const text = row.querySelector('.option-text').value.trim();
            const isCorrect = row.querySelector('.option-is-correct').checked;
            
            options.push({ label, text, is_correct: isCorrect });
            if (isCorrect) correctOptionLabel = label;
        });
        
        if (!correctOptionLabel) {
            Utils.showToast('Please mark one option as correct for MCQ.');
            return;
        }
        correct_ans = correctOptionLabel;
    } else {
        correct_ans = document.getElementById('correct_ans').value.trim() || null;
    }

    const payload = {
        title,
        description,
        question_type,
        points,
        time_limit_seconds,
        correct_ans,
        image_url: null, // Initial fallback, updated by file upload if present
        is_active,
        hints,
        options
    };

    const saveBtn = document.getElementById('btn-save-question');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '⌛ Saving Challenge...';
    saveBtn.disabled = true;

    try {
        let questionId = null;
        if (editId) {
            // Edit coordinate
            const res = await CodeQuestAPI.updateQuestion(parseInt(editId), payload);
            questionId = editId;
            Utils.showToast('Question details updated.');
        } else {
            // Create coordinate
            const res = await CodeQuestAPI.createQuestion(payload);
            if (res && res.id) {
                questionId = res.id;
                Utils.showToast('Question created successfully.');
            } else {
                throw new Error('API save operation returned invalid response.');
            }
        }

        // Image upload step
        if (questionId && selectedImageBlob) {
            Utils.showToast('Uploading question image...');
            try {
                await CodeQuestAPI.uploadQuestionImage(questionId, selectedImageBlob);
                Utils.showToast('Question image uploaded.');
            } catch (imgErr) {
                console.error('Image upload failed:', imgErr);
                alert('Warning: Question details saved, but image upload failed: ' + imgErr.message);
            }
        }

        closeQuestionModal();
        loadQuestionsList();
    } catch (err) {
        console.error('Error saving question:', err);
        alert('Save Question Failed: ' + err.message);
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
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

// ----------------------------------------------------
// ADMIN TEAM MANAGEMENT SCANNING & EDIT LOGIC
// ----------------------------------------------------

let adminActiveStream = null;
let adminScanAnimationId = null;
let adminCurrentTeamId = null;
let adminCurrentTeamQrId = null;
let adminActiveTeamData = null;

// Start camera stream for Admin QR scan
async function startAdminCameraScan() {
    const video = document.getElementById('admin-camera-video');
    const container = document.getElementById('admin-camera-preview-container');
    
    container.style.display = 'block';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        adminActiveStream = stream;
        video.srcObject = stream;
        video.setAttribute('playsinline', true);
        video.play();
        adminScanAnimationId = requestAnimationFrame(tickAdminScan);
        Utils.showToast('Admin scanner activated.');
    } catch (err) {
        console.error('Camera stream access failed:', err);
        Utils.showToast('Unable to access camera: ' + err.message);
        stopAdminCameraScan();
    }
}

// Stop camera scan
function stopAdminCameraScan() {
    const container = document.getElementById('admin-camera-preview-container');
    container.style.display = 'none';

    if (adminScanAnimationId) {
        cancelAnimationFrame(adminScanAnimationId);
        adminScanAnimationId = null;
    }

    if (adminActiveStream) {
        adminActiveStream.getTracks().forEach(track => track.stop());
        adminActiveStream = null;
    }
}

// Frame capture loop for admin scan
async function tickAdminScan() {
    const video = document.getElementById('admin-camera-video');
    const canvas = document.getElementById('qr-canvas'); // Reusing existing canvas
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
                console.warn('BarcodeDetector error, fallback to jsQR:', e);
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
            console.log('Decoded admin QR:', decodedCode);
            const scannedUuid = extractUuidForAdmin(decodedCode);
            if (scannedUuid) {
                stopAdminCameraScan();
                await loadAdminTeamDetails(scannedUuid);
                return;
            }
        }
    }

    if (adminActiveStream) {
        adminScanAnimationId = requestAnimationFrame(tickAdminScan);
    }
}

function extractUuidForAdmin(input) {
    if (!input) return null;
    const cleanInput = input.trim();

    try {
        if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
            const url = new URL(cleanInput);
            const param = url.searchParams.get('qr_id') || url.searchParams.get('uid') || url.searchParams.get('id');
            if (param) return param.trim();

            const parts = url.pathname.split('/');
            for (const part of parts) {
                const cleanPart = part.trim();
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanPart)) return cleanPart;
            }

            const lastPart = parts.pop();
            if (lastPart) return lastPart.trim();
        }
    } catch (err) {}

    return cleanInput;
}

// Load team details by QR UUID
async function loadAdminTeamDetails(qrId) {
    if (!qrId) return;

    const teamCard = document.getElementById('admin-team-card');
    Utils.showToast('Loading team coordinate details...');

    try {
        let teamData = null;
        
        // GET /admin/teams/qr/{qr_id}
        try {
            teamData = await CodeQuestAPI.getTeamByQR(qrId);
        } catch (err) {
            console.warn('QR endpoint failed, trying fallback to direct ID:', err);
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
            throw new Error('No team found for coordinates UUID.');
        }

        adminCurrentTeamId = teamData.id;
        adminCurrentTeamQrId = qrId;
        adminActiveTeamData = teamData;

        // Populate read-only text fields
        document.getElementById('ad-t-name').textContent = teamData.team_name || 'Unnamed Team';
        document.getElementById('ad-t-uuid').textContent = teamData.qr_id || 'N/A';
        document.getElementById('ad-t-members').textContent = teamData.leader_name || 'None';
        
        const displayStatus = mapBackendToUiStatus(teamData.status);
        document.getElementById('ad-t-status').textContent = displayStatus;
        
        // Load local fields
        const localQuestion = localStorage.getItem(`codequest_team_${teamData.id}_current_question`) || 'None';
        const localCheckpoint = localStorage.getItem(`codequest_team_${teamData.id}_current_checkpoint`) || '0';
        const localNotes = localStorage.getItem(`codequest_team_${teamData.id}_notes`) || '';
        const localPenalty = localStorage.getItem(`codequest_team_${teamData.id}_penalty`) || '0';
        const localStarted = teamData.created_at ? new Date(teamData.created_at).toLocaleString() : 'N/A';
        const localFinished = localStorage.getItem(`codequest_team_${teamData.id}_completion_time`);

        document.getElementById('ad-t-question').textContent = teamData.current_question || localQuestion;
        document.getElementById('ad-t-checkpoint').textContent = teamData.current_checkpoint || localCheckpoint;
        document.getElementById('ad-t-started').textContent = localStarted;
        document.getElementById('ad-t-finished').textContent = localFinished ? new Date(localFinished).toLocaleString() : 'N/A';
        document.getElementById('ad-t-notes-display').textContent = localNotes || 'No notes logged.';
        document.getElementById('ad-t-penalty-display').textContent = localPenalty + ' seconds';

        // Set form control values
        document.getElementById('ad-status-select').value = displayStatus;
        document.getElementById('ad-notes-textarea').value = localNotes;
        document.getElementById('ad-penalty-input').value = parseInt(localPenalty) || 0;

        // Populate question dropdown and set selection
        populateQuestionsDropdown();
        document.getElementById('ad-question-select').value = teamData.current_question || (localQuestion !== 'None' ? localQuestion : '');

        // Show Team details card
        teamCard.style.display = 'block';
        teamCard.scrollIntoView({ behavior: 'smooth' });
        Utils.showToast('Team coordinate loaded.');
    } catch (error) {
        console.error('Failed to load admin team details:', error);
        alert('Lookup Failed: ' + error.message);
        teamCard.style.display = 'none';
    }
}

// Close team card
function closeAdminTeamCard() {
    document.getElementById('admin-team-card').style.display = 'none';
}

// Populate the Question Dropdown
function populateQuestionsDropdown() {
    const select = document.getElementById('ad-question-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- No Active Question / Start --</option>';
    if (questionsList && questionsList.length > 0) {
        questionsList.forEach(q => {
            const option = document.createElement('option');
            option.value = q.title;
            option.textContent = q.title;
            select.appendChild(option);
        });
    }
}

// Save Team changes
async function saveAdminTeamChanges(event) {
    event.preventDefault();
    if (!adminCurrentTeamId) return;

    const selectStatus = document.getElementById('ad-status-select').value;
    const selectQuestion = document.getElementById('ad-question-select').value;
    const notesText = document.getElementById('ad-notes-textarea').value.trim();
    const penaltyInput = document.getElementById('ad-penalty-input').value;

    const saveBtn = document.getElementById('btn-save-admin-team');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⌛ Saving Changes...';

    try {
        const mappedBackendStatus = mapUiToBackendStatus(selectStatus);

        // 1. Save status to backend
        await CodeQuestAPI.updateTeamStatus(adminCurrentTeamId, mappedBackendStatus);

        // 2. Save Question, Notes, and Penalty locally (since backend endpoints are not available)
        localStorage.setItem(`codequest_team_${adminCurrentTeamId}_notes`, notesText);
        localStorage.setItem(`codequest_team_${adminCurrentTeamId}_penalty`, penaltyInput);
        localStorage.setItem(`codequest_team_${adminCurrentTeamId}_current_question`, selectQuestion || 'None');

        // Dynamically compute checkpoint number based on selected question index
        if (selectQuestion) {
            const qIndex = questionsList.findIndex(q => q.title === selectQuestion);
            const cpVal = qIndex !== -1 ? (qIndex + 1) : 0;
            localStorage.setItem(`codequest_team_${adminCurrentTeamId}_current_checkpoint`, cpVal);
        } else {
            localStorage.setItem(`codequest_team_${adminCurrentTeamId}_current_checkpoint`, 0);
        }

        // Completion time management
        const timeKey = `codequest_team_${adminCurrentTeamId}_completion_time`;
        if (selectStatus === 'Completed') {
            const savedTime = localStorage.getItem(timeKey);
            if (!savedTime) {
                localStorage.setItem(timeKey, new Date().toISOString());
            }
        } else {
            localStorage.removeItem(timeKey);
        }

        // Reload data
        await loadAdminTeamDetails(adminCurrentTeamQrId);
        await loadTeamsList();
        Utils.showToast('Team changes saved successfully.');
    } catch (err) {
        console.error('Failed to save team details:', err);
        alert('Save Failed: ' + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
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
    return 'registered';
}

// Show Team QR in Modal
function showTeamQRModal(teamName, qrId, qrUrl) {
    const modalImage = document.getElementById('qr-modal-image');
    const modalId = document.getElementById('qr-modal-id');
    const modalDownload = document.getElementById('qr-modal-download');
    
    document.getElementById('qr-modal-title').textContent = `${teamName} • Team QR`;
    
    if (qrUrl) {
        const fullUrl = CodeQuestAPI.BASE_URL + qrUrl;
        modalImage.src = fullUrl;
        modalImage.alt = 'Team QR Code';
        modalImage.style.display = 'block';
        modalId.innerHTML = `UUID: ${escapeHtml(qrId)}`;
        
        modalDownload.href = fullUrl;
        modalDownload.download = `team_${teamName.replace(/\s+/g, '_')}_QR.png`;
        modalDownload.style.display = 'inline-flex';
    } else {
        modalImage.style.display = 'none';
        modalId.innerHTML = `<div style="color: var(--error); font-weight: 700; padding: 1.5rem 0;">QR not generated yet.</div><div style="margin-top: 0.25rem;">UUID: ${escapeHtml(qrId)}</div>`;
        
        modalDownload.href = '#';
        modalDownload.style.display = 'none';
    }
    
    Utils.openModal('qr-modal');
}


