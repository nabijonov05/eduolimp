// 1. GLOBAL O'ZGARUVCHILAR
let currentQuestion = 1;
let allQuestions = [];
let userAnswers = {};
let isReviewMode = false;
let timerInterval;
let activeTestId = null;

// Matnni tozalash uchun yordamchi funksiya
const cleanText = (txt) => String(txt || "").trim().toLowerCase();

document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.sidebar-nav a, .admin-nav a');

    navLinks.forEach((link) => {
        link.addEventListener('click', function(e) {
            // Agar tugmada onclick bo'lsa (masalan loadTab), klassni o'sha funksiya ichida o'zgartiramiz
            if (this.getAttribute('onclick')) return;

            e.preventDefault();
            updateActiveLink(this);

            const linkText = this.innerText.trim();
            const pageTitle = document.getElementById('page-title');
            if (pageTitle) pageTitle.innerText = linkText;
        });
    });
});


// Sidebar menyusidagi 'active' klassini yangilash uchun yordamchi funksiya

function updateActiveLink(activeElement) {
    const navLinks = document.querySelectorAll('.sidebar-nav a, .admin-nav a');
    navLinks.forEach(l => l.classList.remove('active'));
    if (activeElement) {
        activeElement.classList.add('active');
    }
}

// BO'LIMLARNI DINAMIK ALMASHTIRISH (Global scope)

function loadTab(tabName) {
    // 1. HTML-dagi barcha mavjud bo'lim ID-larini massivga yozamiz
    const sections = ['home-section', 'my-tests', 'reyting-section', 'results-section', 'settings-section'];

    // 2. Hammasini yashirish
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
        }
    });

    // 3. Tanlangan bo'limni ko'rsatish
    // Agar tabName 'home' bo'lsa 'home-section'ni, bo'lmasa 'my-tests' yoki boshqasini qidiradi
    let targetId = (tabName === 'home') ? 'home-section' : tabName;

    // Agar siz 'my-tests'ni 'my-tests-section' deb o'zgartirgan bo'lsangiz, pastdagi qatorni tekshiring
    const activeSection = document.getElementById(targetId) || document.getElementById(targetId + '-section');

    if (activeSection) {
        activeSection.style.display = 'block';

        // Animatsiya (ixtiyoriy)
        activeSection.animate([
            { opacity: 0, transform: 'translateY(5px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 200 });

        // Sahifa sarlavhasini yangilash
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            const link = document.querySelector(`[onclick*="loadTab('${tabName}')"]`);
            if (link) pageTitle.innerText = link.innerText.trim();
        }
    } else {
        console.error("Xato: " + targetId + " topilmadi!");
    }

    // 4. Sidebar 'active' klassini yangilash
    const allLinks = document.querySelectorAll('.sidebar-nav a');
    allLinks.forEach(l => l.classList.remove('active'));

    const clickedLink = document.querySelector(`[onclick*="loadTab('${tabName}')"]`);
    if (clickedLink) {
        clickedLink.classList.add('active');
    }
}

/*
BU YERDAN BOSHLAB TESTNI ISHLASH QISMIGA JAVOB BERADIGAN FUNSIYALAR JOYLASHGAN
*/
// 1. CSRF TOKEN (Django uchun)
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

// 3. TESTNI BOSHLASH
function startTest(testId, duration, subject) {
    if (!testId || testId === 'undefined') {
        alert("Xatolik: Test ID topilmadi!");
        return;
    }

    activeTestId = testId; // Global ID-ni saqlaymiz
    const url = `/get-questions/${testId}/`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.questions && data.questions.length > 0) {
                // 1. Ma'lumotlarni global o'zgaruvchilarga yuklash
                allQuestions = data.questions;
                currentQuestion = 1;
                userAnswers = {};
                isReviewMode = false;

                // 2. Modal sarlavhasini yangilash
                const modalTitle = document.getElementById('modalSubjectTitle');
                if (modalTitle) modalTitle.innerText = subject;

                // 3. Ekranni chizish va taymerni boshlash
                renderQuestion();
                startTimer(duration * 60);

                // 4. Modalni ko'rsatish
                document.getElementById('testModal').style.display = 'flex';
                document.body.style.overflow = 'hidden'; // Orqa fonni qotirish
            } else {
                alert("Ushbu fan bo'yicha savollar topilmadi.");
            }
        })
        .catch(err => console.error("Xatolik:", err));
}

// 4. NATIJALARNI TAHLIL QILISH (REVIEW)

async function reviewTest(testId, resultId) {
    try {
        isReviewMode = true;

        // TAYMERNI YASHIRISH
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) {
            timerDisplay.style.display = 'none'; // Tahlilda ko'rinmaydi
        }

        // Savollarni sessiyadan emas, bazadan (resultId orqali) olamiz
        const res = await fetch(`/get-result-details/${resultId}/`);
        const data = await res.json();

        if (data.status === 'success') {
            allQuestions = data.questions;

            // Foydalanuvchi javoblarini json_script dan olamiz
            const answersElement = document.getElementById(String(resultId));
            userAnswers = answersElement ? JSON.parse(answersElement.textContent) : {};

            isReviewMode = true;
            currentQuestion = 1;
            renderQuestion();
            document.getElementById('testModal').style.display = 'flex';
        }
    } catch (e) {
        console.error("Xatolik:", e);
    }
}
// 5. ASOSIY RENDER FUNKSIYASI (Universal)
function renderQuestion() {
    if (allQuestions.length === 0) return;
    const area = document.getElementById('questionArea');
    const q = allQuestions[currentQuestion - 1];

    // 1. Ma'lumotlarni formatlash
    let rawUserAnswer = userAnswers[currentQuestion] || userAnswers[String(currentQuestion)];
    const userSelected = cleanText(rawUserAnswer);
    const correctAnswer = cleanText(q.correct);

    // YANGI: Javob berilmaganligini aniqlash (bo'sh yoki undefined bo'lsa)
    const isSkipped = (userSelected === "" || userSelected === "undefined" || !userSelected);

    // 2. NAVIGATSIYA (Tepadagi raqamli kataklar)
    let navHtml = `<div class="question-nav-container"><div class="question-nav-scroll">`;
    for (let i = 1; i <= allQuestions.length; i++) {
        let cls = (i === currentQuestion) ? 'active' : '';

        if (isReviewMode) {
            let uA = cleanText(userAnswers[i] || userAnswers[String(i)]);
            let cA = cleanText(allQuestions[i-1].correct);

            // Agar javob umuman berilmagan bo'lsa
            if (!uA || uA === "undefined" || uA === "") {
                cls += " skipped-nav"; // CSS da qizil fon berish uchun
            } else {
                // To'g'ri yoki xatoligiga qarab klass berish
                cls += (uA === cA) ? " correct-nav" : " wrong-nav";
            }
        } else {
            if (userAnswers[i] || userAnswers[String(i)]) cls += " answered";
        }
        navHtml += `<div class="nav-box ${cls}" onclick="jumpToQuestion(${i})">${i}</div>`;
    }
    navHtml += `</div></div>`;

    // 3. VARIANTLARNI CHIZISH
    let optionsHtml = q.options.map(opt => {
        const currentOpt = cleanText(opt);
        let statusClass = "";

        if (isReviewMode) {
            if (currentOpt === correctAnswer) {
                statusClass = "correct-opt"; // To'g'ri javob doim yashil
            }
            else if (!isSkipped && currentOpt === userSelected) {
                statusClass = "wrong-opt"; // Faqat xato belgilangan bo'lsa qizil
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

    // YANGI: Savol kartasi uchun qo'shimcha klasslar
    const tagClass = (isReviewMode && isSkipped) ? "q-tag skipped-tag" : "q-tag";
    const gridClass = (isReviewMode && isSkipped) ? "options-grid skipped-grid" : "options-grid";

    area.innerHTML = `
        ${navHtml}
        <div class="question-card">
            <span class="${tagClass}">${currentQuestion}-savol ${isSkipped && isReviewMode ? '<small>(Javob berilmagan)</small>' : ''}</span>
            <p class="q-text">${q.text}</p>
            <div class="${gridClass}">${optionsHtml}</div>
        </div>`;

    updateFooter();
}

// 6. BOSHQARUV TUGMALARI
function selectOption(val) {
    if (isReviewMode) return;
    userAnswers[currentQuestion] = val;
    renderQuestion();
}

function jumpToQuestion(n) {
    currentQuestion = n;
    renderQuestion();
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
    nextBtn.innerHTML = isReviewMode ? 'Yopish' : 'Yakunlash';
    // Bu yerda finishTest(false) yoki shunchaki finishTest() deb yozing
    nextBtn.onclick = isReviewMode ? closeModal : () => finishTest(false);

    } else {
        nextBtn.innerHTML = 'Keyingi';
        nextBtn.onclick = () => changeQuestion(1);
    }

    // Progress bar va indikator
    const answeredCount = Object.keys(userAnswers).length;
    document.getElementById('questionIndicator').innerHTML = `Savol ${currentQuestion} / ${allQuestions.length} <br> <small style="color: #10b981;">Bajarildi: ${answeredCount}</small>`;
    document.getElementById('progressBar').style.width = (currentQuestion / allQuestions.length) * 100 + '%';
}

// 7. TESTNI YAKUNLASH VA SAQLASH
function finishTest(isAuto = false) {
    if (!isAuto && !confirm("Testni yakunlashni tasdiqlaysizmi?")) return;
    clearInterval(timerInterval);

    let correctCount = 0;
    allQuestions.forEach((q, index) => {
        if (userAnswers[index + 1] === q.correct) correctCount++;
    });

    const total = allQuestions.length;
    const percent = Math.round((correctCount / total) * 100);
    const subject = document.getElementById('modalSubjectTitle').innerText.trim();

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
        document.getElementById('resultScore').innerText = `${correctCount} / ${total}`;
        document.getElementById('resultPercent').innerText = `To'g'ri: ${percent}%`;
        document.getElementById('testModal').style.display = 'none';
        document.getElementById('resultModal').style.display = 'flex';
    });
}

// 8. YORDAMCHI FUNKSIYALAR
function startTimer(sec) {
    clearInterval(timerInterval);

    // Elementni bir marta tanlab olamiz (tezroq ishlashi uchun)
    const display = document.getElementById('timerDisplay');

    // Har safar yangi taymer boshlanganda rangni asliga (masalan, qora yoki ko'k) qaytarish
    display.style.color = "#1e3a8a";

    timerInterval = setInterval(() => {
        let m = Math.floor(sec / 60);
        let s = sec % 60;

        display.innerText = `${m}:${s < 10 ? '0' + s : s}`;

        // OGOHLANTIRISH: 10 soniya qolganda qizil rangga o'tish
        if (sec <= 10 && sec > 0) {
            display.style.color = "#e11d48"; // Yorqin qizil rang
            display.style.fontWeight = "bold"; // Yanada yaqqol ko'rinishi uchun
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
        // Tahlil rejimida so'rovsiz yopish
        closeModal();
    } else {
        // Test jarayonida ogohlantirish chiqarish
        finishTest();
    }
}

function closeModal() {
    document.getElementById('testModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    clearInterval(timerInterval);
}



/*
BU YERDAN BOSHLAB FOYDALANUVCHINING AVATAR QISMIGA JAVOB BERADIGAN BO"LIM
*/
function toggleUserMenu(event) {
    // Click hodisasi tarqalishini to'xtatamiz
    event.stopPropagation();

    const dropdown = document.getElementById('userDropdown');

    // Klasni almashtiramiz (toggle)
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// Sahifaning boshqa joyiga bossa yopilishi uchun
window.addEventListener('click', function(e) {
    const dropdown = document.getElementById('userDropdown');
    const profile = document.querySelector('.user-profile');

    if (dropdown && dropdown.classList.contains('active')) {
        if (!profile.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    }
});



// Sahifa to'liq yuklangandan keyin grafikni chizish
document.addEventListener('DOMContentLoaded', function() {
    const ctx = document.getElementById('growthChart');

    if (ctx && typeof Chart !== 'undefined') {
        new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: rawLabels.length > 0 ? rawLabels : ["Ma'lumot yo'q"],
                datasets: [{
                    label: 'Natija (%)',
                    data: rawScores.length > 0 ? rawScores : [0],
                    backgroundColor: '#3b82f6',
                    borderRadius: 4,
                    maxBarThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        display: true, // O'qni majburiy ko'rsatish
                        grid: { display: false },
                        offset: true,
                        min: 0,
                        max: (rawLabels.length > 5) ? rawLabels.length - 1 : 4
                    },
                    y: {
                        display: true, // O'qni majburiy ko'rsatish
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            color: '#64748b' // O'q yozuvlari rangi
                        }
                    }
                }
            }
        });
    } else {
        console.error("Chart.js yuklanmagan yoki canvas topilmadi!");
    }
});



// Menuni ochish/yopish
function toggleUserMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('userDropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

// Sichqoncha bosilganda ishlaydigan hodisa
window.addEventListener('click', function(event) {
    const dropdown = document.getElementById('userDropdown');
    const trigger = document.querySelector('.user-profile-trigger');

    // Agar bosilgan joy (event.target) menyu yoki triggerni ichida bo'lmasa
    if (!trigger.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.style.display = 'none';
    }
});

window.processPhotoUpload = function() {
    const fileInput = document.getElementById('photo-upload');
    const file = fileInput.files[0];
    if (!file) return;

    // 1. Ekranda (Live Preview) ko'rsatish
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

    // 2. Serverga (Django) yuborish qismi
    const formData = new FormData();
    formData.append('profile_photo', file);

    // CSRF tokenni olish (Django xavfsizligi uchun shart)
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
        if (!response.ok) throw new Error('Serverda xatolik yuz berdi');
        return response.json();
    })
    .then(data => {
        if (data.status === 'success') {
            console.log("Muvaffaqiyatli saqlandi:", data.url);
        }
    })
    .catch(error => {
        console.error('Yuklashda xatolik:', error);
    });
};