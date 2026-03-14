/* old mobile sidebar removed */

// 1. GLOBAL VARIABLES
let currentQuestion = 1;
let allQuestions = [];
let userAnswers = {};
let isReviewMode = false;
let isPracticeMode = false; // true bo'lsa natija saqlanmaydi
let timerInterval;
let activeTestId = null;

// Helper function to clean text
const cleanText = (txt) => String(txt || "").trim().toLowerCase();

document.addEventListener('DOMContentLoaded', function() {
    // Nav link onclick bor bo'lsa loadTab boshqaradi — qo'shimcha listener kerak emas
    // Faqat onclick yo'q linklarga listener qo'shamiz
    document.querySelectorAll('.sidebar-nav a').forEach(function(link) {
        if (!link.getAttribute('onclick')) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                updateActiveLink(this);
            });
        }
    });
});


// Helper function to update 'active' class in sidebar menu

function updateActiveLink(activeElement) {
    const navLinks = document.querySelectorAll('.sidebar-nav a, .admin-nav a');
    navLinks.forEach(l => l.classList.remove('active'));
    if (activeElement) {
        activeElement.classList.add('active');
    }
}

// DYNAMIC SECTION SWITCHING (Global scope)


/* =====================================================
   GLOBAL TEST QIDIRUVI
   ===================================================== */
function globalSearch(query) {
    const q = query.trim().toLowerCase();
    const dropdown = document.getElementById('searchDropdown');

    // Dropdown yo'q bo'lsa yaratamiz
    if (!dropdown) {
        createSearchDropdown();
    }

    if (!q) {
        closeSearchDropdown();
        return;
    }

    // Barcha testlarni to'plab olamiz (home + my-tests bo'limlaridan)
    const allTestItems = [];

    // 1. Home — .quiz-item elementlari
    document.querySelectorAll('.quiz-item').forEach(item => {
        const subjectEl = item.querySelector('[data-subject-name]');
        const subjectName = subjectEl ? subjectEl.getAttribute('data-subject-name') : '';
        const subjectDisplay = subjectEl ? subjectEl.textContent.trim() : subjectName;
        const startBtn = item.querySelector('.start-btn');
        const gradeEl = item.querySelector('.grade-questions-text');
        const grade = gradeEl ? gradeEl.textContent.trim() : '';

        if (subjectName) {
            allTestItems.push({
                name: subjectName,
                display: subjectDisplay,
                grade: grade,
                btn: startBtn,
                section: 'home',
                element: item
            });
        }
    });

    // 2. My-tests — .test-row-item elementlari
    document.querySelectorAll('.test-row-item').forEach(item => {
        const subjectEl = item.querySelector('[data-subject-name]');
        const subjectName = subjectEl ? subjectEl.getAttribute('data-subject-name') : '';
        const subjectDisplay = subjectEl ? subjectEl.textContent.trim() : subjectName;
        const startBtn = item.querySelector('button:not([disabled])');
        const timeEl = item.querySelector('[data-i18n="unit-min"]');
        const qEl = item.querySelector('[data-i18n="unit-questions"]');
        const info = (timeEl ? timeEl.parentElement.textContent.trim() : '') +
                     (qEl ? ' • ' + qEl.parentElement.textContent.trim() : '');

        if (subjectName) {
            allTestItems.push({
                name: subjectName,
                display: subjectDisplay,
                grade: info,
                btn: startBtn,
                section: 'my-tests',
                element: item
            });
        }
    });

    // Filtrlash
    const results = allTestItems.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.display.toLowerCase().includes(q)
    );

    showSearchDropdown(results, q);
}

function createSearchDropdown() {
    const searchBox = document.querySelector('.search-box');
    if (!searchBox) return;

    const dropdown = document.createElement('div');
    dropdown.id = 'searchDropdown';
    dropdown.style.cssText = `
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.12);
        z-index: 9999;
        overflow: hidden;
        max-height: 380px;
        overflow-y: auto;
    `;
    searchBox.style.position = 'relative';
    searchBox.appendChild(dropdown);

    // Tashqariga bosilsa yopilsin
    document.addEventListener('click', function(e) {
        if (!searchBox.contains(e.target)) closeSearchDropdown();
    });
}

function showSearchDropdown(results, q) {
    let dropdown = document.getElementById('searchDropdown');
    if (!dropdown) { createSearchDropdown(); dropdown = document.getElementById('searchDropdown'); }
    if (!dropdown) return;

    dropdown.style.display = 'block';

    if (results.length === 0) {
        dropdown.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 14px;">
                <i class="fas fa-search" style="font-size: 24px; margin-bottom: 8px; display: block; opacity: 0.4;"></i>
                ${t('no-results') || 'Natija topilmadi'}
            </div>`;
        return;
    }

    const lang = localStorage.getItem('appLanguage') || 'uz';
    const sectionLabel = { home: t('available-tests') || 'Mavjud testlar', 'my-tests': t('my-tests-card') || 'Mening testlarim' };
    let seenSections = {};

    dropdown.innerHTML = results.map(item => {
        let sectionHeader = '';
        if (!seenSections[item.section]) {
            seenSections[item.section] = true;
            sectionHeader = `<div style="padding: 8px 16px 4px; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; background: #f8fafc; border-bottom: 1px solid #f1f5f9;">
                ${sectionLabel[item.section]}
            </div>`;
        }

        // Mos kelgan qismni highlight qilish
        const highlighted = item.display.replace(
            new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
            '<mark style="background:#dbeafe; color:#1d4ed8; border-radius:3px; padding:0 2px;">$1</mark>'
        );

        const hasBtn = item.btn && !item.btn.disabled;
        const icon = item.section === 'home' ? 'fas fa-book' : 'fas fa-star';
        const color = item.section === 'home' ? '#3b82f6' : '#4f46e5';

        return sectionHeader + `
            <div class="search-result-item" onclick="goToTest('${item.section}', '${item.name}')"
                 style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #f8fafc; transition: background 0.15s;"
                 onmouseover="this.style.background='#f8fafc'"
                 onmouseout="this.style.background='white'">
                <div style="width: 36px; height: 36px; background: ${color}18; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="${icon}" style="color: ${color}; font-size: 14px;"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 14px; color: #1e293b;">${highlighted}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">${item.grade}</div>
                </div>
                <i class="fas fa-arrow-right" style="color: #cbd5e1; font-size: 12px;"></i>
            </div>`;
    }).join('');
}

function goToTest(section, subjectName) {
    closeSearchDropdown();
    document.getElementById('globalSearchInput').value = '';

    // Bo'limga o'tamiz
    loadTab(section);

    // 300ms keyin element topib, highlight qilamiz
    setTimeout(() => {
        const allItems = document.querySelectorAll('.quiz-item, .test-row-item');
        allItems.forEach(item => {
            const subjectEl = item.querySelector('[data-subject-name]');
            if (subjectEl && subjectEl.getAttribute('data-subject-name') === subjectName) {
                // scrollIntoView olib tashlandi — tepaga o'tmaydi
                item.style.transition = 'box-shadow 0.3s, transform 0.3s';
                item.style.boxShadow = '0 0 0 3px #3b82f680';
                item.style.transform = 'scale(1.01)';
                setTimeout(() => {
                    item.style.boxShadow = '';
                    item.style.transform = '';
                }, 1800);
            }
        });
    }, 300);
}

function closeSearchDropdown() {
    const d = document.getElementById('searchDropdown');
    if (d) d.style.display = 'none';
}

/* ============================================
   MOBILE SIDEBAR
   ============================================ */
function dToggle() {
    var s = document.querySelector('.sidebar');
    var o = document.getElementById('dOv');
    var b = document.getElementById('dHam');
    if (!s) return;
    var open = s.classList.contains('is-open');
    s.classList.toggle('is-open', !open);
    if (o) o.classList.toggle('is-open', !open);
    if (b) b.classList.toggle('is-open', !open);
    document.body.style.overflow = open ? '' : 'hidden';
}
function dClose() {
    var s = document.querySelector('.sidebar');
    if (!s) return;
    s.classList.remove('is-open');
    var o = document.getElementById('dOv');
    var b = document.getElementById('dHam');
    if (o) o.classList.remove('is-open');
    if (b) b.classList.remove('is-open');
    document.body.style.overflow = '';
}
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) dClose();
});

function loadTab(tabName) {
    var sectionMap = {
        'home'    : 'home-section',
        'my-tests': 'my-tests',
        'results' : 'results-section',
        'reyting' : 'reyting-section',
        'settings': 'settings-section',
    };

    // 1. Barcha sectionlarni yashirish (!important override)
    Object.values(sectionMap).forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'none', 'important');
    });

    // 2. Kerakli sectionni ko'rsatish (!important override)
    var sec = document.getElementById(sectionMap[tabName]);
    if (!sec) return;
    sec.style.setProperty('display', 'block', 'important');
    // Sahifalar o'zgarganda scroll tepaga qaytsin
    var mc = document.querySelector('.main-content');
    if (mc) mc.scrollTop = 0;
    window.scrollTo(0, 0);
    try {
        sec.animate([
            { opacity: 0, transform: 'translateY(4px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 180, easing: 'ease-out' });
    } catch(e) {}

    // 3. Sidebar active linkni yangilash
    document.querySelectorAll('.sidebar-nav a').forEach(function(l) {
        l.classList.remove('active');
    });
    // tabName bo'yicha to'g'ri linkni topamiz
    var matched = null;
    document.querySelectorAll('.sidebar-nav a[onclick]').forEach(function(l) {
        var oc = l.getAttribute('onclick') || '';
        if (oc.indexOf("'" + tabName + "'") !== -1 || oc.indexOf('"' + tabName + '"') !== -1) {
            matched = l;
        }
    });
    if (matched) matched.classList.add('active');

    // 4. Mobileda sidebar yopilsin
    dClose(); /* Har doim yopilsin */

    // Grafik sahifaga o'tilganda chartni resize qilish
    if (tabName === 'results') {
        setTimeout(function() {
            if (typeof Chart !== 'undefined') {
                var g = Chart.getChart('growthChart');
                var s = Chart.getChart('skillChart');
                if (g) g.resize();
                if (s) s.resize();
            }
        }, 50);
    }
}

/*
FUNCTIONS FOR TEST TAKING START HERE
*/
// 1. CSRF TOKEN (for Django)
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// 3. START TEST
function startTest(testId, duration, subject) {
    if (!testId || testId === 'undefined') {
        alert(t("js-no-questions"));
        return;
    }

    activeTestId = testId; // Global ID-ni saqlaymiz
    isPracticeMode = false; // Oddiy test — natija saqlanadi
    const url = `/get-questions/${testId}/`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.questions && data.questions.length > 0) {
                // 1. Load data into global variables
                allQuestions = data.questions;
                currentQuestion = 1;
                userAnswers = {};
                isReviewMode = false;

                // 2. Update modal title
                const modalTitle = document.getElementById('modalSubjectTitle');
                if (modalTitle) modalTitle.innerText = subject;

                // 3. Render screen and start timer
                renderQuestion();
                startTimer(duration * 60);

                // 4. Show modal
                document.getElementById('testModal').style.display = 'flex';
                document.body.style.overflow = 'hidden'; // Lock background scroll
            } else {
                alert(t("js-no-questions"));
            }
        })
        .catch(err => console.error("Error:", err));
}


// MASHQ REJIMI — natija saqlanmaydi
function startPracticeTest(testId, duration, subject) {
    if (!testId || testId === 'undefined') {
        alert(t("js-no-questions"));
        return;
    }

    activeTestId = testId;
    isPracticeMode = true; // Natija saqlanmaydi!
    const url = `/get-questions/${testId}/`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.questions && data.questions.length > 0) {
                allQuestions = data.questions;
                currentQuestion = 1;
                userAnswers = {};
                isReviewMode = false;

                const modalTitle = document.getElementById('modalSubjectTitle');
                if (modalTitle) modalTitle.innerText = subject;

                renderQuestion();
                startTimer(duration * 60);
                document.getElementById('testModal').style.display = 'flex';
                document.body.style.overflow = 'hidden';
            } else {
                alert(t("js-no-questions"));
            }
        })
        .catch(err => console.error("Error:", err));
}

// 4. REVIEW TEST RESULTS

async function reviewTest(testId, resultId) {
    try {
        isReviewMode = true;

        // HIDE TIMER
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) {
            timerDisplay.style.display = 'none'; // Hidden in review mode
        }

        // Get questions from DB via resultId, not session
        const res = await fetch(`/get-result-details/${resultId}/`);
        const data = await res.json();

        if (data.status === 'success') {
            allQuestions = data.questions;

            // Get user answers from json_script
            const answersElement = document.getElementById(String(resultId));
            userAnswers = answersElement ? JSON.parse(answersElement.textContent) : {};

            isReviewMode = true;
            currentQuestion = 1;
            renderQuestion();
            document.getElementById('testModal').style.display = 'flex';
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
// 5. MAIN RENDER FUNCTION (Universal)
function renderQuestion() {
    if (allQuestions.length === 0) return;
    const area = document.getElementById('questionArea');
    const q = allQuestions[currentQuestion - 1];

    // 1. Format data
    let rawUserAnswer = userAnswers[currentQuestion] || userAnswers[String(currentQuestion)];
    const userSelected = cleanText(rawUserAnswer);
    const correctAnswer = cleanText(q.correct);

    // NEW: Detect unanswered questions (empty or undefined)
    const isSkipped = (userSelected === "" || userSelected === "undefined" || !userSelected);

    // 2. NAVIGATION (number boxes at top)
    let navHtml = `<div class="question-nav-container"><div class="question-nav-scroll">`;
    for (let i = 1; i <= allQuestions.length; i++) {
        let cls = (i === currentQuestion) ? 'active' : '';

        if (isReviewMode) {
            let uA = cleanText(userAnswers[i] || userAnswers[String(i)]);
            let cA = cleanText(allQuestions[i-1].correct);

            // If no answer was given at all
            if (!uA || uA === "undefined" || uA === "") {
                cls += " skipped-nav"; // For red background in CSS
            } else {
                // Assign class based on correct or wrong answer
                cls += (uA === cA) ? " correct-nav" : " wrong-nav";
            }
        } else {
            if (userAnswers[i] || userAnswers[String(i)]) cls += " answered";
        }
        navHtml += `<div class="nav-box ${cls}" onclick="jumpToQuestion(${i});return false;">${i}</div>`;
    }
    navHtml += `</div></div>`;

    // 3. DRAW OPTIONS
    let optionsHtml = q.options.map(opt => {
        const currentOpt = cleanText(opt);
        let statusClass = "";

        if (isReviewMode) {
            if (currentOpt === correctAnswer) {
                statusClass = "correct-opt"; // Correct answer always green
            }
            else if (!isSkipped && currentOpt === userSelected) {
                statusClass = "wrong-opt"; // Red only if wrong answer was selected
            }
        } else {
            if (userSelected !== "" && currentOpt === userSelected) {
                statusClass = "selected";
            }
        }

        return `
            <div class="option-item ${statusClass}"
                 onclick="${isReviewMode ? '' : `selectOption('${opt.replace(/'/g, "\\'")}')`}">
                <span class="opt-circle"></span> ${opt}
            </div>`;
    }).join('');

    // NEW: Extra classes for question card
    const tagClass = (isReviewMode && isSkipped) ? "q-tag skipped-tag" : "q-tag";
    const gridClass = (isReviewMode && isSkipped) ? "options-grid skipped-grid" : "options-grid";

    area.innerHTML = `
        ${navHtml}
        <div class="question-card">
            <span class="${tagClass}">Question ${currentQuestion} ${isSkipped && isReviewMode ? `<small>(${t('js-not-answered')})</small>` : ''}</span>
            <p class="q-text">${q.text}</p>
            <div class="${gridClass}">${optionsHtml}</div>
        </div>`;

    updateFooter();
}

// 6. CONTROL BUTTONS
function selectOption(val) {
    if (isReviewMode) return;
    userAnswers[currentQuestion] = val;
    renderQuestion();
}

function jumpToQuestion(n) {
    currentQuestion = n;
    renderQuestion();
    // Savol mazmuniga scroll (tepaga emas)
    var area = document.getElementById('questionArea');
    if (area) {
        area.scrollTop = 0;
        // Test container scroll ham tepaga — savol ko'rinsin
        var container = document.querySelector('.test-container');
        if (container) {
            var contentEl = container.querySelector('.test-content');
            if (contentEl) contentEl.scrollTop = 0;
        }
    }
    // Window scroll bloklash (test modal ochiq)
    return false;
}

function changeQuestion(step) {
    let newQ = currentQuestion + step;
    if (newQ >= 1 && newQ <= allQuestions.length) {
        currentQuestion = newQ;
        renderQuestion();
    }
}

function updateFooter() {
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');

    prevBtn.disabled = (currentQuestion === 1);
    prevBtn.onclick = () => changeQuestion(-1);

    if (currentQuestion === allQuestions.length) {
    nextBtn.innerHTML = isReviewMode ? t('btn-close') : t('btn-finish');
    // Bu yerda finishTest(false) yoki shunchaki finishTest() deb yozing
    nextBtn.onclick = isReviewMode ? closeModal : () => finishTest(false);

    } else {
        nextBtn.innerHTML = t('btn-next');
        nextBtn.onclick = () => changeQuestion(1);
    }

    // Progress bar and indicator
    const answeredCount = Object.keys(userAnswers).length;
    document.getElementById('questionIndicator').innerHTML = `${t("js-question")} ${currentQuestion} / ${allQuestions.length} <br> <small style="color: #10b981;">${t("js-answered")}: ${answeredCount}</small>`;
    document.getElementById('progressBar').style.width = (currentQuestion / allQuestions.length) * 100 + '%';
}

// 7. FINISH AND SAVE TEST

/* =====================================================
   MASHQ REJIMI — NATIJA VA REVIEW
   ===================================================== */

// Natija modalini ko'rsatish (practice)
function showPracticeResult(correctCount, total, percent) {
    let wrong = 0, skipped = 0;
    allQuestions.forEach((q, i) => {
        const ua = userAnswers[i+1] || userAnswers[String(i+1)];
        if (!ua || ua === '' || ua === 'undefined') {
            skipped++;
        } else if (ua !== q.correct) {
            wrong++;
        }
    });

    // Score
    document.getElementById('resultScore').innerText = `${correctCount} / ${total}`;
    document.getElementById('resultPercent').innerHTML =
        `<span id="resultPercentText">${t('result-correct').replace('0', percent)}</span>`;

    // Score bar animatsiyasi
    const bar = document.getElementById('result-score-bar');
    if (bar) setTimeout(() => bar.style.width = percent + '%', 100);

    // Rang (yashil/sariq/qizil)
    const icon = document.getElementById('result-icon');
    const scoreEl = document.getElementById('resultScore');
    if (percent >= 80) {
        if (icon) { icon.className = 'fas fa-trophy'; icon.style.color = '#f59e0b'; }
        if (scoreEl) scoreEl.style.color = '#10b981';
    } else if (percent >= 50) {
        if (icon) { icon.className = 'fas fa-check-circle'; icon.style.color = '#3b82f6'; }
        if (scoreEl) scoreEl.style.color = '#3b82f6';
    } else {
        if (icon) { icon.className = 'fas fa-times-circle'; icon.style.color = '#ef4444'; }
        if (scoreEl) scoreEl.style.color = '#ef4444';
    }

    // Breakdown grid
    const breakdown = document.getElementById('result-breakdown');
    if (breakdown) {
        breakdown.innerHTML = `
            <div style="background:#f0fdf4;padding:12px;border-radius:12px;border:1px solid #bbf7d0;">
                <div style="font-size:22px;font-weight:800;color:#10b981;">${correctCount}</div>
                <div style="font-size:11px;color:#16a34a;font-weight:600;margin-top:2px;">✓ To'g'ri</div>
            </div>
            <div style="background:#fef2f2;padding:12px;border-radius:12px;border:1px solid #fecaca;">
                <div style="font-size:22px;font-weight:800;color:#ef4444;">${wrong}</div>
                <div style="font-size:11px;color:#dc2626;font-weight:600;margin-top:2px;">✗ Xato</div>
            </div>
            <div style="background:#f8fafc;padding:12px;border-radius:12px;border:1px solid #e2e8f0;">
                <div style="font-size:22px;font-weight:800;color:#94a3b8;">${skipped}</div>
                <div style="font-size:11px;color:#64748b;font-weight:600;margin-top:2px;">— O'tkazildi</div>
            </div>`;
    }

    // Practice tugmalarini ko'rsatish
    const practiceBtns = document.getElementById('practice-result-btns');
    const normalBtns   = document.getElementById('normal-result-btns');
    if (practiceBtns) practiceBtns.style.display = 'flex';
    if (normalBtns)  normalBtns.style.display   = 'none';
}

// Normal test uchun natija modali
function showNormalResult(correctCount, total, percent) {
    document.getElementById('resultScore').innerText = `${correctCount} / ${total}`;
    document.getElementById('resultPercent').innerHTML =
        `<span id="resultPercentText">${t('result-correct').replace('0', percent)}</span>`;

    const bar = document.getElementById('result-score-bar');
    if (bar) setTimeout(() => bar.style.width = percent + '%', 100);

    const breakdown = document.getElementById('result-breakdown');
    if (breakdown) {
        const wrong = total - correctCount;
        breakdown.innerHTML = `
            <div style="background:#f0fdf4;padding:12px;border-radius:12px;border:1px solid #bbf7d0;">
                <div style="font-size:22px;font-weight:800;color:#10b981;">${correctCount}</div>
                <div style="font-size:11px;color:#16a34a;font-weight:600;margin-top:2px;">✓ To'g'ri</div>
            </div>
            <div style="background:#fef2f2;padding:12px;border-radius:12px;border:1px solid #fecaca;">
                <div style="font-size:22px;font-weight:800;color:#ef4444;">${wrong}</div>
                <div style="font-size:11px;color:#dc2626;font-weight:600;margin-top:2px;">✗ Xato</div>
            </div>
            <div style="background:#eef2ff;padding:12px;border-radius:12px;border:1px solid #c7d2fe;">
                <div style="font-size:22px;font-weight:800;color:#4f46e5;">${percent}%</div>
                <div style="font-size:11px;color:#4338ca;font-weight:600;margin-top:2px;">Ball</div>
            </div>`;
    }

    const practiceBtns = document.getElementById('practice-result-btns');
    const normalBtns   = document.getElementById('normal-result-btns');
    if (practiceBtns) practiceBtns.style.display = 'none';
    if (normalBtns)  normalBtns.style.display   = 'block';
}

// "Xatolarni ko'rish" tugmasi
function startPracticeReview() {
    // resultModal yopamiz, testModal review mode da ochamiz
    document.getElementById('resultModal').style.display = 'none';
    isReviewMode = true;
    isPracticeMode = false;
    currentQuestion = 1;

    // Taymer yashirish
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) timerDisplay.style.display = 'none';

    renderQuestion();
    document.getElementById('testModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// "Yopish" tugmasi (practice natijasini yopish)
function closePracticeResult() {
    document.getElementById('resultModal').style.display = 'none';
    document.body.style.overflow = '';
    isPracticeMode = false;
    isReviewMode = false;
    // Taymer qayta ko'rsatish
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) timerDisplay.style.display = '';
}

function finishTest(isAuto = false) {
    if (!isAuto && !confirm(t("js-confirm-finish"))) return;
    clearInterval(timerInterval);

    let correctCount = 0;
    allQuestions.forEach((q, index) => {
        if (userAnswers[index + 1] === q.correct) correctCount++;
    });

    const total = allQuestions.length;
    const percent = Math.round((correctCount / total) * 100);
    const subject = document.getElementById('modalSubjectTitle').innerText.trim();

    if (isPracticeMode) {
        // Natija saqlanmaydi — review uchun savollar xotirada qoladi
        showPracticeResult(correctCount, total, percent);
        document.getElementById('testModal').style.display = 'none';
        document.getElementById('resultModal').style.display = 'flex';
        // isPracticeMode = false qilinmaydi — review tugagandan keyin yopiladi
    } else {
        fetch('/save-test-result/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
            body: JSON.stringify({
                test_id: activeTestId,
                subject: subject,
                total: total,
                correct: correctCount,
                percent: percent,
                user_answers: userAnswers
            })
        })
        .then(r => r.json())
        .then(data => {
            showNormalResult(correctCount, total, percent);
            document.getElementById('testModal').style.display = 'none';
            document.getElementById('resultModal').style.display = 'flex';
        });
    }
}

// 8. HELPER FUNCTIONS
function startTimer(sec) {
    clearInterval(timerInterval);

    // Get element once (for performance)
    const display = document.getElementById('timerDisplay');

    // Reset color to default (e.g. dark blue) on each new timer start
    display.style.color = "#1e3a8a";

    timerInterval = setInterval(() => {
        let m = Math.floor(sec / 60);
        let s = sec % 60;

        display.innerText = `${m}:${s < 10 ? '0' + s : s}`;

        // WARNING: Turn red when 10 seconds remain
        if (sec <= 10 && sec > 0) {
            display.style.color = "#e11d48"; // Bright red
            display.style.fontWeight = "bold"; // Extra visibility
        }

        if (sec <= 0) {
            clearInterval(timerInterval);
            finishTest(true);
            return;
        }

        sec--;
    }, 1000);
}


function confirmExit() {
    if (isReviewMode) {
        closeModal();
        // Review modali yopilganda taymer qayta ko'rinsin
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) timerDisplay.style.display = '';
        isReviewMode = false;
        isPracticeMode = false;
    } else {
        finishTest();
    }
}

function closeModal() {
    document.getElementById('testModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    clearInterval(timerInterval);
}



/*
USER AVATAR SECTION STARTS HERE
*/

/* =====================================================
   PAROL O'ZGARTIRISH MODALI
   ===================================================== */
function openPasswordModal() {
    // Dropdownni yopish
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown) userDropdown.classList.remove('active');

    // Inputlarni tozalash
    ['pwd-current', 'pwd-new', 'pwd-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    hidePwdAlert();
    resetPwdStrength();

    document.getElementById('passwordModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('pwd-current').focus(), 100);
}

function closePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.body.style.overflow = '';
}

// Tashqariga bosilsa yopilsin
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closePasswordModal();
        });
    }
});

function togglePwdVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function checkPwdStrength(val) {
    const bar = document.getElementById('pwdStrengthFill');
    const text = document.getElementById('pwdStrengthText');
    if (!bar || !text) return;

    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
        { pct: '20%', color: '#ef4444', label: t('pwd-weak') || "Juda zaif" },
        { pct: '40%', color: '#f97316', label: t('pwd-fair') || "Zaif" },
        { pct: '60%', color: '#eab308', label: t('pwd-good') || "O'rtacha" },
        { pct: '80%', color: '#22c55e', label: t('pwd-strong') || "Kuchli" },
        { pct: '100%', color: '#10b981', label: t('pwd-vstrong') || "Juda kuchli" },
    ];

    const level = levels[Math.min(score - 1, 4)];
    if (val.length === 0) {
        bar.style.width = '0';
        text.textContent = '';
    } else if (level) {
        bar.style.width = level.pct;
        bar.style.background = level.color;
        text.textContent = level.label;
        text.style.color = level.color;
    }
}

function resetPwdStrength() {
    const bar = document.getElementById('pwdStrengthFill');
    const text = document.getElementById('pwdStrengthText');
    if (bar) bar.style.width = '0';
    if (text) text.textContent = '';
}

function showPwdAlert(msg, isError = true) {
    const el = document.getElementById('pwdAlert');
    if (!el) return;
    el.style.display = 'block';
    el.style.background = isError ? '#fef2f2' : '#f0fdf4';
    el.style.color = isError ? '#dc2626' : '#16a34a';
    el.style.border = `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`;
    el.innerHTML = `<i class="fas fa-${isError ? 'exclamation-circle' : 'check-circle'}"></i> ${msg}`;
}

function hidePwdAlert() {
    const el = document.getElementById('pwdAlert');
    if (el) el.style.display = 'none';
}

async function submitPasswordChange() {
    const current = document.getElementById('pwd-current').value.trim();
    const newPwd  = document.getElementById('pwd-new').value.trim();
    const confirm = document.getElementById('pwd-confirm').value.trim();
    const btn = document.getElementById('pwdSubmitBtn');

    hidePwdAlert();

    // Validatsiya
    if (!current) { showPwdAlert(t('pwd-err-current') || "Joriy parolni kiriting"); return; }
    if (!newPwd)  { showPwdAlert(t('pwd-err-new') || "Yangi parolni kiriting"); return; }
    if (newPwd.length < 6) { showPwdAlert(t('pwd-err-short') || "Parol kamida 6 ta belgidan iborat bo'lishi kerak"); return; }
    if (newPwd !== confirm) { showPwdAlert(t('pwd-err-match') || "Parollar mos kelmadi"); return; }

    // Yuborish
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const res = await fetch('/change-student-password/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ current_password: current, new_password: newPwd })
        });

        const data = await res.json();

        if (data.status === 'success') {
            showPwdAlert(t('pwd-success') || "Parol muvaffaqiyatli o'zgartirildi!", false);
            setTimeout(() => closePasswordModal(), 1800);
        } else {
            showPwdAlert(data.message || (t('pwd-err-wrong') || "Joriy parol noto'g'ri"));
        }
    } catch (e) {
        showPwdAlert(t('pwd-err-server') || "Server xatosi. Qayta urinib ko'ring.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> <span data-i18n="pwd-save">' + (t('pwd-save') || 'Parolni saqlash') + '</span>';
    }
}

function toggleUserMenu(event) {
    // Stop click event propagation
    event.stopPropagation();

    const dropdown = document.getElementById('userDropdown');

    // Toggle the class
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// Close when clicking outside
window.addEventListener('click', function(e) {
    const dropdown = document.getElementById('userDropdown');
    const profile = document.querySelector('.user-profile');

    if (dropdown && dropdown.classList.contains('active')) {
        if (!profile.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    }
});



// ===================== GRAFIKLARNI CHIZISH =====================
function initCharts() {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js yuklanmagan!');
        return;
    }

    const labels = (window.rawLabels || []).map(l => translateSubject(l));
    const scores = window.rawScores || [];
    const avg    = window.avgScore  || 0;

    // --- 1. O'sish dinamikasi (Line chart) ---
    const ctxGrowth = document.getElementById('growthChart');
    if (ctxGrowth) {
        // Eski chart bo'lsa o'chiramiz
        const existing = Chart.getChart(ctxGrowth);
        if (existing) existing.destroy();

        if (labels.length === 0) {
            // Ma'lumot yo'q - bo'sh holat
            const noDataCtx = ctxGrowth.getContext('2d');
            noDataCtx.font = '14px sans-serif';
            noDataCtx.fillStyle = '#94a3b8';
            noDataCtx.textAlign = 'center';
            noDataCtx.fillText(t('no-results') || 'No results yet', ctxGrowth.width / 2, ctxGrowth.height / 2);
        } else {
            new Chart(ctxGrowth.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: t('js-score-label') || 'Score (%)',
                        data: scores,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59,130,246,0.08)',
                        borderWidth: 2.5,
                        pointBackgroundColor: '#3b82f6',
                        pointRadius: 5,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true, max: 100, ticks: { stepSize: 20, color: '#64748b' } }
                    }
                }
            });
        }
    }

    // --- 2. Bilim darajasi (Doughnut) ---
    const ctxSkill = document.getElementById('skillChart');
    if (ctxSkill) {
        const existingSkill = Chart.getChart(ctxSkill);
        if (existingSkill) existingSkill.destroy();

        const color = avg >= 85 ? '#10b981' : avg >= 60 ? '#3b82f6' : '#ef4444';
        new Chart(ctxSkill.getContext('2d'), {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [avg || 1, 100 - (avg || 1)],
                    backgroundColor: [color, '#f1f5f9'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initCharts);



// Open/close menu
function toggleUserMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('userDropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

// Mouse click event handler
window.addEventListener('click', function(event) {
    const dropdown = document.getElementById('userDropdown');
    const trigger = document.querySelector('.user-profile-trigger');

    // If click target is outside menu or trigger
    if (!trigger.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.style.display = 'none';
    }
});

window.processPhotoUpload = function() {
    const fileInput = document.getElementById('photo-upload');
    const file = fileInput.files[0];
    if (!file) return;

    // 1. Show on screen (Live Preview)
    const reader = new FileReader();
    reader.onload = (e) => {
        const headerImg = document.getElementById('header-avatar-img');
        const dropImg = document.getElementById('dropdown-avatar-preview');

        if (headerImg) {
            headerImg.src = e.target.result;
        } else {
            const miniContainer = document.querySelector('.user-avatar-mini');
            if (miniContainer) {
                miniContainer.innerHTML = `<img src="${e.target.result}" id="header-avatar-img"><span class="online-status"></span>`;
            }
        }

        if (dropImg) {
            dropImg.src = e.target.result;
        } else {
            const largeContainer = document.querySelector('.avatar-edit-wrapper');
            if (largeContainer) {
                largeContainer.innerHTML = `
                    <img src="${e.target.result}" id="dropdown-avatar-preview">
                    <label for="photo-upload" class="edit-photo-btn"><i class="fas fa-camera"></i></label>
                `;
            }
        }
    };
    reader.readAsDataURL(file);

    // 2. Upload to server (Django)
    const formData = new FormData();
    formData.append('profile_photo', file);

    // Get CSRF token (required for Django security)
    const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]') ?
                      document.querySelector('[name=csrfmiddlewaretoken]').value : '';

    fetch('/update-profile-photo/', {
        method: 'POST',
        body: formData,
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': csrftoken // 403 xatosini oldini oladi
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Server error occurred');
        return response.json();
    })
    .then(data => {
        if (data.status === 'success') {
            console.log("Successfully saved:", data.url);
        }
    })
    .catch(error => {
        console.error('Upload error:', error);
    });
};



document.addEventListener('DOMContentLoaded', function() {
    const toast = document.getElementById('welcomeToast');
    const isSeen = localStorage.getItem('welcomeToastSeen');

    if (toast && !isSeen) {
        // Toast matnini til bo'yicha yangilash
        const toastBody = toast.querySelector('p');
        if (toastBody) toastBody.textContent = t('js-toast-body');
        // Slide in after 1 second
        setTimeout(() => {
            toast.classList.add('toast-show');

            // Slide out after 5 seconds
            setTimeout(() => {
                toast.classList.remove('toast-show');
                localStorage.setItem('welcomeToastSeen', 'true');
            }, 8000);
        }, 1000);
    }
});

/* =====================================================
   DARK MODE — works without F5
   ===================================================== */
(function() {
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.addEventListener('DOMContentLoaded', function() {
            document.body.classList.add('dark-mode');
            const toggle = document.getElementById('darkModeToggle');
            if (toggle) toggle.checked = true;
            fixInlineBackgrounds(true);
        });
    }
})();

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.checked = isDark;
    fixInlineBackgrounds(isDark);
    setTimeout(() => updateChartsForTheme(isDark), 100);
}

function fixInlineBackgrounds(isDark) {
    const selectors = ['.optional-card-glass', '.optional-tests-grid > div',
                       '.optional-selector-card', '.main-card-premium', '.test-row-item'];
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            if (isDark) {
                el.dataset.origBg = el.style.background || '';
                el.style.background = '#1e293b';
                el.style.borderColor = '#334155';
                el.querySelectorAll('h4,h3,h2').forEach(h => { h.dataset.origC = h.style.color||''; h.style.color='#f1f5f9'; });
                el.querySelectorAll('p').forEach(p => { p.dataset.origC = p.style.color||''; p.style.color='#94a3b8'; });
            } else {
                el.style.background = el.dataset.origBg || '';
                el.style.borderColor = '';
                el.querySelectorAll('h4,h3,h2').forEach(h => h.style.color = h.dataset.origC||'');
                el.querySelectorAll('p').forEach(p => p.style.color = p.dataset.origC||'');
            }
        });
    });
}

function updateChartsForTheme(isDark) {
    if (typeof Chart === 'undefined') return;
    const tc = isDark ? '#94a3b8' : '#64748b';
    const gc = isDark ? '#334155' : '#e2e8f0';
    Chart.defaults.color = tc;
    Chart.defaults.borderColor = gc;
    Object.values(Chart.instances).forEach(c => {
        ['x','y'].forEach(a => {
            if (c.options.scales?.[a]) {
                c.options.scales[a].ticks = {...(c.options.scales[a].ticks||{}), color: tc};
                c.options.scales[a].grid  = {...(c.options.scales[a].grid ||{}), color: gc};
            }
        });
        c.update();
    });
}

document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) toggle.checked = true;
        fixInlineBackgrounds(true);
        setTimeout(() => updateChartsForTheme(true), 500);
    }
    const savedLang = localStorage.getItem('appLanguage') || 'uz';
    const sel = document.getElementById('languageSelect');
    if (sel) sel.value = savedLang;
    applyLanguage(savedLang);
});



/* =====================================================
   FAN NOMLARI TARJIMASI
   ===================================================== */
const subjectTranslations = {
    uz: {
        "Matematika": "Matematika",
        "Ingliz tili": "Ingliz tili",
        "Ona tili": "Ona tili",
        "Ona-tili": "Ona-tili",
        "Fizika": "Fizika",
        "Kimyo": "Kimyo",
        "Biologiya": "Biologiya",
        "Geografiya": "Geografiya",
        "Tarix": "Tarix",
        "Rus tili": "Rus tili",
        "Informatika": "Informatika",
        "Adabiyot": "Adabiyot",
        "Algebra": "Algebra",
        "Geometriya": "Geometriya",
    },
    ru: {
        "Matematika": "Математика",
        "Ingliz tili": "Английский язык",
        "Ona tili": "Родной язык",
        "Ona-tili": "Родной язык",
        "Fizika": "Физика",
        "Kimyo": "Химия",
        "Biologiya": "Биология",
        "Geografiya": "География",
        "Tarix": "История",
        "Rus tili": "Русский язык",
        "Informatika": "Информатика",
        "Adabiyot": "Литература",
        "Algebra": "Алгебра",
        "Geometriya": "Геометрия",
    },
    en: {
        "Matematika": "Mathematics",
        "Ingliz tili": "English",
        "Ona tili": "Native Language",
        "Ona-tili": "Native Language",
        "Fizika": "Physics",
        "Kimyo": "Chemistry",
        "Biologiya": "Biology",
        "Geografiya": "Geography",
        "Tarix": "History",
        "Rus tili": "Russian",
        "Informatika": "Computer Science",
        "Adabiyot": "Literature",
        "Algebra": "Algebra",
        "Geometriya": "Geometry",
    }
};

// Fan nomini joriy tilga tarjima qilish
function translateSubject(name) {
    const lang = localStorage.getItem('appLanguage') || 'uz';
    const dict = subjectTranslations[lang] || subjectTranslations['en'];
    return dict[name] || name;
}

// Sahifadagi barcha fan nomlarini tarjima qilish
function applySubjectTranslations(lang) {
    const dict = subjectTranslations[lang] || subjectTranslations['en'];
    document.querySelectorAll('[data-subject-name]').forEach(el => {
        const original = el.getAttribute('data-subject-name');
        el.textContent = dict[original] || original;
    });
}

/* =====================================================
   LANGUAGE SWITCHING — FULL DICTIONARY
   ===================================================== */

// Translation helper - joriy tildan matn olish
function t(key) {
    const lang = localStorage.getItem('appLanguage') || 'uz';
    return (translations[lang] && translations[lang][key]) ? translations[lang][key] : (translations['en'][key] || key);
}

const translations = {
    uz: {
        // Sidebar
        "nav-home":"Asosiy panel","nav-tests":"Mening testlarim",
        "nav-results":"Natijalar","nav-rating":"Reyting","nav-settings":"Sozlamalar",
        // Header
        "search-ph":"Testlarni izlash...","user-status":"Ishtirokchi",
        // Dropdown
        "profile-settings":"Profil sozlamalari","my-certs":"Mening sertifikatlarim","logout":"Tizimdan chiqish",
        // Home stat cards
        "stat-completed":"Tugallangan testlar","stat-avg":"O'rtacha ball","stat-rank":"Umumiy reyting",
        // Home sections
        "available-tests":"Mavjud testlar","test-analysis":"Test tahlil oynasi",
        // Test buttons
        "btn-start":"Boshlash","btn-done":"Yakunlangan","btn-wait":"Kutish",
        "result-saved":"Natija qayd etildi","exam-open":"Imtihon ochiq","expired":"Muddat tugadi",
        "btn-locked":"Qulflangan","start-from-main":"Asosiy paneldan boshlang","test-open":"Test ochiq",
        // My Tests
        "my-tests-title":"Mening barcha testlarim","my-tests-desc":"Bu yerda asosiy va qo'shimcha testlarni boshqarish mumkin",
        "my-tests-card":"Mening testlarim","fan-settings":"Fanlarni sozlash","fan-limit":"Ko'pi bilan 2 ta tanlash mumkin",
        "your-grade":"Sizning sinfingiz","unit-grade":"sinf","unit-min":"daqiqa","unit-questions":"ta savol",
        "select-subject-opt":"Fan tanlang (Ixtiyoriy)","save-changes":"O'zgarishlarni saqlash",
        "limit-reached":"Limit to'ldi (2/2)","no-optional":"Hali qo'shimcha fanlar tanlanmagan.<br>Chap tarafdan kerakli fanni tanlang.",
        "lbl-main":"Asosiy","lbl-optional":"Qo'shimcha","btn-delete":"O'chirish",
        "no-tests":"Sizning sinfingiz va tanlangan fanlaringizga mos testlar hozircha mavjud emas.",
        // Results section
        "results-title":"Mening natijalarim va tahlil",
        "stat-total":"Jami topshirilgan","stat-avg2":"O'rtacha ko'rsatkich",
        "stat-certs":"Sertifikatlarim","stat-level":"Sizning darajangiz",
        "growth-chart":"O'sish dinamikasi","skill-level":"Bilim darajasi",
        "results-history":"Natijalar tarixi",
        "all-certs":"Barcha sertifikatlar","search-subj-ph":"Fanni qidirish...",
        // Table headers
        "th-subject":"Fan nomi","th-date":"Sana","th-correct":"To'g'ri/Jami",
        "th-level":"Daraja","th-result":"Natija (%)","th-action":"Harakat",
        "th-fullname":"Ism Familiya","th-school":"Maktab / Sinf","th-subj":"Fan",
        "th-solved":"Yechildi","th-result2":"Natija","th-rank":"O'rin","th-score2":"Ball",
        // Level labels
        "lvl-excellent":"Juda yaxshi","lvl-average":"O'rtacha","lvl-poor":"Juda yomon",
        "lbl-quality":"Sifat","lbl-high":"Yuqori","lbl-active":"Faol",
        "skill-excellent":"Juda yaxshi","skill-average":"O'rtacha","skill-new":"Yangi",
        "skill-pro":"Professional","skill-mid":"O'rta","skill-beg":"Boshlang'ich",
        // Result action buttons
        "btn-analysis":"Tahlil","btn-cert":"Sertifikat","insuff-score":"Ball yetarli emas",
        // Leaderboard
        "by-main-subj":"Asosiy fan bo'yicha",
        // Common
        "no-results":"Hozircha natija yo'q","no-data":"Hozircha ma'lumot yo'q",
        // Settings
        "settings-title":"Tizim sozlamalari","dark-lbl":"Tungi rejim",
        "dark-desc":"Ko'zlaringizni charchatmaslik uchun to'q rangli interfeys.",
        "lang-lbl":"Tizim tili","lang-desc":"O'zingizga qulay tilni tanlang.",
        // Test modal
        "btn-prev":"Oldingi","btn-next":"Keyingi","btn-finish":"Yakunlash","btn-close":"Yopish",
        "test-completed":"Test yakunlandi!","your-result":"Sizning natijangiz:",
        "result-correct":"To'g'ri: 0%","return-home":"Bosh sahifaga qaytish",
        "change-photo":"Rasmni o'zgartirish",
        // JS dynamic texts
        "js-no-questions":"Ushbu fan bo'yicha savollar topilmadi.",
        "js-confirm-finish":"Testni yakunlashni tasdiqlaysizmi?",
        "js-answered":"Bajarildi",
        "js-not-answered":"Javob berilmagan",
        "js-question":"Savol",
        "js-limit-reached":"Limit to'ldi (2/2)",
        "js-save-changes":"O'zgarishlarni saqlash",
        "js-blocked":"Bloklangan",
        "js-exam-started":"Imtihon vaqti boshlandi — o'chirib bo'lmaydi",
        "js-score-label":"Ball (%)",
        "js-toast-welcome":"Xush kelibsiz",
        "js-toast-body":"Bugun o'z bilimingizni oshirish uchun ajoyib kun.",
        "toast-body":"Bugun o'z bilimingizni oshirish uchun ajoyib kun.",
        "question-indicator":"Savol 1 / 25",
        "optional-card-desc":"Ushbu fan bo'yicha bazada mavjud mashqlar bilan bilimingizni oshiring.",
        "unit-score":"ball",
        "latest-results":"Oxirgi natijalar",
        "delete-btn-text":"O'chirish",
        "your-grade-label":"Sizning sinfingiz",
        "pwd-title":"Parolni o'zgartirish",
        "pwd-subtitle":"Xavfsizlik uchun kuchli parol tanlang",
        "pwd-current":"Joriy parol",
        "pwd-new":"Yangi parol",
        "pwd-confirm":"Yangi parolni tasdiqlang",
        "pwd-save":"Parolni saqlash",
        "btn-cancel":"Bekor qilish",
        "pwd-weak":"Juda zaif",
        "pwd-fair":"Zaif",
        "pwd-good":"O'rtacha",
        "pwd-strong":"Kuchli",
        "pwd-vstrong":"Juda kuchli",
        "pwd-success":"Parol muvaffaqiyatli o'zgartirildi!",
        "pwd-err-current":"Joriy parolni kiriting",
        "pwd-err-new":"Yangi parolni kiriting",
        "pwd-err-short":"Parol kamida 6 ta belgidan iborat bo'lishi kerak",
        "pwd-err-match":"Parollar mos kelmadi",
        "pwd-err-wrong":"Joriy parol noto'g'ri",
        "pwd-err-server":"Server xatosi. Qayta urinib ko'ring.",
        "btn-review-errors":"Xatolarni ko'rish",
        "btn-close-result":"Yopish",
        "lbl-correct":"To'g'ri",
        "lbl-wrong":"Xato",
        "lbl-skipped":"O'tkazildi",
    },
    ru: {
        "nav-home":"Главная","nav-tests":"Мои тесты",
        "nav-results":"Результаты","nav-rating":"Рейтинг","nav-settings":"Настройки",
        "search-ph":"Поиск тестов...","user-status":"Участник",
        "profile-settings":"Настройки профиля","my-certs":"Мои сертификаты","logout":"Выйти",
        "stat-completed":"Пройденные тесты","stat-avg":"Средний балл","stat-rank":"Общий рейтинг",
        "available-tests":"Доступные тесты","test-analysis":"Анализ теста",
        "btn-start":"Начать","btn-done":"Завершён","btn-wait":"Ожидание",
        "result-saved":"Результат сохранён","exam-open":"Экзамен открыт","expired":"Срок истёк",
        "btn-locked":"Заблокировано","start-from-main":"Начните с главной панели","test-open":"Тест открыт",
        "my-tests-title":"Все мои тесты","my-tests-desc":"Здесь можно управлять основными и дополнительными тестами",
        "my-tests-card":"Мои тесты","fan-settings":"Настройка предметов","fan-limit":"Можно выбрать не более 2",
        "your-grade":"Ваш класс","unit-grade":"класс","unit-min":"мин","unit-questions":"вопросов",
        "select-subject-opt":"Выберите предмет (Необязательно)","save-changes":"Сохранить изменения",
        "limit-reached":"Лимит достигнут (2/2)","no-optional":"Дополнительные предметы ещё не выбраны.<br>Выберите предмет слева.",
        "lbl-main":"Основной","lbl-optional":"Дополнительный","btn-delete":"Удалить",
        "no-tests":"Тесты для вашего класса и выбранных предметов пока недоступны.",
        "results-title":"Мои результаты и анализ",
        "stat-total":"Всего сдано","stat-avg2":"Средний показатель",
        "stat-certs":"Мои сертификаты","stat-level":"Ваш уровень",
        "growth-chart":"Динамика роста","skill-level":"Уровень знаний",
        "results-history":"История результатов",
        "all-certs":"Все сертификаты","search-subj-ph":"Поиск предмета...",
        "th-subject":"Предмет","th-date":"Дата","th-correct":"Верно/Всего",
        "th-level":"Уровень","th-result":"Результат (%)","th-action":"Действие",
        "th-fullname":"Имя Фамилия","th-school":"Школа / Класс","th-subj":"Предмет",
        "th-solved":"Решено","th-result2":"Результат","th-rank":"Место","th-score2":"Балл",
        "lvl-excellent":"Отлично","lvl-average":"Средне","lvl-poor":"Очень плохо",
        "lbl-quality":"Качество","lbl-high":"Высокое","lbl-active":"Активен",
        "skill-excellent":"Отлично","skill-average":"Средне","skill-new":"Новичок",
        "skill-pro":"Профессионал","skill-mid":"Средний","skill-beg":"Начальный",
        "btn-analysis":"Анализ","btn-cert":"Сертификат","insuff-score":"Недостаточно баллов",
        "by-main-subj":"По основному предмету",
        "no-results":"Пока нет результатов","no-data":"Пока нет данных",
        "settings-title":"Настройки системы","dark-lbl":"Ночной режим",
        "dark-desc":"Тёмный интерфейс для снижения нагрузки на глаза.",
        "lang-lbl":"Язык системы","lang-desc":"Выберите удобный язык.",
        "btn-prev":"Назад","btn-next":"Далее","btn-finish":"Завершить","btn-close":"Закрыть",
        "test-completed":"Тест завершён!","your-result":"Ваш результат:",
        "result-correct":"Верно: 0%","return-home":"На главную",
        "change-photo":"Изменить фото",
        "js-no-questions":"Вопросы по этому предмету не найдены.",
        "js-confirm-finish":"Вы уверены, что хотите завершить тест?",
        "js-answered":"Отвечено","js-not-answered":"Нет ответа","js-question":"Вопрос",
        "js-limit-reached":"Лимит достигнут (2/2)","js-save-changes":"Сохранить изменения",
        "js-blocked":"Заблокировано","js-exam-started":"Экзамен начался — удаление невозможно",
        "js-score-label":"Балл (%)","js-toast-welcome":"Добро пожаловать",
        "js-toast-body":"Сегодня отличный день для повышения ваших знаний.",
        "toast-body":"Сегодня отличный день для повышения ваших знаний.",
        "question-indicator":"Вопрос 1 / 25",
        "optional-card-desc":"Улучшайте свои знания с помощью упражнений, доступных в базе данных по этому предмету.",
        "unit-score":"балл",
        "latest-results":"Последние результаты",
        "delete-btn-text":"Удалить",
        "your-grade-label":"Ваш класс",
        "pwd-title":"Изменить пароль",
        "pwd-subtitle":"Выберите надёжный пароль для безопасности",
        "pwd-current":"Текущий пароль",
        "pwd-new":"Новый пароль",
        "pwd-confirm":"Подтвердите новый пароль",
        "pwd-save":"Сохранить пароль",
        "btn-cancel":"Отмена",
        "pwd-weak":"Очень слабый",
        "pwd-fair":"Слабый",
        "pwd-good":"Средний",
        "pwd-strong":"Сильный",
        "pwd-vstrong":"Очень сильный",
        "pwd-success":"Пароль успешно изменён!",
        "pwd-err-current":"Введите текущий пароль",
        "pwd-err-new":"Введите новый пароль",
        "pwd-err-short":"Пароль должен содержать минимум 6 символов",
        "pwd-err-match":"Пароли не совпадают",
        "pwd-err-wrong":"Текущий пароль неверен",
        "pwd-err-server":"Ошибка сервера. Попробуйте ещё раз.",
        "btn-review-errors":"Просмотр ошибок",
        "btn-close-result":"Закрыть",
        "lbl-correct":"Верно",
        "lbl-wrong":"Неверно",
        "lbl-skipped":"Пропущено",
    },
    en: {
        "nav-home":"Dashboard","nav-tests":"My Tests",
        "nav-results":"Results","nav-rating":"Rating","nav-settings":"Settings",
        "search-ph":"Search tests...","user-status":"Participant",
        "profile-settings":"Profile Settings","my-certs":"My Certificates","logout":"Sign Out",
        "stat-completed":"Completed Tests","stat-avg":"Average Score","stat-rank":"Overall Rank",
        "available-tests":"Available Tests","test-analysis":"Test Analysis",
        "btn-start":"Start","btn-done":"Completed","btn-wait":"Waiting",
        "result-saved":"Result saved","exam-open":"Exam open","expired":"Expired",
        "btn-locked":"Locked","start-from-main":"Start from the main panel","test-open":"Test open",
        "my-tests-title":"All My Tests","my-tests-desc":"Manage your main and optional tests here",
        "my-tests-card":"My Tests","fan-settings":"Subject Settings","fan-limit":"Select up to 2 subjects",
        "your-grade":"Your grade","unit-grade":"grade","unit-min":"min","unit-questions":"questions",
        "select-subject-opt":"Select subject (Optional)","save-changes":"Save Changes",
        "limit-reached":"Limit reached (2/2)","no-optional":"No optional subjects selected yet.<br>Select a subject from the left.",
        "lbl-main":"Main","lbl-optional":"Optional","btn-delete":"Delete",
        "no-tests":"No tests available for your grade and selected subjects yet.",
        "results-title":"My Results & Analysis",
        "stat-total":"Total Submitted","stat-avg2":"Average Score",
        "stat-certs":"My Certificates","stat-level":"Your Level",
        "growth-chart":"Growth Dynamics","skill-level":"Knowledge Level",
        "results-history":"Results History",
        "all-certs":"All Certificates","search-subj-ph":"Search subject...",
        "th-subject":"Subject","th-date":"Date","th-correct":"Correct/Total",
        "th-level":"Level","th-result":"Result (%)","th-action":"Action",
        "th-fullname":"Full Name","th-school":"School / Grade","th-subj":"Subject",
        "th-solved":"Solved","th-result2":"Result","th-rank":"Rank","th-score2":"Score",
        "lvl-excellent":"Excellent","lvl-average":"Average","lvl-poor":"Very Poor",
        "lbl-quality":"Quality","lbl-high":"High","lbl-active":"Active",
        "skill-excellent":"Excellent","skill-average":"Average","skill-new":"New",
        "skill-pro":"Professional","skill-mid":"Intermediate","skill-beg":"Beginner",
        "btn-analysis":"Analysis","btn-cert":"Certificate","insuff-score":"Insufficient score",
        "by-main-subj":"By main subject",
        "no-results":"No results yet","no-data":"No data yet",
        "settings-title":"System Settings","dark-lbl":"Dark Mode",
        "dark-desc":"Dark interface to reduce eye strain.",
        "lang-lbl":"System Language","lang-desc":"Choose your preferred language.",
        "btn-prev":"Previous","btn-next":"Next","btn-finish":"Finish","btn-close":"Close",
        "test-completed":"Test Completed!","your-result":"Your result:",
        "result-correct":"Correct: 0%","return-home":"Return to Home",
        "change-photo":"Change photo",
        "js-no-questions":"No questions found for this subject.",
        "js-confirm-finish":"Are you sure you want to finish the test?",
        "js-answered":"Answered","js-not-answered":"Not answered","js-question":"Question",
        "js-limit-reached":"Limit reached (2/2)","js-save-changes":"Save Changes",
        "js-blocked":"Blocked","js-exam-started":"Exam has started — cannot delete",
        "js-score-label":"Score (%)","js-toast-welcome":"Welcome",
        "js-toast-body":"Today is a great day to boost your knowledge.",
        "toast-body":"Today is a great day to boost your knowledge.",
        "question-indicator":"Question 1 / 25",
        "optional-card-desc":"Enhance your knowledge with exercises available in the database for this subject.",
        "unit-score":"points",
        "latest-results":"Latest Results",
        "delete-btn-text":"Delete",
        "your-grade-label":"Your grade",
        "pwd-title":"Change Password",
        "pwd-subtitle":"Choose a strong password for security",
        "pwd-current":"Current Password",
        "pwd-new":"New Password",
        "pwd-confirm":"Confirm New Password",
        "pwd-save":"Save Password",
        "btn-cancel":"Cancel",
        "pwd-weak":"Very Weak",
        "pwd-fair":"Weak",
        "pwd-good":"Fair",
        "pwd-strong":"Strong",
        "pwd-vstrong":"Very Strong",
        "pwd-success":"Password changed successfully!",
        "pwd-err-current":"Enter your current password",
        "pwd-err-new":"Enter a new password",
        "pwd-err-short":"Password must be at least 6 characters",
        "pwd-err-match":"Passwords do not match",
        "pwd-err-wrong":"Current password is incorrect",
        "pwd-err-server":"Server error. Please try again.",
        "btn-review-errors":"Review Errors",
        "btn-close-result":"Close",
        "lbl-correct":"Correct",
        "lbl-wrong":"Wrong",
        "lbl-skipped":"Skipped",
    }
};

function changeLanguage() {
    const lang = document.getElementById('languageSelect').value;
    localStorage.setItem('appLanguage', lang);
    applyLanguage(lang);
}

function applyLanguage(lang) {
    const dict = translations[lang];
    if (!dict) return;

    // 1. data-i18n atributli barcha elementlar
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (!dict[key]) return;
        if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
            el.placeholder = dict[key];
        } else {
            el.innerHTML = dict[key];
        }
    });

    // 2. placeholder uchun data-i18n
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (dict[key]) el.title = dict[key];
    });

    // 3. Search placeholder
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput && dict['search-ph']) searchInput.placeholder = dict['search-ph'];

    const subjectSearch = document.getElementById('subjectSearch');
    if (subjectSearch && dict['search-subj-ph']) subjectSearch.placeholder = dict['search-subj-ph'];

    // 4. Toast welcome (student nomi bilan)
    const toastWelcome = document.getElementById('toast-welcome-text');
    if (toastWelcome && dict['js-toast-welcome']) {
        const name = toastWelcome.textContent.replace(/^.+,\s*/, '').replace(/!$/, '').trim();
        toastWelcome.textContent = dict['js-toast-welcome'] + ', ' + name + '!';
    }

    // 5. Skill level label (h3#skill-label)
    const skillLabel = document.getElementById('skill-label');
    if (skillLabel) {
        const score = parseFloat(skillLabel.dataset.score || window.avgScore || 0);
        if (score >= 85) skillLabel.textContent = dict['skill-excellent'] || 'Excellent';
        else if (score >= 60) skillLabel.textContent = dict['skill-average'] || 'Average';
        else skillLabel.textContent = dict['skill-new'] || 'New';
    }

    // 6. Skill badge (Professional/Intermediate/Beginner)
    const skillBadge = document.getElementById('skill-badge');
    if (skillBadge) {
        const score = parseFloat(skillBadge.dataset.score || 0);
        if (score >= 85) skillBadge.textContent = dict['skill-pro'] || 'Professional';
        else if (score >= 60) skillBadge.textContent = dict['skill-mid'] || 'Intermediate';
        else skillBadge.textContent = dict['skill-beg'] || 'Beginner';
    }

    // 7. Question indicator
    const qi = document.getElementById('questionIndicatorText');
    if (qi && dict['js-question']) {
        const text = qi.textContent;
        const nums = text.match(/\d+\/\d+/);
        if (nums) qi.textContent = dict['js-question'] + ' ' + nums[0];
    }

    // 8. Result percent text
    const rp = document.getElementById('resultPercentText');
    if (rp && dict['result-correct']) {
        const pct = rp.textContent.match(/\d+/);
        const num = pct ? pct[0] : '0';
        const base = dict['result-correct'].replace(/\d+/, num);
        rp.textContent = base;
    }

    // 9. checkOptionalLimit tugma matnlarini yangilash
    const saveBtn = document.getElementById('save-optional-btn');
    if (saveBtn && !saveBtn.disabled) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> ' + (dict['save-changes'] || 'Save Changes');
    } else if (saveBtn && saveBtn.disabled) {
        saveBtn.innerHTML = '<i class="fas fa-lock"></i> ' + (dict['limit-reached'] || 'Limit reached (2/2)');
    }

    // 10. Delete blocked buttons
    document.querySelectorAll('.optional-delete-btn:disabled').forEach(btn => {
        btn.innerHTML = '<i class="fas fa-lock"></i> ' + (dict['js-blocked'] || 'Blocked');
        btn.title = dict['js-exam-started'] || 'Exam has started — cannot delete';
    });

    // 11. Test modal prev/next/finish buttons
    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
        prevBtn.innerHTML = '<i class="fas fa-arrow-left"></i> ' + (dict['btn-prev'] || 'Previous');
    }

    // 12. Grafiklarni qayta chizish (til o'zgarganda)
    if (typeof initCharts === 'function') {
        initCharts();
    }

    // 13. document.title
    document.title = 'Dashboard | EduOlimp';

    // 14. Til selectini sync qilish
    const sel = document.getElementById('languageSelect');
    if (sel) sel.value = lang;

    // 15b. Fan nomlarini tarjima qilish
    applySubjectTranslations(lang);

    // 15. "unit-score" - "ball" yonidagi span
    document.querySelectorAll('[data-i18n="unit-score"]').forEach(el => {
        el.textContent = ' ' + (dict['unit-score'] || 'ball');
    });

    // 16. skill-badge (Professional/Intermediate/Beginner) - agar ID orqali topilmasa class orqali
    const skillBadgeEl = document.getElementById('skill-badge');
    if (skillBadgeEl) {
        const score = parseFloat(skillBadgeEl.dataset.score || 0);
        if (score >= 85) skillBadgeEl.textContent = dict['skill-pro'] || 'Professional';
        else if (score >= 60) skillBadgeEl.textContent = dict['skill-mid'] || 'Intermediate';
        else skillBadgeEl.textContent = dict['skill-beg'] || 'Beginner';
    }

    // 17. subjectSearch placeholder
    const subjSearch = document.getElementById('subjectSearch');
    if (subjSearch && dict['search-subj-ph']) subjSearch.placeholder = dict['search-subj-ph'];

    // 18. Optional delete buttons text
    document.querySelectorAll('.optional-delete-btn:not(:disabled)').forEach(btn => {
        btn.innerHTML = '<i class="fas fa-trash"></i> ' + (dict['delete-btn-text'] || 'Delete');
    });

    // 19. checkOptionalLimit tugmasini til bo'yicha yangilash
    const saveOptBtn = document.getElementById('save-optional-btn');
    if (saveOptBtn) {
        if (saveOptBtn.disabled) {
            saveOptBtn.innerHTML = '<i class="fas fa-lock"></i> ' + (dict['limit-reached'] || 'Limit reached (2/2)');
        } else {
            saveOptBtn.innerHTML = '<i class="fas fa-save"></i> ' + (dict['save-changes'] || 'Save Changes');
        }
    }

    // 20. "My Tests" heading inside my-tests section (h3 with star icon)
    // already handled by data-i18n="my-tests-card"
}

/* =====================================================
   SERTIFIKAT YUKLAB OLISH — TOAST NOTIFICATION
   ===================================================== */
let certToastTimer = null;

function downloadCertificate(resultId, btnEl) {
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.style.opacity = '0.7';
        btnEl._origHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    showCertToast('loading', 'Tekshirilmoqda...', 'Sertifikat holati aniqlanmoqda...');

    fetch('/generate-certificate/' + resultId + '/')
        .then(function(response) {
            var contentType = response.headers.get('Content-Type') || '';
            if (response.ok && contentType.indexOf('image') !== -1) {
                // Muvaffaqiyat — PNG fayl
                return response.blob().then(function(blob) {
                    var url  = URL.createObjectURL(blob);
                    var link = document.createElement('a');
                    var disp = response.headers.get('Content-Disposition') || '';
                    var match = disp.match(/filename="(.+)"/);
                    link.download = match ? match[1] : 'sertifikat_' + resultId + '.png';
                    link.href = url;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    showCertToast('success', 'Sertifikat yuklab olindi!', 'Faylni yuklamalar papkasidan topishingiz mumkin.');
                    if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; btnEl.innerHTML = btnEl._origHtml; }
                });
            } else {
                // Xato — JSON dan message o'qish
                return response.json().then(function(data) {
                    showCertToast('error', 'Hali vaqt kelmadi', data.message || 'Sertifikat yuklab olib bolmadi.');
                    if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; btnEl.innerHTML = btnEl._origHtml; }
                });
            }
        })
        .catch(function(err) {
            showCertToast('error', 'Xatolik yuz berdi', 'Internet aloqasini tekshiring.');
            if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; btnEl.innerHTML = btnEl._origHtml; }
        });
}

function showCertToast(type, title, msg) {
    var toast    = document.getElementById('certToast');
    var icon     = document.getElementById('certToastIcon');
    var titleEl  = document.getElementById('certToastTitle');
    var msgEl    = document.getElementById('certToastMsg');
    var progress = document.getElementById('certToastProgress');

    if (!toast) return;

    var styles = {
        loading: { bg: '#eff6ff', color: '#3b82f6', icon: 'fas fa-spinner fa-spin', bar: '#3b82f6' },
        success: { bg: '#f0fdf4', color: '#10b981', icon: 'fas fa-check-circle',    bar: '#10b981' },
        error:   { bg: '#fef2f2', color: '#ef4444', icon: 'fas fa-clock',            bar: '#ef4444' }
    };
    var s = styles[type] || styles.loading;

    icon.style.background    = s.bg;
    icon.style.color         = s.color;
    icon.innerHTML           = '<i class="' + s.icon + '"></i>';
    titleEl.textContent      = title;
    msgEl.textContent        = msg;
    progress.style.background = s.bar;

    progress.style.transition = 'none';
    progress.style.width      = '100%';
    toast.style.display       = 'block';

    if (certToastTimer) clearTimeout(certToastTimer);

    if (type !== 'loading') {
        var duration = type === 'success' ? 4000 : 6000;
        setTimeout(function() {
            progress.style.transition = 'width ' + duration + 'ms linear';
            progress.style.width      = '0%';
        }, 50);
        certToastTimer = setTimeout(closeCertToast, duration);
    } else {
        progress.style.transition = 'width 1.5s ease-in-out';
        progress.style.width      = '30%';
    }
}

function closeCertToast() {
    var toast = document.getElementById('certToast');
    if (toast) {
        toast.style.opacity   = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'opacity 0.25s, transform 0.25s';
        setTimeout(function() {
            toast.style.display    = 'none';
            toast.style.opacity    = '';
            toast.style.transform  = '';
            toast.style.transition = '';
        }, 260);
    }
    if (certToastTimer) clearTimeout(certToastTimer);
}

/* =====================================================
   NATIJALAR JADVALI — QIDIRUV VA BARCHA SERTIFIKAT
   ===================================================== */

// 1. QIDIRUV — Fan nomiga qarab satrlarni filter qilish
function filterResultsTable() {
    var input = document.getElementById('subjectSearch');
    if (!input) return;
    var query = input.value.toLowerCase().trim();
    var rows  = document.querySelectorAll('#resultsTable .result-row');
    var found = 0;

    rows.forEach(function(row) {
        var subject = (row.getAttribute('data-subject') || '').toLowerCase();
        var show = !query || subject.indexOf(query) !== -1;
        row.style.display = show ? '' : 'none';
        if (show) found++;
    });

    // Bo'sh natija xabari
    var emptyMsg = document.getElementById('resultsTableEmpty');
    if (!emptyMsg) {
        emptyMsg = document.createElement('tr');
        emptyMsg.id = 'resultsTableEmpty';
        emptyMsg.innerHTML = '<td colspan="6" style="text-align:center; padding:24px; color:#94a3b8; font-size:14px;"><i class="fas fa-search" style="margin-right:8px;"></i>Fan topilmadi</td>';
        var tbody = document.querySelector('#resultsTable tbody');
        if (tbody) tbody.appendChild(emptyMsg);
    }
    emptyMsg.style.display = (found === 0 && query) ? '' : 'none';
}

// 2. BARCHA SERTIFIKATLARNI KETMA-KET YUKLAB OLISH
function downloadAllCertificates() {
    var rows = document.querySelectorAll('#resultsTable .result-row[data-cert-eligible="1"]');

    if (rows.length === 0) {
        showCertToast('error', 'Sertifikat yo\'q', '80% va undan yuqori natija yo\'q.');
        return;
    }

    // result id larni yig'ish
    var ids = [];
    rows.forEach(function(row) {
        var id = row.getAttribute('data-result-id');
        if (id) ids.push(parseInt(id));
    });

    showCertToast('loading', ids.length + ' ta sertifikat', 'Yuklab olinmoqda (1 / ' + ids.length + ')...');

    // Ketma-ket yuklab olish (har biri 800ms oraliq bilan)
    var index = 0;

    function downloadNext() {
        if (index >= ids.length) {
            showCertToast('success', 'Hammasi tayyor!', ids.length + ' ta sertifikat yuklab olindi.');
            return;
        }

        var currentId = ids[index];
        var current   = index + 1;

        // Progress xabari
        showCertToast('loading', current + ' / ' + ids.length + ' yuklanmoqda...', 'Sertifikat #' + currentId + ' tayyorlanmoqda...');

        fetch('/generate-certificate/' + currentId + '/')
            .then(function(response) {
                var contentType = response.headers.get('Content-Type') || '';
                if (response.ok && contentType.indexOf('image') !== -1) {
                    return response.blob().then(function(blob) {
                        var url  = URL.createObjectURL(blob);
                        var link = document.createElement('a');
                        var disp = response.headers.get('Content-Disposition') || '';
                        var match = disp.match(/filename="(.+)"/);
                        link.download = match ? match[1] : 'sertifikat_' + currentId + '.png';
                        link.href = url;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                    });
                } else {
                    return response.json().then(function(data) {
                        console.warn('Sertifikat #' + currentId + ' o\'tkazib yuborildi:', data.message);
                    });
                }
            })
            .catch(function(err) {
                console.warn('Sertifikat #' + currentId + ' xato:', err);
            })
            .finally(function() {
                index++;
                // Har biri orasida 900ms kutish (brauzer bloklamasligi uchun)
                setTimeout(downloadNext, 900);
            });
    }

    downloadNext();
}