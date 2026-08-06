document.addEventListener("DOMContentLoaded", () => {
  initQuestionPage();
});

let questionId = null;
let questionUid = null;
let activeQuestion = null;
let timerInterval = null;

async function initQuestionPage() {
  const mainContent = document.getElementById("main-content");

  // Parse URL parameters
  const params = new URLSearchParams(window.location.search);
  let qrId = params.get("qr_id");

  if (!qrId) {
    // Fallback for /q/UUID format
    const pathname = window.location.pathname;
    const pathParts = pathname.split("/");
    const qIndex = pathParts.indexOf("q");
    if (qIndex !== -1 && pathParts[qIndex + 1]) {
      qrId = pathParts[qIndex + 1];
    }
  }

  // Extract Direct Question ID fallback or other uid fallbacks
  questionId = params.get("id");
  questionUid = qrId || params.get("uid");

  if (!questionId && !questionUid) {
    mainContent.innerHTML = `
            <div class="card text-center" style="padding: 3rem 1.5rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                <h3>No Mission ID Detected</h3>
                <p style="margin-top: 0.5rem; margin-bottom: 1.5rem;">Please scan a valid Code Quest checkpoint QR code.</p>
            </div>
        `;
    return;
  }

  loadQuestion();
}

async function loadQuestion() {
  const mainContent = document.getElementById("main-content");
  mainContent.innerHTML = Utils.getLoaderHTML(
    "Decrypting Mission Parameters...",
  );

  try {
    let question = null;
    try {
      if (questionId) {
        question = await CodeQuestAPI.getQuestion(questionId);
      } else if (questionUid) {
        question = await CodeQuestAPI.getQuestionByQR(questionUid);
      }
    } catch (err) {
      console.error("Error loading question:", err);
      if (questionUid) {
        mainContent.innerHTML = `
                    <div class="card text-center" style="padding: 3rem 1.5rem;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                        <h3>404</h3>
                        <p style="margin-top: 0.5rem; margin-bottom: 1.5rem;">Question Not Found</p>
                    </div>
                `;
        return;
      }
      throw err;
    }

    if (!question) {
      if (questionUid) {
        mainContent.innerHTML = `
                    <div class="card text-center" style="padding: 3rem 1.5rem;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                        <h3>404</h3>
                        <p style="margin-top: 0.5rem; margin-bottom: 1.5rem;">Question Not Found</p>
                    </div>
                `;
        return;
      }
      mainContent.innerHTML = `
                <div class="card text-center" style="padding: 3rem 1.5rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                    <h3>Mission Not Found</h3>
                    <p style="margin-top: 0.5rem; margin-bottom: 1.5rem;">The checkpoint ID is invalid or does not correspond to an active challenge.</p>
                </div>
            `;
      return;
    }

    activeQuestion = question;

    // Ensure questionUid is set to unique identifier for local storage lookups
    questionUid = questionId || questionUid || (question && question.id);

    if (!question.is_active) {
      mainContent.innerHTML = `
                <div class="card text-center" style="padding: 3rem 1.5rem; border-color: var(--accent);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
                    <h3>Checkpoint Locked</h3>
                    <p style="margin-top: 0.5rem; margin-bottom: 1.5rem;">This checkpoint mission has been temporarily deactivated by administrators.</p>
                </div>
            `;
      return;
    }

    // Check if user already submitted an answer to this question
    const savedAnswer = Utils.getTeamAnswer(questionUid);
    if (savedAnswer && savedAnswer.submitted) {
      renderSuccessState(savedAnswer.answer, savedAnswer.timestamp);
    } else {
      renderQuestion(question);
    }
  } catch (error) {
    Utils.renderError(mainContent, error.message, () => loadQuestion());
  }
}

function renderQuestion(q) {
  const mainContent = document.getElementById("main-content");

  // Check if MCQ options exist
  const hasOptions = q.options && q.options.length > 0;

  // Try to restore in-progress answer from local storage
  const saved = Utils.getTeamAnswer(questionUid);
  const inProgressAns = saved ? saved.answer : "";

  const revealedCount = Utils.getRevealedHints(questionUid).length;

  let answerHtml = "";
  if (q.question_type === "mcq" && hasOptions) {
    answerHtml = `
            <div class="form-group">
                <label class="form-label">Select Option</label>
                <div class="options-grid" id="options-selector">
                    ${q.options
                      .map(
                        (opt) => `
                        <label class="option-card">
                            <input type="radio" name="mcq-option" value="${opt.label}" class="radio-input" ${inProgressAns === opt.label ? "checked" : ""}>
                            <div class="option-letter">${opt.label}</div>
                            <div class="option-text">${escapeHtml(opt.text)}</div>
                        </label>
                    `,
                      )
                      .join("")}
                </div>
                <input type="hidden" id="answer-input" value="${escapeHtml(inProgressAns)}">
            </div>
        `;
  } else {
    const isQna = q.question_type === "qna";
    answerHtml = `
            <div class="form-group">
                <label for="answer-input" class="form-label">Enter Mission Solution</label>
                <textarea id="answer-input" class="form-control" placeholder="Type your decryption logic or solution here..." ${isQna ? "" : "required"}>${escapeHtml(inProgressAns)}</textarea>
            </div>
        `;
  }

  const hintsCount = q.hints ? q.hints.length : 0;
  const hasHints = hintsCount > 0;

  const hasDescription = q.description && q.description.trim().length > 0;
  const primaryText = hasDescription ? q.description : q.title;

  mainContent.innerHTML = `
        <div class="card">
            <!-- Question ID, Hints Used Counter & Timer -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; min-height: 38px;">
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;">
                        Question ID: ${q.id}
                    </div>
                    <div id="hints-counter" style="font-weight: 700; color: var(--text-muted); font-size: 0.85rem;">
                        Hints Used : ${revealedCount}
                    </div>
                </div>
                <div id="timer-container"></div>
            </div>
            
            <!-- Description -->
            <div class="desc-text">${escapeHtml(primaryText)}</div>
            
            <!-- Image Attachment -->
            ${
              q.image_url
                ? `
                <div class="question-image-wrapper">
                    <img class="question-image" src="${escapeHtml(Utils.formatImageUrl(q.image_url))}" alt="Mission Intel Attachment" loading="lazy">
                </div>
            `
                : ""
            }
            
            <!-- Form Input -->
            <form id="submission-form" onsubmit="submitAnswer(event)">
                ${answerHtml}
                
                <div class="grid grid-cols-2 mt-4" style="align-items: center; justify-items: stretch;">
                    <div id="hint-btn-container"></div>
                    <button type="submit" class="btn btn-primary" id="submit-btn">
                        Submit to Volunteer
                    </button>
                </div>
            </form>
        </div>
    `;

  // Bind Realtime Input Saving
  const answerInput = document.getElementById("answer-input");

  if (q.question_type === "mcq" && hasOptions) {
    const radios = document.querySelectorAll(".radio-input");
    radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        const selectedVal = radio.value;
        answerInput.value = selectedVal;
        Utils.saveTeamAnswer(questionUid, selectedVal);
      });
    });
  } else {
    answerInput.addEventListener("input", (e) => {
      Utils.saveTeamAnswer(questionUid, e.target.value);
    });
  }

  // Setup Countdown Timer
  setupTimer(q.time_limit_seconds);

  // Setup Hint Visibility Timer
  setupHintTimer();
}

function setupTimer(timeLimit) {
  const timerContainer = document.getElementById("timer-container");
  if (!timeLimit || timeLimit <= 0) return;

  const startKey = `cq_timer_start_${questionUid}`;
  const limitKey = `cq_timer_limit_${questionUid}`;
  const qidKey = `cq_timer_qid_${questionUid}`;
  const bonusKey = `cq_timer_bonus_${questionUid}`;

  let startTimestamp = localStorage.getItem(startKey);
  let storedLimit = localStorage.getItem(limitKey);

  const currentEpoch = Math.floor(Date.now() / 1000);

  if (!startTimestamp) {
    // First scan
    startTimestamp = currentEpoch.toString();
    storedLimit = timeLimit.toString();

    localStorage.setItem(qidKey, questionUid);
    localStorage.setItem(startKey, startTimestamp);
    localStorage.setItem(limitKey, storedLimit);
  } else {
    // Refresh load
    const bonusUsed = localStorage.getItem(bonusKey);
    if (!bonusUsed) {
      let currentLimit = parseInt(storedLimit) || timeLimit;
      currentLimit += 5;
      storedLimit = currentLimit.toString();

      localStorage.setItem(limitKey, storedLimit);
      localStorage.setItem(bonusKey, "true");

      Utils.showToast("Network buffer applied: +5s grace period added!");
    }
  }

  const startSec = parseInt(startTimestamp);
  let limitSec = parseInt(storedLimit);

  if (timerInterval) clearInterval(timerInterval);

  function disableSubmissionAndShowTimeUp() {
    if (timerInterval) clearInterval(timerInterval);

    const form = document.getElementById("submission-form");
    if (form) {
      const inputs = form.querySelectorAll(
        'textarea, input[type="radio"], input[type="checkbox"], input[type="text"]',
      );
      inputs.forEach((input) => {
        input.disabled = true;
      });

      const submitBtn = document.getElementById("submit-btn");
      if (submitBtn) {
        submitBtn.disabled = true;
      }
    }

    const formContainer = document.getElementById("submission-form");
    if (formContainer) {
      let timeUpEl = document.getElementById("time-up-overlay");
      if (!timeUpEl) {
        timeUpEl = document.createElement("div");
        timeUpEl.id = "time-up-overlay";
        timeUpEl.style.marginTop = "1.5rem";
        timeUpEl.style.padding = "2rem";
        timeUpEl.style.border = "2px solid var(--error)";
        timeUpEl.style.borderRadius = "var(--radius)";
        timeUpEl.style.backgroundColor = "rgba(239, 68, 68, 0.05)";
        timeUpEl.style.textAlign = "center";
        timeUpEl.style.color = "var(--error)";
        timeUpEl.innerHTML = `
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">⏰</div>
                    <h3 style="color: var(--error); margin: 0 0 0.5rem 0; font-weight: 800; font-size: 1.5rem;">Time Up</h3>
                    <p style="color: var(--text-main); font-weight: 600; margin: 0; font-size: 1.05rem;">Contact the Volunteer.</p>
                `;
        formContainer.parentNode.insertBefore(timeUpEl, formContainer);
        formContainer.style.display = "none";
      }
    }

    if (timerContainer) {
      timerContainer.innerHTML = `
                <div class="timer-widget" style="background-color: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: var(--error);">
                    ⏰ TIME UP
                </div>
            `;
    }
  }

  function updateTimer() {
    const nowSec = Math.floor(Date.now() / 1000);
    const elapsed = nowSec - startSec;
    const remaining = limitSec - elapsed;

    if (remaining <= 0) {
      disableSubmissionAndShowTimeUp();
      return;
    }

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;

    if (timerContainer) {
      timerContainer.innerHTML = `
                <div class="timer-widget">
                    ⏰ ${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}
                </div>
            `;
    }
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (limitSec - (nowSec - startSec) <= 0) {
    disableSubmissionAndShowTimeUp();
  } else {
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  }
}

function submitAnswer(e) {
  e.preventDefault();
  const answerVal = document.getElementById("answer-input").value.trim();

  const isQna = activeQuestion && activeQuestion.question_type === "qna";
  if (!answerVal && !isQna) {
    Utils.showToast("Please enter a decryption solution before submitting!", "warning");
    return;
  }

  const timestamp = new Date().toISOString();

  // Save to local storage as verified submitted
  localStorage.setItem(
    `cq_ans_${questionUid}`,
    JSON.stringify({
      answer: answerVal,
      timestamp,
      submitted: true,
    }),
  );

  if (timerInterval) clearInterval(timerInterval);
  renderSuccessState(answerVal, timestamp);
}

function renderSuccessState(answer, timestampStr) {
  const mainContent = document.getElementById("main-content");

  const startKey = `cq_timer_start_${questionUid}`;
  const startSec = parseInt(localStorage.getItem(startKey)) || Math.floor(Date.now() / 1000);
  const endSec = Math.floor(new Date(timestampStr).getTime() / 1000);
  const elapsed = Math.max(0, endSec - startSec);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeTakenStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const hintsCount = Utils.getRevealedHints(questionUid).length;

  const originalPoints = activeQuestion ? (activeQuestion.points !== undefined ? activeQuestion.points : 0) : 0;
  const hintPenalty = Utils.calculateHintPenalty(hintsCount);
  const finalPointsToAward = Math.max(0, originalPoints - hintPenalty);
  const penaltyStr = hintPenalty > 0 ? `-${hintPenalty}` : '0';

  mainContent.innerHTML = `
        <div class="card success-overlay" style="text-align: center; border-top: 4px solid var(--accent); padding: 2rem;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">⏳</div>
            <h2 style="color: var(--text-main); margin-bottom: 1.5rem; font-size: 1.5rem; font-weight: 800;">Waiting for Volunteer Verification</h2>
            
            <div style="background-color: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; text-align: left; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; max-width: 400px; margin-left: auto; margin-right: auto;">
                <div style="display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: 600;">
                    <span style="color: var(--text-muted);">Question ID:</span>
                    <span style="color: var(--text-main);">${activeQuestion ? activeQuestion.id : 'N/A'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: 600;">
                    <span style="color: var(--text-muted);">Original Question Points:</span>
                    <span style="color: var(--text-main);">${originalPoints}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: 600;">
                    <span style="color: var(--text-muted);">Hints Used:</span>
                    <span style="color: var(--text-main);">${hintsCount}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: 600;">
                    <span style="color: var(--text-muted);">Hint Penalty:</span>
                    <span style="color: var(--error);">${penaltyStr}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: 700; border-bottom: 1px dashed var(--border); padding-bottom: 0.5rem; margin-bottom: 0.25rem;">
                    <span style="color: var(--text-muted);">Final Points to Award:</span>
                    <span style="color: var(--primary);">${finalPointsToAward}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.95rem; font-weight: 600;">
                    <span style="color: var(--text-muted);">Participant Response:</span>
                    <div style="color: var(--text-main); background-color: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; margin-top: 0.25rem; font-family: monospace; font-size: 0.9rem; white-space: pre-wrap; word-break: break-all; max-height: 150px; overflow-y: auto;">${escapeHtml(answer)}</div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: 600;">
                    <span style="color: var(--text-muted);">Time Taken:</span>
                    <span style="color: var(--text-main);">${timeTakenStr}</span>
                </div>
            </div>
            
            <p style="color: var(--primary); font-weight: 700; font-size: 1.1rem; margin-bottom: 0;">
                Submission Sent Successfully
            </p>
        </div>
    `;
}

function editSubmittedAnswer() {
  const saved = Utils.getTeamAnswer(questionUid);
  if (saved) {
    saved.submitted = false;
    localStorage.setItem(`cq_ans_${questionUid}`, JSON.stringify(saved));
  }
  loadQuestion();
}

function openHintsModal() {
  renderHintsModal();
  Utils.openModal("hint-modal-overlay");
}

function renderHintsModal() {
  const container = document.getElementById("hint-modal-content");
  if (!activeQuestion || !activeQuestion.hints) return;

  const revealedIndices = Utils.getRevealedHints(questionUid);

  // Sort hints by order_no
  const sortedHints = [...activeQuestion.hints].sort(
    (a, b) => a.order_no - b.order_no,
  );

  container.innerHTML = `
        <div class="hint-list">
            ${sortedHints
              .map((hint, idx) => {
                const isRevealed = revealedIndices.includes(hint.order_no);

                if (isRevealed) {
                  return `
                        <div class="hint-item">
                            <div class="hint-header">
                                <span style="font-weight: 700; color: var(--primary); font-size: 0.85rem; text-transform: uppercase;">
                                    Hint #${hint.order_no} (Revealed)
                                </span>
                            </div>
                            <div class="hint-content">${escapeHtml(hint.text)}</div>
                        </div>
                    `;
                } else {
                  // Check if previous hint has been revealed
                  const isAvailable = hint.order_no === 1 || revealedIndices.includes(hint.order_no - 1);
                  const cost = hint.order_no - 1;

                  if (isAvailable) {
                    const costText = cost === 0 
                      ? "<strong>FREE</strong><br>(No Point Deduction)" 
                      : `<strong>Cost: -${cost} Point${cost > 1 ? 's' : ''}</strong>`;

                    return `
                        <div class="hint-item locked" style="border: 1px dashed var(--accent);">
                            <div class="hint-header">
                                <span style="font-weight: 700; color: var(--accent-dark); font-size: 0.85rem; text-transform: uppercase;">
                                    Hint #${hint.order_no} (Available)
                                </span>
                            </div>
                            <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
                                <div style="font-size: 0.85rem; color: var(--text-muted);">
                                    ${costText}
                                </div>
                                <button class="btn btn-accent btn-sm" onclick="confirmRevealHint(${hint.order_no})">
                                    Unlock Hint #${hint.order_no}
                                </button>
                            </div>
                        </div>
                    `;
                  } else {
                    return `
                        <div class="hint-item locked" style="opacity: 0.6; cursor: not-allowed; border: 1px solid var(--border);">
                            <div class="hint-header" style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-size: 1.1rem;">🔒</span>
                                <span style="font-weight: 700; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">
                                    Hint #${hint.order_no} (Locked)
                                </span>
                            </div>
                            <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
                                Unlock Hint #${hint.order_no - 1} first
                            </div>
                        </div>
                    `;
                  }
                }
              })
              .join("")}
        </div>
    `;
}

async function confirmRevealHint(orderNo) {
  let confirmMessage = "";
  if (orderNo === 1) {
    confirmMessage = "This hint is FREE (No point deduction).\n\nDo you want to continue?";
  } else {
    const cost = orderNo - 1;
    confirmMessage = `This hint will deduct ${cost} point${cost > 1 ? 's' : ''} from your final score.\n\nDo you want to continue?`;
  }

  const confirmed = await Utils.confirm(
    `Hint ${orderNo}`,
    confirmMessage,
    { confirmText: "Unlock", cancelText: "Cancel" }
  );

  if (confirmed) {
    Utils.revealHint(questionUid, orderNo);
    renderHintsModal();
    updateHintsCounterOnScreen();
  }
}

function updateHintsCounterOnScreen() {
  const counterEl = document.getElementById("hints-counter");
  if (counterEl) {
    const revealedCount = Utils.getRevealedHints(questionUid).length;
    counterEl.textContent = `Hints Used : ${revealedCount}`;
  }
}

// Escape HTML utility helper
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, function (m) {
    return map[m];
  });
}

function setupHintTimer() {
  const hintBtnContainer = document.getElementById("hint-btn-container");
  if (!hintBtnContainer) return;

  const startKey = `cq_timer_start_${questionUid}`;
  let startTimestamp = localStorage.getItem(startKey);
  if (!startTimestamp) {
    startTimestamp = Math.floor(Date.now() / 1000).toString();
    localStorage.setItem(startKey, startTimestamp);
    localStorage.setItem(`cq_timer_qid_${questionUid}`, questionUid);
  }

  const startSec = parseInt(startTimestamp);
  const hintsCount = activeQuestion.hints ? activeQuestion.hints.length : 0;
  const hasHints = hintsCount > 0;

  if (!hasHints) {
    hintBtnContainer.innerHTML = "<div></div>";
    return;
  }

  function updateHintVisibility() {
    const nowSec = Math.floor(Date.now() / 1000);
    const elapsed = nowSec - startSec;

    if (elapsed >= 60) {
      hintBtnContainer.innerHTML = `
        <button type="button" class="btn btn-secondary" onclick="openHintsModal()">
            Need a Hint?
        </button>
      `;
      return true; // Stop interval
    } else {
      hintBtnContainer.innerHTML = "<div></div>";
      return false; // Continue checking
    }
  }

  // Check immediately
  const isFinished = updateHintVisibility();
  if (!isFinished) {
    const hintInterval = setInterval(() => {
      if (updateHintVisibility()) {
        clearInterval(hintInterval);
      }
    }, 1000);
  }
}

function toggleMenu(event) {
  if (event) {
    event.stopPropagation();
  }
  const dropdown = document.getElementById("menu-dropdown");
  if (dropdown) {
    dropdown.classList.toggle("active");
  }
}

function openRulesModal(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const dropdown = document.getElementById("menu-dropdown");
  if (dropdown) {
    dropdown.classList.remove("active");
  }
  Utils.openModal("rules-modal-overlay");
}

// Close dropdown when clicking anywhere else
document.addEventListener("click", () => {
  const dropdown = document.getElementById("menu-dropdown");
  if (dropdown) {
    dropdown.classList.remove("active");
  }
});
