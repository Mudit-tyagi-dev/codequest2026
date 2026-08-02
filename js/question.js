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
        question = await CodeQuestAPI.getQuestionById(questionId);
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
    answerHtml = `
            <div class="form-group">
                <label for="answer-input" class="form-label">Enter Mission Solution</label>
                <textarea id="answer-input" class="form-control" placeholder="Type your decryption logic or solution here..." required>${escapeHtml(inProgressAns)}</textarea>
            </div>
        `;
  }

  const hintsCount = q.hints ? q.hints.length : 0;
  const hasHints = hintsCount > 0;

  mainContent.innerHTML = `
        <div class="card">
            <!-- Header metadata -->
            <div class="mission-header">
                <div>
                    <div class="mission-title">Mission Protocol</div>
                    <div class="mission-sub">${escapeHtml(q.title)}</div>
                </div>
                <div class="badge badge-primary">${q.points} Points</div>
            </div>
            
            <div class="meta-row">
                <span class="badge badge-neutral">${Utils.getQuestionTypeLabel(q.question_type)}</span>
                <div id="timer-container"></div>
            </div>
            
            <!-- Description -->
            <div class="desc-text">${escapeHtml(q.description)}</div>
            
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
                
                <div class="grid grid-cols-2 mt-4">
                    ${
                      hasHints
                        ? `
                        <button type="button" class="btn btn-secondary" onclick="openHintsModal()">
                            Need Decryption Hint? (${hintsCount})
                        </button>
                    `
                        : "<div></div>"
                    }
                    <button type="submit" class="btn btn-primary" id="submit-btn">
                        Submit Solution
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

  if (!answerVal) {
    alert("Please enter a decryption solution before submitting!");
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
  const formattedTime = new Date(timestampStr).toLocaleTimeString();

  mainContent.innerHTML = `
        <div class="card success-overlay">
            <div style="font-size: 4rem; margin-bottom: 1rem;">📡</div>
            <span class="checkpoint-badge" style="background-color: var(--success); display: inline-block; margin-bottom: 1rem;">
                Pending Verification
            </span>
            <h2 style="color: var(--text-main); margin-bottom: 0.5rem;">Mission Code Transmitted</h2>
            <p style="margin-bottom: 2rem; max-width: 480px; margin-left: auto; margin-right: auto;">
                Your decryption logic has been secured. Please present this screen to the checkpoint coordinator for manual grading.
            </p>
            
            <div style="background-color: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; text-align: left; margin-bottom: 2rem;">
                <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem;">
                    Mission Context
                </div>
                <h4 style="margin-bottom: 1rem;">${escapeHtml(activeQuestion.title)}</h4>
                
                <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem;">
                    Your Solution
                </div>
                <div class="code-container" style="margin: 0; word-break: break-all; white-space: pre-wrap;">${escapeHtml(answer)}</div>
                
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-top: 1.5rem;">
                    <span>SUBMISSION TIME: ${formattedTime}</span>
                    <span>POINTS VALUE: ${activeQuestion.points}</span>
                </div>
            </div>
            
            <button class="btn btn-secondary btn-sm" onclick="editSubmittedAnswer()">
                Modify Solution
            </button>
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

/* Hints Modal Controls */
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
                                <span class="badge badge-accent">-${hint.penalty} Pts</span>
                            </div>
                            <div class="hint-content">${escapeHtml(hint.text)}</div>
                        </div>
                    `;
                } else {
                  return `
                        <div class="hint-item locked">
                            <div class="hint-header">
                                <span style="font-weight: 700; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">
                                    Hint #${hint.order_no} (Locked)
                                </span>
                                <span class="badge badge-danger">-${hint.penalty} Pts Penalty</span>
                            </div>
                            <div style="margin-top: 0.5rem;">
                                <button class="btn btn-accent btn-sm" onclick="confirmRevealHint(${hint.order_no}, ${hint.penalty})">
                                    Decrypt Hint #${hint.order_no}
                                </button>
                            </div>
                        </div>
                    `;
                }
              })
              .join("")}
        </div>
    `;
}

function confirmRevealHint(orderNo, penalty) {
  if (
    confirm(
      `Decrypting this hint will incur a deduction of ${penalty} points from your final challenge score.\n\nAre you sure you wish to proceed?`,
    )
  ) {
    Utils.revealHint(questionUid, orderNo);
    renderHintsModal();
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
