document.addEventListener('DOMContentLoaded', () => {
    // Initial UI load
    toggleTypeSpecificSections();
    loadSavedQuestions();
});

// Fetch and render saved questions
async function loadSavedQuestions() {
    const listContainer = document.getElementById('saved-questions-list');
    listContainer.innerHTML = Utils.getLoaderHTML('Loading saved questions...');
    
    try {
        const response = await fetch('https://j7jvczrc-8000.inc1.devtunnels.ms/admin/questions/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Tunnel-Skip-AntiSpam-Page': 'true'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseData = await response.json();
        listContainer.innerHTML = '';
        
        let questions = [];
        if (Array.isArray(responseData)) {
            questions = responseData;
        } else if (responseData && Array.isArray(responseData.data)) {
            questions = responseData.data;
        }
        
        if (questions && questions.length > 0) {
            questions.forEach(q => {
                const card = document.createElement('div');
                card.className = `card question-card ${q.is_active ? '' : 'inactive'}`;
                card.id = `question-card-${q.id}`;
                card.style.padding = '1.5rem';
                card.style.borderTop = 'none';
                card.style.borderRight = '1px solid var(--border)';
                card.style.borderBottom = '1px solid var(--border)';
                card.style.boxShadow = 'var(--shadow-sm)';
                
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; gap: 0.5rem;">
                        <div>
                            <h4 style="margin-bottom: 0.25rem; font-size: 1.1rem; color: var(--text-main); font-weight: 700;">${escapeHtml(q.title)}</h4>
                            <div style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">ID: ${q.id}</div>
                        </div>
                        <span class="badge ${q.is_active ? 'badge-success' : 'badge-neutral'}" style="font-size: 0.65rem; flex-shrink: 0;">
                            ${q.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    
                    <p style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 1.25rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${escapeHtml(q.description)}</p>
                    
                    <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; font-size: 0.85rem;">
                        <div><strong>Type:</strong> <span class="badge badge-primary" style="font-size: 0.65rem; text-transform: capitalize;">${q.question_type}</span></div>
                        <div><strong>Points:</strong> <span class="badge badge-accent" style="font-size: 0.65rem; color: #1e293b;">${q.points} Pts</span></div>
                    </div>
                    
                    <div style="display: flex; gap: 0.75rem;">
                        <a href="question.html?id=${q.id}" target="_blank" class="btn btn-secondary btn-sm" style="flex: 1; text-decoration: none; text-align: center; font-size: 0.8rem; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; gap: 0.25rem;">👁 Preview</a>
                        <button type="button" class="btn btn-danger btn-sm" onclick="confirmDeleteQuestion(${q.id})" style="flex: 1; font-size: 0.8rem; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; gap: 0.25rem;">🗑 Delete</button>
                    </div>
                `;
                listContainer.appendChild(card);
            });
        } else {
            listContainer.innerHTML = `
                <div class="card text-center" style="grid-column: 1 / -1; padding: 3rem 1.5rem; box-shadow: none; border-style: dashed;">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📭</div>
                    <h4 style="color: var(--text-muted);">No Questions Available</h4>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load saved questions:', error);
        listContainer.innerHTML = `
            <div class="card text-center" style="grid-column: 1 / -1; padding: 2rem 1rem; border-color: var(--error);">
                <h4 style="color: var(--error); margin-bottom: 0.5rem;">Unable to load questions. <span style="text-decoration: underline; cursor: pointer; color: var(--primary);" onclick="loadSavedQuestions()">Retry.</span></h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

// Delete question with prompt
async function confirmDeleteQuestion(id) {
    if (confirm('Delete this question?')) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/questions/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-Tunnel-Skip-AntiSpam-Page': 'true'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            Utils.showToast('Question deleted successfully.');
            
            // Remove the card from DOM immediately without refresh
            const card = document.getElementById(`question-card-${id}`);
            if (card) {
                card.style.transform = 'scale(0.9)';
                card.style.opacity = '0';
                setTimeout(() => {
                    card.remove();
                    
                    // If list is now empty, re-render empty state message
                    const listContainer = document.getElementById('saved-questions-list');
                    if (listContainer.children.length === 0) {
                        loadSavedQuestions();
                    }
                }, 250);
            }
        } catch (error) {
            console.error('Failed to delete question:', error);
            alert('Delete failed: ' + error.message);
        }
    }
}

// Toggle visibility of MCQ options or Correct Answer text input
function toggleTypeSpecificSections() {
    const question_type = document.getElementById('question_type').value;
    const correctAnsContainer = document.getElementById('correct-ans-container');
    const mcqOptionsSection = document.getElementById('mcq-options-section');
    
    if (question_type === 'mcq') {
        correctAnsContainer.style.display = 'none';
        mcqOptionsSection.style.display = 'block';
        
        // Pre-populate A, B, C, D if empty
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

// Add MCQ Option row dynamically (max 4: A, B, C, D)
function addOptionRow(text = '', isCorrect = false) {
    const container = document.getElementById('options-container');
    const existingRows = container.querySelectorAll('.option-item-row');
    if (existingRows.length >= 4) {
        Utils.showToast('Maximum of 4 options allowed (A, B, C, D).');
        return;
    }
    
    const labels = ['A', 'B', 'C', 'D'];
    const nextLabel = labels[existingRows.length];
    
    const row = document.createElement('div');
    row.className = 'option-item-row';
    row.style.border = '1px solid var(--border)';
    row.style.borderRadius = 'var(--radius-sm)';
    row.style.padding = '1rem';
    row.style.marginBottom = '0.75rem';
    row.style.backgroundColor = 'var(--bg)';
    
    row.innerHTML = `
        <div class="dynamic-row dynamic-row-options" style="grid-template-columns: 80px 3fr 100px 50px; align-items: center; gap: 0.75rem;">
            <div>
                <label class="form-label" style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">Label</label>
                <select class="form-control option-label" style="padding: 0.5rem 0.75rem; border-radius: var(--radius-sm);" required>
                    <option value="A" ${nextLabel === 'A' ? 'selected' : ''}>A</option>
                    <option value="B" ${nextLabel === 'B' ? 'selected' : ''}>B</option>
                    <option value="C" ${nextLabel === 'C' ? 'selected' : ''}>C</option>
                    <option value="D" ${nextLabel === 'D' ? 'selected' : ''}>D</option>
                </select>
            </div>
            <div>
                <label class="form-label" style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">Option Text</label>
                <input type="text" class="form-control option-text" placeholder="Option text..." value="${escapeHtml(text)}" required style="border-radius: var(--radius-sm); padding: 0.5rem 0.75rem;">
            </div>
            <div style="display: flex; flex-direction: column; align-items: center;">
                <label class="form-label" style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.5rem;">Is Correct</label>
                <input type="checkbox" class="option-is-correct" style="width: 1.2rem; height: 1.2rem; accent-color: var(--primary);" ${isCorrect ? 'checked' : ''} onchange="handleOptionCorrectChange(this)">
            </div>
            <div style="text-align: right; align-self: flex-end;">
                <button type="button" class="btn btn-danger btn-sm" onclick="removeOption(this)" style="padding: 0.5rem; width: 2.2rem; height: 2.2rem; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); font-size: 1.2rem;">&times;</button>
            </div>
        </div>
    `;
    container.appendChild(row);
    updateOptionLabels();
}

function removeOption(btn) {
    const row = btn.closest('.option-item-row');
    row.remove();
    updateOptionLabels();
}

function updateOptionLabels() {
    const container = document.getElementById('options-container');
    const rows = container.querySelectorAll('.option-item-row');
    const labels = ['A', 'B', 'C', 'D'];
    
    rows.forEach((row, index) => {
        const select = row.querySelector('.option-label');
        if (select) {
            select.value = labels[index] || 'A';
        }
    });
    
    const addBtn = document.getElementById('add-option-btn');
    if (addBtn) {
        addBtn.disabled = rows.length >= 4;
    }
}

function handleOptionCorrectChange(checkbox) {
    if (checkbox.checked) {
        // Limit checkbox selection to one
        const checkboxes = document.querySelectorAll('.option-is-correct');
        checkboxes.forEach(cb => {
            if (cb !== checkbox) {
                cb.checked = false;
            }
        });
    }
}

// Add Hint Row dynamically
function addHintRow(text = '', penalty = '') {
    const container = document.getElementById('hints-container');
    const existingRows = container.querySelectorAll('.hint-item-row');
    const nextOrder = existingRows.length + 1;
    
    const row = document.createElement('div');
    row.className = 'hint-item-row';
    row.style.border = '1px solid var(--border)';
    row.style.borderRadius = 'var(--radius-sm)';
    row.style.padding = '1rem';
    row.style.marginBottom = '0.75rem';
    row.style.backgroundColor = 'var(--bg)';
    
    row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong class="hint-order-label">Hint #${nextOrder}</strong>
            <button type="button" class="btn btn-danger btn-sm" onclick="removeHint(this)" style="padding: 0.25rem 0.5rem; width: auto; border-radius: var(--radius-sm); font-size: 0.75rem;">Delete</button>
        </div>
        <div class="dynamic-row" style="grid-template-columns: 2fr 1fr; gap: 0.75rem;">
            <div>
                <label class="form-label" style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">Hint Text</label>
                <input type="text" class="form-control hint-text" placeholder="Hint details..." value="${escapeHtml(text)}" required style="border-radius: var(--radius-sm); padding: 0.5rem 0.75rem;">
            </div>
            <div>
                <label class="form-label" style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">Penalty Pts</label>
                <input type="number" class="form-control hint-penalty" placeholder="e.g. 10" min="0" value="${penalty}" required style="border-radius: var(--radius-sm); padding: 0.5rem 0.75rem;">
            </div>
        </div>
    `;
    container.appendChild(row);
}

function removeHint(btn) {
    const row = btn.closest('.hint-item-row');
    row.remove();
    updateHintOrderNumbers();
}

function updateHintOrderNumbers() {
    const container = document.getElementById('hints-container');
    const rows = container.querySelectorAll('.hint-item-row');
    rows.forEach((row, index) => {
        const label = row.querySelector('.hint-order-label');
        if (label) {
            label.textContent = `Hint #${index + 1}`;
        }
    });
}

// Compile fields and perform API post
async function saveQuestion(event) {
    if (event) event.preventDefault();
    
    // Check validation of inputs
    const form = document.getElementById('question-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const question_type = document.getElementById('question_type').value;
    const points = parseInt(document.getElementById('points').value);
    
    const timeLimitInput = document.getElementById('time_limit_seconds').value;
    const time_limit_seconds = timeLimitInput ? parseInt(timeLimitInput) : null;
    
    const imageUrlInput = document.getElementById('image_url').value.trim();
    const image_url = imageUrlInput || null;
    
    const is_active = document.getElementById('is_active').checked;
    
    // Compile hints
    const hintRows = document.querySelectorAll('.hint-item-row');
    const hints = [];
    hintRows.forEach((row, index) => {
        const text = row.querySelector('.hint-text').value.trim();
        const penalty = parseInt(row.querySelector('.hint-penalty').value);
        hints.push({
            order_no: index + 1,
            text,
            penalty
        });
    });
    
    // Compile options & correct answer
    let options = [];
    let correct_ans = null;
    
    if (question_type === 'mcq') {
        const optionRows = document.querySelectorAll('.option-item-row');
        if (optionRows.length === 0) {
            Utils.showToast('Please add at least one option for MCQ.');
            return;
        }
        
        let correctOptionLabel = null;
        optionRows.forEach(row => {
            const label = row.querySelector('.option-label').value;
            const text = row.querySelector('.option-text').value.trim();
            const isCorrect = row.querySelector('.option-is-correct').checked;
            
            options.push({
                label,
                text,
                is_correct: isCorrect
            });
            
            if (isCorrect) {
                correctOptionLabel = label;
            }
        });
        
        if (!correctOptionLabel) {
            Utils.showToast('Please mark one option as correct for MCQ.');
            return;
        }
        correct_ans = correctOptionLabel;
    } else {
        const correctAnsInput = document.getElementById('correct_ans').value.trim();
        correct_ans = correctAnsInput || null;
    }
    
    const payload = {
        title,
        description,
        question_type,
        points,
        time_limit_seconds,
        correct_ans,
        image_url,
        is_active,
        hints,
        options
    };
    
    // Show loading state
    const submitBtn = document.getElementById('submit-btn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '⌛ Saving Question...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/questions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tunnel-Skip-AntiSpam-Page': 'true'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errJson = await response.json();
                if (errJson && errJson.detail) {
                    if (typeof errJson.detail === 'string') {
                        errorMessage = errJson.detail;
                    } else if (Array.isArray(errJson.detail)) {
                        errorMessage = errJson.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
                    }
                }
            } catch (e) {
                // Ignore
            }
            throw new Error(errorMessage);
        }
        
        const responseData = await response.json();
        
        if (responseData && responseData.id) {
            Utils.showToast('Question Created Successfully!');
            
            // Display loading state for QR code
            const qrResultContainer = document.getElementById('qr-result-container');
            if (qrResultContainer) {
                qrResultContainer.style.display = 'block';
                qrResultContainer.innerHTML = Utils.getLoaderHTML('Generating Checkpoint QR Code...');
                
                try {
                    const qrRes = await CodeQuestAPI.generateQR(responseData.id);
                    if (qrRes && qrRes.isBlob) {
                        const qrUrl = URL.createObjectURL(qrRes.blob);
                        
                        // Render success layout and QR code
                        qrResultContainer.innerHTML = `
                            <div style="background-color: rgba(16, 185, 129, 0.05); border: 1px solid var(--success); border-radius: var(--radius); padding: 1.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                                <div style="font-size: 2.5rem; color: var(--success);">✅</div>
                                <h3 style="color: var(--text-main); margin: 0;">Question Created Successfully</h3>
                                <div style="font-family: monospace; font-size: 0.95rem; color: var(--text-muted); background: var(--bg); padding: 0.5rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border);">
                                    Question ID: <strong style="color: var(--text-main);">${responseData.id}</strong>
                                </div>
                                
                                <div style="border: 2px solid var(--border); border-radius: var(--radius); padding: 1rem; background-color: white; margin: 1rem 0; max-width: 250px; box-shadow: var(--shadow-sm);">
                                    <img src="${qrUrl}" alt="Generated Question QR Code" style="width: 100%; height: auto; display: block;" id="generated-qr-image">
                                </div>
                                
                                <a href="${qrUrl}" download="question_QR_${responseData.id}.png" class="btn btn-primary btn-sm" style="max-width: 220px; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; text-decoration: none;">
                                    📥 Download QR Code
                                </a>
                            </div>
                        `;
                    } else {
                        throw new Error('API response did not contain a valid image blob.');
                    }
                } catch (qrErr) {
                    console.error('QR generation failed:', qrErr);
                    qrResultContainer.innerHTML = `
                        <div class="card text-center" style="border-color: var(--error); padding: 1.5rem;">
                            <h4 style="color: var(--error);">Question Created, but QR Generation Failed</h4>
                            <p style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(qrErr.message)}</p>
                        </div>
                    `;
                }
            }
            
            // Reset Form Fields
            resetFormFields();
            
            // Reload saved questions dynamically without refreshing the page
            await loadSavedQuestions();
        } else {
            throw new Error('Failed to save question. No ID returned.');
        }
    } catch (error) {
        console.error('Error creating question:', error);
        alert('API Request Failed: ' + error.message);
    } finally {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
}

// Reset form and UI arrays
function resetFormFields() {
    document.getElementById('question-form').reset();
    document.getElementById('hints-container').innerHTML = '';
    document.getElementById('options-container').innerHTML = '';
    toggleTypeSpecificSections();
    const qrResultContainer = document.getElementById('qr-result-container');
    if (qrResultContainer) {
        qrResultContainer.style.display = 'none';
        qrResultContainer.innerHTML = '';
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

// Live preview of active question form entries
function previewQuestion() {
    const title = document.getElementById('title').value.trim() || 'Untitled Question';
    const description = document.getElementById('description').value.trim() || 'No description provided.';
    const question_type = document.getElementById('question_type').value;
    const points = parseInt(document.getElementById('points').value) || 0;
    const timeLimitInput = document.getElementById('time_limit_seconds').value;
    const time_limit_seconds = timeLimitInput ? parseInt(timeLimitInput) : 0;
    const imageUrl = document.getElementById('image_url').value.trim();
    
    // Compile hints
    const hintRows = document.querySelectorAll('.hint-item-row');
    const hints = [];
    hintRows.forEach((row, index) => {
        const text = row.querySelector('.hint-text').value.trim() || 'Hint text';
        const penalty = parseInt(row.querySelector('.hint-penalty').value) || 0;
        hints.push({
            order_no: index + 1,
            text,
            penalty
        });
    });
    
    // Compile options
    const options = [];
    if (question_type === 'mcq') {
        const optionRows = document.querySelectorAll('.option-item-row');
        optionRows.forEach((row, index) => {
            const text = row.querySelector('.option-text').value.trim() || 'Option text';
            const isCorrect = row.querySelector('.option-is-correct').checked;
            const labels = ['A', 'B', 'C', 'D'];
            options.push({
                label: labels[index] || 'A',
                text,
                is_correct: isCorrect
            });
        });
    }
    
    let answerHtml = '';
    if (question_type === 'mcq') {
        answerHtml = `
            <div class="form-group">
                <label class="form-label">Select Option (MCQ Preview)</label>
                <div class="options-grid">
                    ${options.map(opt => `
                        <label class="option-card" style="pointer-events: none;">
                            <input type="radio" name="preview-mcq" class="radio-input" ${opt.is_correct ? 'checked' : ''}>
                            <div class="option-letter">${opt.label}</div>
                            <div class="option-text">${escapeHtml(opt.text)} ${opt.is_correct ? '<span style="color: var(--success); font-weight: 700; margin-left: 0.5rem;">(Correct)</span>' : ''}</div>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (question_type === 'coding') {
        answerHtml = `
            <div class="form-group">
                <label class="form-label">Enter Mission Solution (Coding Preview)</label>
                <div class="code-container" style="padding: 0.5rem;">
                    <textarea class="form-control" style="font-family: monospace; background-color: transparent; border: none; color: #e2e8f0; resize: vertical; min-height: 120px;" placeholder="// Type your decryption code here..." readonly></textarea>
                </div>
            </div>
        `;
    } else {
        // QNA or Puzzle
        answerHtml = `
            <div class="form-group">
                <label class="form-label">Enter Mission Solution (Preview)</label>
                <textarea class="form-control" placeholder="Type your answer here..." style="min-height: 120px;" readonly></textarea>
            </div>
        `;
    }
    
    let timerHtml = '';
    if (time_limit_seconds > 0) {
        const mins = Math.floor(time_limit_seconds / 60);
        const secs = time_limit_seconds % 60;
        timerHtml = `
            <div class="timer-widget">
                ⏰ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}
            </div>
        `;
    }
    
    const previewContainer = document.getElementById('preview-modal-body');
    previewContainer.innerHTML = `
        <div class="card" style="box-shadow: none; border: none; padding: 0;">
            <div class="mission-header">
                <div>
                    <div class="mission-title">Mission Protocol</div>
                    <div class="mission-sub">${escapeHtml(title)}</div>
                </div>
                <div class="badge badge-primary">${points} Points</div>
            </div>
            
            <div class="meta-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                <span class="badge badge-neutral">${Utils.getQuestionTypeLabel(question_type)}</span>
                <div id="preview-timer-container">${timerHtml}</div>
            </div>
            
            <div class="desc-text" style="white-space: pre-wrap; font-size: 1.05rem; color: #334155; line-height: 1.6; margin-bottom: 1.5rem;">${escapeHtml(description)}</div>
            
            ${imageUrl ? `
                <div class="question-image-wrapper">
                    <img class="question-image" src="${escapeHtml(imageUrl)}" alt="Mission Attachment" loading="lazy">
                </div>
            ` : ''}
            
            <div>
                ${answerHtml}
            </div>
            
            ${hints.length > 0 ? `
                <div style="margin-top: 1.5rem; border-top: 1px dashed var(--border); padding-top: 1rem;">
                    <h5 style="margin-bottom: 0.5rem; text-transform: uppercase; font-size: 0.8rem; color: var(--text-muted);">Configured Hints (${hints.length})</h5>
                    <div class="hint-list">
                        ${hints.map(h => `
                            <div class="hint-item" style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 1rem; background-color: var(--bg); display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <div class="hint-header" style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-weight: 700; color: var(--primary); font-size: 0.85rem;">Hint #${h.order_no}</span>
                                    <span class="badge badge-accent">-${h.penalty} Pts</span>
                                </div>
                                <div class="hint-content" style="font-size: 0.95rem; color: var(--text-main);">${escapeHtml(h.text)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    Utils.openModal('preview-modal-overlay');
}

window.previewQuestion = previewQuestion;
