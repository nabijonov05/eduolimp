document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.admin-nav a');
    const sections = document.querySelectorAll('.admin-section');
    const pageTitle = document.getElementById('page-title');

    // Section ID xaritalash — data-key asosida, matndan mustaqil
    const sectionMap = {
        'dashboard': 'dashboard-section',
        'test':      'test-section',
        'users':     'user-section',
        'analytics': 'analytics-section',
        'settings':  'settings-section',
    };
    // i18n kalitlari
    const titleKeyMap = {
        'dashboard': 'nav-dashboard',
        'test':      'nav-test',
        'users':     'nav-users',
        'analytics': 'nav-analytics',
        'settings':  'nav-settings',
    };

    // --- ASOSIY FUNKSIYA: Bo'limni faollashtirish ---
    window.activateSection = function(key, subject) {
        if (!sectionMap[key]) key = 'dashboard';
        localStorage.setItem('activeAdminTab', key);

        // 1. Hamma bo'limni yashirish
        sections.forEach(s => s.style.display = 'none');

        // 2. Kerakli bo'limni ochish
        const target = document.getElementById(sectionMap[key]);
        if (target) target.style.display = 'block';

        // 3. Sarlavha — i18n kaliti orqali (tildan mustaqil)
        if (pageTitle && titleKeyMap[key]) {
            pageTitle.textContent = adminT(titleKeyMap[key]);
        }

        // 4. Sidebar — data-key orqali aktiv belgilash (tildan mustaqil)
        navLinks.forEach(l => {
            l.classList.remove('active');
            if (l.getAttribute('data-key') === key) l.classList.add('active');
        });

        // 5. Grafiklar
        if (key === 'analytics' && typeof renderAnalytics === 'function') {
            setTimeout(renderAnalytics, 150);
        }

        // 6. Test bo'limida fan avtomatik tanlansin
        if (key === 'test') {
            // URL > localStorage > hech narsa
            const activeSubject = subject || localStorage.getItem('activeSubject') || '';
            if (activeSubject) {
                const card = document.querySelector(`.subject-card[data-subject-key="${activeSubject}"]`);
                if (card) {
                    selectSubject(activeSubject, card, true);
                }
            }
        }

        // 7. Mobile — sidebarni yopish
        closeAdminSidebar();
    };

    // --- 1-QADAM: Sahifa yuklanganda holatni aniqlash ---
    const urlParams = new URLSearchParams(window.location.search);
    const urlSection = urlParams.get('section');
    const urlSubject = urlParams.get('subject');
    const savedSection = localStorage.getItem('activeAdminTab');
    const initialSection = urlSection || savedSection || 'dashboard';
    activateSection(initialSection, urlSubject || '');

    // --- 2-QADAM: Nav linklarga click — data-key ishlatiladi ---
    navLinks.forEach((link) => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const key = this.getAttribute('data-key') || 'dashboard';
            const newUrl = `${window.location.pathname}?section=${key}`;
            window.history.pushState({ section: key }, '', newUrl);
            // Test bo'limidan boshqa joyga o'tganda activeSubject ni tozalash
            if (key !== 'test') localStorage.removeItem('activeSubject');
            activateSection(key, '');
        });
    });

    // --- 3-QADAM: Brauzer orqaga/oldinga tugmasi ---
    window.addEventListener('popstate', () => {
        const params  = new URLSearchParams(window.location.search);
        const section = params.get('section') || 'dashboard';
        const subject = params.get('subject') || '';
        activateSection(section, subject);
    });
});

/* ============================================================
   MOBILE SIDEBAR — hamburger / overlay
   ============================================================ */
function toggleAdminSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('adminOverlay');
    const isOpen  = sidebar.classList.contains('mobile-open');
    if (isOpen) {
        closeAdminSidebar();
    } else {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('active');
        document.body.classList.add('sidebar-locked');
        document.body.classList.add('sidebar-open');
    }
}
function closeAdminSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('adminOverlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('sidebar-locked');
    document.body.classList.remove('sidebar-open');
}















// Fan tanlanganda sinflarni chiqarish va statusni tekshirish
function selectSubject(subjectName, element, skipHistory) {
    // 1. Kartochkalarni rangini yangilash
    document.querySelectorAll('.subject-card').forEach(card => card.classList.remove('selected'));
    element.classList.add('selected');

    // 2. Yashirin inputga fan nomini yozish
    document.getElementById('selected-subject-input').value = subjectName;

    // 3. Formani ko'rsatish
    const selectionArea = document.getElementById('class-selection-area');
    selectionArea.style.display = 'block';
    document.getElementById('selected-subject-title').innerHTML = `<i class="fas fa-graduation-cap"></i> ${subjectName} ${adminT('subj-select-title')}`;

    // 4. URL va localStorage ga saqlash
    localStorage.setItem('activeSubject', subjectName);
    if (!skipHistory) {
        const newUrl = `${window.location.pathname}?section=test&subject=${encodeURIComponent(subjectName)}`;
        window.history.pushState({ section: 'test', subject: subjectName }, '', newUrl);
    }

    // 5. BAZADAGI STATUSNI TEKSHIRISH
    [9, 10, 11].forEach(grade => {
        const statusSpan = document.getElementById(`file-name-${grade}`);
        const key = `${subjectName}_${grade}`;

        if (typeof uploadedStatus !== 'undefined' && uploadedStatus[key]) {
            statusSpan.innerText = "✅ " + adminT("file-uploaded");
            statusSpan.style.color = "#2ecc71";
            statusSpan.style.fontWeight = "bold";
            const row = document.querySelector(`.class-row[data-grade="${grade}"]`);
            if (row) {
                const lbl = row.querySelector('.upload-label');
                if (lbl) lbl.classList.add('disabled');
            }
        } else {
            statusSpan.innerText = adminT("file-not-selected");
            statusSpan.style.color = "#888";
            statusSpan.style.fontWeight = "normal";
            const row = document.querySelector(`.class-row[data-grade="${grade}"]`);
            if (row) {
                const lbl = row.querySelector('.upload-label');
                if (lbl) lbl.classList.remove('disabled');
            }
        }
    });

    // 6. Har sinf uchun serverdan rasm sonini yangilash
    [9, 10, 11].forEach(grade => {
        refreshBadgeForGrade(subjectName, grade);
    });

    // 7. Ekranni pastga surish
    setTimeout(() => {
        selectionArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// Fayl tanlanganda ko'rinishni yangilash va label bloklash
function handleFileUpload(input, targetId, labelId) {
    const fileNameDisplay = document.getElementById(targetId);
    if (input.files.length > 0) {
        fileNameDisplay.innerText = "✅ " + adminT("file-selected") + ": " + input.files[0].name;
        fileNameDisplay.style.color = "#2ecc71";
        fileNameDisplay.style.fontWeight = "bold";
        // Fayl yuklash tugmasini bloklash
        if (labelId) {
            const lbl = document.getElementById(labelId);
            if (lbl) lbl.classList.add('disabled');
        }
    }
}

// Faylni o'chirish
function removeFile(spanId, btnElement) {
    const parentRow = btnElement.closest('.class-row');
    const grade = parentRow.getAttribute('data-grade') || spanId.split('-').pop();
    const subject = document.getElementById('selected-subject-input').value;

    if (!subject || !grade) {
        alert("Fan tanlanmagan!");
        return;
    }

    if (confirm(`${subject} fanining ${grade}-sinf testini o'chirmoqchimisiz?`)) {
        const formData = new FormData();
        formData.append('subject', subject);
        formData.append('grade', grade);
        formData.append('csrfmiddlewaretoken', document.querySelector('[name=csrfmiddlewaretoken]').value);

        fetch('/delete-test-file/', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const fileNameDisplay = document.getElementById(spanId);
                fileNameDisplay.innerText = "Fayl tanlanmagan";
                fileNameDisplay.style.color = "#888";
                fileNameDisplay.style.fontWeight = "normal";

                const fileInput = parentRow.querySelector('input[type="file"]');
                if (fileInput) fileInput.value = "";

                // Fayl o'chirilgandan keyin upload tugmasini qayta ochish
                const lbl = parentRow.querySelector('.upload-label');
                if (lbl) lbl.classList.remove('disabled');

                if (typeof uploadedStatus !== 'undefined') {
                    uploadedStatus[`${subject}_${grade}`] = false;
                }
            } else {
                alert("Xatolik: Fayl o'chirilmadi.");
            }
        })
        .catch(err => console.error("Xato:", err));
    }
}













function toggleResults(id) {
    const target = document.getElementById(id);
    const allLists = document.querySelectorAll('[id^="folder-"]');

    allLists.forEach(list => {
        if (list.id !== id) list.style.display = 'none';
    });

    if (target.style.display === "none") {
        target.style.display = "block";
    } else {
        target.style.display = "none";
    }
}




// Global diagnostika
console.log("1. admin.js yuklandi.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("2. DOM to'liq yuklandi.");

    // Ma'lumotlar borligini tekshirish (Diagnostika)
    if (window.eduOlimpData) {
        console.log("3. window.eduOlimpData topildi:", window.eduOlimpData);
    } else {
        console.error("XATO: window.eduOlimpData topilmadi! Views.py dan ma'lumot kelmayapti.");
    }

    if (typeof uploadedStatus !== 'undefined') {
        console.log("4. uploadedStatus (json_status) topildi:", uploadedStatus);
    } else {
        console.error("XATO: uploadedStatus (json_status) topilmadi!");
    }

    const navLinks = document.querySelectorAll('.admin-nav a');
    const pageTitle = document.getElementById('page-title');

    navLinks.forEach((link) => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            const linkText = this.innerText.trim();
            console.log(`5. Menyu bosildi: ${linkText}`);

            // Aktiv klassni boshqarish
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            pageTitle.innerText = linkText;

            // Bo'limlarni ko'rsatish mantiqi
            if (linkText === "Umumiy nazorat") {
                showSection('dashboard-section');
            } else if (linkText === "Yangi test qo'shish") {
                showSection('test-section');
            } else if (linkText === "Foydalanuvchilar") {
                showSection('user-section');
            } else if (linkText === "Analitika") {
                showSection('analytics-section');
                // DIQQAT: Bo'lim ko'rinishi uchun biroz kutib, keyin grafik chiziladi
                console.log("6. Analitika bo'limi ochilmoqda, grafik chizish buyrug'i berildi.");
                setTimeout(renderAnalytics, 150);
            } else if (linkText === "Tizim sozlamalari") {
                showSection('settings-section');
            }
        });
    });
});

function showSection(id) {
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });
    const target = document.getElementById(id);
    if (target) {
        target.style.display = 'block';
    }
}

// Pluginni ro'yxatdan o'tkazamiz
Chart.register(ChartDataLabels);

let charts = {}; // Grafik obyektlarini saqlash uchun

function renderAnalytics() {
    // 1. Ma'lumotlar borligini tekshirish
    if (!window.eduOlimpData) {
        console.error("Ma'lumotlar topilmadi!");
        return;
    }

    const ctxSubject = document.getElementById('subjectChart');
    const ctxGrade = document.getElementById('gradeChart');

    // 2. Fanlar grafigi (Bar Chart)
    if (ctxSubject) {
        if (charts.subject) charts.subject.destroy();

        // Ma'lumotlarni yaxlitlab olamiz
        const roundedScores = window.eduOlimpData.subjectScores.map(s => Math.round(s));

        charts.subject = new Chart(ctxSubject.getContext('2d'), {
            type: 'bar',
            data: {
                labels: window.eduOlimpData.subjectLabels,
                datasets: [{
                    label: "O'rtacha Ball (%)",
                    data: roundedScores, // Yaxlitlangan ma'lumot
                    backgroundColor: '#4e73df',
                    borderRadius: 5,
                    barPercentage: 0.3, // Ingichka ustunlar
                    maxBarThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    // Agar plugin bo'lsa foiz chiqaradi, bo'lmasa xato bermaydi
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: (val) => Math.round(val) + '%',
                        color: '#4e73df',
                        font: { weight: 'bold' }
                    }
                },
                scales: {
                    y: { beginAtZero: true, max: 110 }
                }
            }
        });
    }

    // 3. Sinflar grafigi (Doughnut Chart)
    if (ctxGrade) {
        if (charts.grade) charts.grade.destroy();

        charts.grade = new Chart(ctxGrade.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: window.eduOlimpData.gradeLabels,
                datasets: [{
                    data: window.eduOlimpData.gradeCounts,
                    backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    datalabels: {
                        color: '#fff',
                        formatter: (value, ctx) => {
                            let sum = 0;
                            let dataArr = ctx.chart.data.datasets[0].data;
                            dataArr.map(data => { sum += data; });
                            return Math.round(value * 100 / sum) + "%";
                        }
                    }
                }
            }
        });
    }
}













// O'quvchilarni jonli qidirish (Real-time search)
document.getElementById('studentSearch')?.addEventListener('keyup', function() {
    let searchValue = this.value.toLowerCase();
    let tableRows = document.querySelectorAll('#user-section tbody tr');

    tableRows.forEach(row => {
        // F.I.SH ustunini (birinchi td) tekshiramiz
        let fullName = row.querySelector('td:first-child').innerText.toLowerCase();

        if (fullName.includes(searchValue)) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
});

/* ============================================================
   SETTINGS — ADMIN PANEL FUNKSIYALARI
   ============================================================ */

// --- Dark mode ---
function toggleAdminDark(on) {
    document.body.classList.toggle('admin-dark', on);
    localStorage.setItem('adminDark', on ? '1' : '0');
}

// --- Parol ko'rsatish/yashirish ---
function toggleAdminPwd(btn) {
    const input = btn.previousElementSibling;
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// --- Parol kuchi ---
function adminPwdStrength(val) {
    const bar  = document.getElementById('admin-strength-fill');
    const text = document.getElementById('admin-strength-text');
    if (!bar) return;
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const levels = [
        { w:'20%', c:'#ef4444', l: adminT('pwd-very-weak') },
        { w:'40%', c:'#f97316', l: adminT('pwd-weak') },
        { w:'60%', c:'#eab308', l: adminT('pwd-medium') },
        { w:'80%', c:'#22c55e', l: adminT('pwd-strong') },
        { w:'100%',c:'#10b981', l: adminT('pwd-very-strong') },
    ];
    const lv = levels[Math.min(score - 1, 4)];
    if (!val) { bar.style.width = '0'; text.textContent = ''; return; }
    if (lv) {
        bar.style.width = lv.w;
        bar.style.background = lv.c;
        text.textContent = lv.l;
        text.style.color = lv.c;
    }
}

/* ============================================================
   ADMIN i18n — To'liq tarjima tizimi
   ============================================================ */

/* ================================================================
   DASHBOARD FAN NOMLARI TARJIMASI
   subject-key = Django dan keladigan asl nom (uz)
   ================================================================ */
const SUBJECT_NAME_MAP = {
    uz: {
        'Matematika': 'Matematika', 'Fizika': 'Fizika', 'Ona tili': "Ona tili",
        'Ingliz tili': 'Ingliz tili', 'Geografiya': 'Geografiya',
        'Tarix': 'Tarix', 'Rus tili': 'Rus tili',
        'Ona-tili': "Ona tili", 'Ingliz-tili': 'Ingliz tili',
    },
    ru: {
        'Matematika': 'Математика', 'Fizika': 'Физика', 'Ona tili': 'Родной язык',
        'Ingliz tili': 'Английский язык', 'Geografiya': 'География',
        'Tarix': 'История', 'Rus tili': 'Русский язык',
        'Ona-tili': 'Родной язык', 'Ingliz-tili': 'Английский язык',
    },
    en: {
        'Matematika': 'Mathematics', 'Fizika': 'Physics', 'Ona tili': 'Native Language',
        'Ingliz tili': 'English', 'Geografiya': 'Geography',
        'Tarix': 'History', 'Rus tili': 'Russian',
        'Ona-tili': 'Native Language', 'Ingliz-tili': 'English',
    }
};

function applySubjectNames(lang) {
    const map = SUBJECT_NAME_MAP[lang] || SUBJECT_NAME_MAP.uz;
    document.querySelectorAll('.dash-subject-name[data-subject-key]').forEach(el => {
        const key = el.getAttribute('data-subject-key');
        if (map[key]) el.textContent = map[key];
    });
}

const ADMIN_TRANSLATIONS = {
    uz: {
        // Sidebar
        'nav-dashboard':        "Umumiy nazorat",
        'nav-test':             "Yangi test qo'shish",
        'nav-users':            "Foydalanuvchilar",
        'nav-analytics':        "Analitika",
        'nav-settings':         "Tizim sozlamalari",
        // Top bar
        'admin-label':          "Super Admin",
        // Dashboard
        'dash-heading':         "Fanlar bo'yicha kengaytirilgan tahlil",
        'dash-participants':    "ta ishtirokchi",
        'dash-grade-results':   "sinf natijalari",
        'dash-excel-download':  "Excel yuklab olish",
        'th-rating':            "Reyting",
        'th-fullname':          "F.I.SH",
        'th-grade':             "Sinf",
        'th-school':            "Maktab",
        'th-result':            "Natija (To'g'ri/Jami)",
        'th-score':             "Ball (%)",
        'th-action':            "Amal",
        'badge-place':          "o'rin",
        'nodata-title':         "Natijalar hozircha mavjud emas",
        'nodata-desc':          "Olympiada yakunlangach, barcha natijalar fanlar kesimida shu yerda jamlanadi.",
        // Analytics
        'analytics-heading':       "Tizim Analitikasi",
        'analytics-subject-chart': "Fanlar bo'yicha o'rtacha o'zlashtirish (%)",
        'analytics-grade-chart':   "Sinflar kesimida ishtirokchilar",
        // Test section
        'test-heading':         "Yangi test materiallarini yuklash",
        'subj-matematika':      "Matematika",
        'subj-fizika':          "Fizika",
        'subj-ona-tili':        "Ona tili",
        'subj-ingliz-tili':     "Ingliz tili",
        'subj-geografiya':      "Geografiya",
        'subj-tarix':           "Tarix",
        'subj-rus-tili':        "Rus tili",
        'test-grade-label':     "sinf uchun test:",
        'btn-choose-file':      "Fayl tanlash",
        'file-not-selected':    "Fayl tanlanmagan",
        'btn-save-all-files':   "Barcha fayllarni saqlash",
        // Users
        'user-heading':         "Yangi o'quvchi qo'shish",
        'ph-firstname':         "Ism",
        'ph-lastname':          "Familiya",
        'ph-middlename':        "Otasining ismi",
        'ph-email':             "Email manzili",
        'opt-school':           "Maktabni tanlang",
        'opt-grade':            "Sinfni tanlang",
        'opt-subject':          "Fanni tanlang",
        'title-exam-date':      "Olimpiada kuni",
        'title-exam-time':      "Olimpiada vaqti",
        'btn-add-student':      "Tizimga qo'shish",
        'user-list-heading':    "Ro'yxatga olingan o'quvchilar",
        'ph-search-student':    "Ism yoki familiya bo'yicha qidirish...",
        'btn-export-students':  "Ro'yxatni yuklab olish",
        'th-grade-school':      "Sinf & Maktab",
        'th-selected-subject':  "Tanlangan Fan",
        'th-exam-date':         "Imtihon Sanasi",
        'th-exam-time':         "Vaqti",
        'th-status':            "Amal (Holat)",
        'no-students':          "Hozircha o'quvchilar qo'shilmagan",
        'btn-save':             "Saqlash",
        // Settings
        'stng-test-title':      "Test sozlamalari",
        'stng-test-desc':       "Olimpiada parametrlari va vaqtini boshqaring",
        'stng-q-count':         "Savollar soni",
        'stng-time':            "Test vaqti",
        'stng-points':          "Har savol uchun ball",
        'stng-sec-title':       "Admin xavfsizligi",
        'stng-sec-desc':        "Admin hisobining parolini yangilang",
        'stng-cur-pwd':         "Joriy parol",
        'stng-new-pwd':         "Yangi parol",
        'ph-new-pwd':           "Yangi parol",
        'stng-confirm-pwd':     "Tasdiqlash",
        'ph-confirm-pwd':       "Qayta kiriting",
        'btn-update-pwd':       "Parolni yangilash",
        'stng-ui-title':        "Interfeys sozlamalari",
        'stng-ui-desc':         "Ko'rinish va til parametrlarini sozlang",
        'stng-dark-title':      "Tungi rejim",
        'stng-dark-sub':        "Qorong'i interfeys",
        'stng-lang-label':      "Interfeys tili",
        'stng-prof-title':      "Admin profili",
        'stng-prof-desc':       "Tizimga kirish ma'lumotlari",
        'stng-prof-role':       "Administrator",
        'stng-active-session':  "Faol sessiya",
        'stng-username-label':  "Username",
        'stng-last-login':      "Oxirgi kirish",
        'stng-email-label':     "Email",
        // Confirm dialogs
        'confirm-delete-result':  "Haqiqatdan ham bu natijani o'chirmoqchimisiz?",
        'unit-ta':      "ta",
        'unit-tadan':   "tadan",
        'unit-sinf':    "sinf",
        'confirm-delete-student': "O'quvchini o'chirishni tasdiqlaysizmi?",
        // Password strength
        'pwd-very-weak':  "Juda zaif",
        'pwd-weak':       "Zaif",
        'pwd-medium':     "O'rtacha",
        'pwd-strong':     "Kuchli",
        'pwd-very-strong':"Juda kuchli",
        // username save msg
        'username-saved': "✓ Saqlandi",
        'username-empty': "Username bo'sh bo'lmasin",
        'server-error':       "Server xatosi",
        'edit-modal-title': "O'quvchi ma'lumotlarini tahrirlash",
        'btn-cancel': "Bekor qilish",
        'edit-saving': "Saqlanmoqda...",
        'edit-saved': "✓ Saqlandi",
        'edit-error': "Xatolik yuz berdi",
        'th-edit': "Tahrir",
        'subj-select-title':  "fani bo'yicha sinflarni tanlang:",
        'file-uploaded':      "Tizimga fayl yuklandi",
        'file-selected':      "Tanlandi",
    },
    ru: {
        'nav-dashboard':        "Общий контроль",
        'nav-test':             "Добавить тест",
        'nav-users':            "Пользователи",
        'nav-analytics':        "Аналитика",
        'nav-settings':         "Настройки системы",
        'admin-label':          "Супер Админ",
        'dash-heading':         "Расширенный анализ по предметам",
        'dash-participants':    "участников",
        'dash-grade-results':   "класс — результаты",
        'dash-excel-download':  "Скачать Excel",
        'th-rating':            "Рейтинг",
        'th-fullname':          "Ф.И.О",
        'th-grade':             "Класс",
        'th-school':            "Школа",
        'th-result':            "Результат (Верно/Всего)",
        'th-score':             "Балл (%)",
        'th-action':            "Действие",
        'badge-place':          "-место",
        'nodata-title':         "Результатов пока нет",
        'nodata-desc':          "После завершения олимпиады все результаты будут собраны здесь по предметам.",
        'analytics-heading':       "Системная аналитика",
        'analytics-subject-chart': "Средняя успеваемость по предметам (%)",
        'analytics-grade-chart':   "Участники по классам",
        'test-heading':         "Загрузить новые тестовые материалы",
        'subj-matematika':      "Математика",
        'subj-fizika':          "Физика",
        'subj-ona-tili':        "Родной язык",
        'subj-ingliz-tili':     "Английский язык",
        'subj-geografiya':      "География",
        'subj-tarix':           "История",
        'subj-rus-tili':        "Русский язык",
        'test-grade-label':     "класс — тест:",
        'btn-choose-file':      "Выбрать файл",
        'file-not-selected':    "Файл не выбран",
        'btn-save-all-files':   "Сохранить все файлы",
        'user-heading':         "Добавить нового ученика",
        'ph-firstname':         "Имя",
        'ph-lastname':          "Фамилия",
        'ph-middlename':        "Отчество",
        'ph-email':             "Email адрес",
        'opt-school':           "Выберите школу",
        'opt-grade':            "Выберите класс",
        'opt-subject':          "Выберите предмет",
        'title-exam-date':      "Дата олимпиады",
        'title-exam-time':      "Время олимпиады",
        'btn-add-student':      "Добавить в систему",
        'user-list-heading':    "Зарегистрированные ученики",
        'ph-search-student':    "Поиск по имени или фамилии...",
        'btn-export-students':  "Скачать список",
        'th-grade-school':      "Класс & Школа",
        'th-selected-subject':  "Выбранный предмет",
        'th-exam-date':         "Дата экзамена",
        'th-exam-time':         "Время",
        'th-status':            "Действие (Статус)",
        'no-students':          "Ученики ещё не добавлены",
        'btn-save':             "Сохранить",
        'stng-test-title':      "Настройки теста",
        'stng-test-desc':       "Управляйте параметрами и временем олимпиады",
        'stng-q-count':         "Количество вопросов",
        'stng-time':            "Время теста",
        'stng-points':          "Баллов за вопрос",
        'stng-sec-title':       "Безопасность администратора",
        'stng-sec-desc':        "Обновите пароль администратора",
        'stng-cur-pwd':         "Текущий пароль",
        'stng-new-pwd':         "Новый пароль",
        'ph-new-pwd':           "Новый пароль",
        'stng-confirm-pwd':     "Подтверждение",
        'ph-confirm-pwd':       "Введите повторно",
        'btn-update-pwd':       "Обновить пароль",
        'stng-ui-title':        "Настройки интерфейса",
        'stng-ui-desc':         "Настройте параметры отображения и языка",
        'stng-dark-title':      "Ночной режим",
        'stng-dark-sub':        "Тёмный интерфейс",
        'stng-lang-label':      "Язык интерфейса",
        'stng-prof-title':      "Профиль администратора",
        'stng-prof-desc':       "Данные для входа в систему",
        'stng-prof-role':       "Администратор",
        'stng-active-session':  "Активная сессия",
        'stng-username-label':  "Имя пользователя",
        'stng-last-login':      "Последний вход",
        'stng-email-label':     "Email",
        'confirm-delete-result':  "Вы действительно хотите удалить этот результат?",
        'unit-ta':      "шт.",
        'unit-tadan':   "из",
        'unit-sinf':    "класс",
        'confirm-delete-student': "Подтверждаете удаление ученика?",
        'pwd-very-weak':  "Очень слабый",
        'pwd-weak':       "Слабый",
        'pwd-medium':     "Средний",
        'pwd-strong':     "Сильный",
        'pwd-very-strong':"Очень сильный",
        'username-saved': "✓ Сохранено",
        'username-empty': "Имя пользователя не может быть пустым",
        'server-error':       "Ошибка сервера",
        'edit-modal-title': "Редактировать данные ученика",
        'btn-cancel': "Отмена",
        'edit-saving': "Сохранение...",
        'edit-saved': "✓ Сохранено",
        'edit-error': "Произошла ошибка",
        'th-edit': "Правка",
        'subj-select-title':  "— выберите классы:",
        'file-uploaded':      "Файл загружен в систему",
        'file-selected':      "Выбран",
    },
    en: {
        'nav-dashboard':        "Dashboard",
        'nav-test':             "Add New Test",
        'nav-users':            "Users",
        'nav-analytics':        "Analytics",
        'nav-settings':         "System Settings",
        'admin-label':          "Super Admin",
        'dash-heading':         "Extended Analysis by Subject",
        'dash-participants':    "participants",
        'dash-grade-results':   "grade results",
        'dash-excel-download':  "Download Excel",
        'th-rating':            "Rating",
        'th-fullname':          "Full Name",
        'th-grade':             "Grade",
        'th-school':            "School",
        'th-result':            "Result (Correct/Total)",
        'th-score':             "Score (%)",
        'th-action':            "Action",
        'badge-place':          "th place",
        'nodata-title':         "No results yet",
        'nodata-desc':          "Once the olympiad is over, all results will be collected here by subject.",
        'analytics-heading':       "System Analytics",
        'analytics-subject-chart': "Average performance by subject (%)",
        'analytics-grade-chart':   "Participants by grade",
        'test-heading':         "Upload New Test Materials",
        'subj-matematika':      "Mathematics",
        'subj-fizika':          "Physics",
        'subj-ona-tili':        "Native Language",
        'subj-ingliz-tili':     "English",
        'subj-geografiya':      "Geography",
        'subj-tarix':           "History",
        'subj-rus-tili':        "Russian",
        'test-grade-label':     "grade test:",
        'btn-choose-file':      "Choose File",
        'file-not-selected':    "No file selected",
        'btn-save-all-files':   "Save All Files",
        'user-heading':         "Add New Student",
        'ph-firstname':         "First Name",
        'ph-lastname':          "Last Name",
        'ph-middlename':        "Middle Name",
        'ph-email':             "Email Address",
        'opt-school':           "Select School",
        'opt-grade':            "Select Grade",
        'opt-subject':          "Select Subject",
        'title-exam-date':      "Olympiad Date",
        'title-exam-time':      "Olympiad Time",
        'btn-add-student':      "Add to System",
        'user-list-heading':    "Registered Students",
        'ph-search-student':    "Search by name or surname...",
        'btn-export-students':  "Download List",
        'th-grade-school':      "Grade & School",
        'th-selected-subject':  "Selected Subject",
        'th-exam-date':         "Exam Date",
        'th-exam-time':         "Time",
        'th-status':            "Action (Status)",
        'no-students':          "No students added yet",
        'btn-save':             "Save",
        'stng-test-title':      "Test Settings",
        'stng-test-desc':       "Manage olympiad parameters and timing",
        'stng-q-count':         "Number of Questions",
        'stng-time':            "Test Duration",
        'stng-points':          "Points per Question",
        'stng-sec-title':       "Admin Security",
        'stng-sec-desc':        "Update the admin account password",
        'stng-cur-pwd':         "Current Password",
        'stng-new-pwd':         "New Password",
        'ph-new-pwd':           "New password",
        'stng-confirm-pwd':     "Confirm",
        'ph-confirm-pwd':       "Re-enter password",
        'btn-update-pwd':       "Update Password",
        'stng-ui-title':        "Interface Settings",
        'stng-ui-desc':         "Configure display and language parameters",
        'stng-dark-title':      "Night Mode",
        'stng-dark-sub':        "Dark interface",
        'stng-lang-label':      "Interface Language",
        'stng-prof-title':      "Admin Profile",
        'stng-prof-desc':       "System login credentials",
        'stng-prof-role':       "Administrator",
        'stng-active-session':  "Active Session",
        'stng-username-label':  "Username",
        'stng-last-login':      "Last Login",
        'stng-email-label':     "Email",
        'confirm-delete-result':  "Are you sure you want to delete this result?",
        'unit-ta':      "",
        'unit-tadan':   "/",
        'unit-sinf':    "grade",
        'confirm-delete-student': "Confirm student deletion?",
        'pwd-very-weak':  "Very Weak",
        'pwd-weak':       "Weak",
        'pwd-medium':     "Medium",
        'pwd-strong':     "Strong",
        'pwd-very-strong':"Very Strong",
        'username-saved': "✓ Saved",
        'username-empty': "Username cannot be empty",
        'server-error':       "Server error",
        'edit-modal-title': "Edit Student Data",
        'btn-cancel': "Cancel",
        'edit-saving': "Saving...",
        'edit-saved': "✓ Saved",
        'edit-error': "An error occurred",
        'th-edit': "Edit",
        'subj-select-title':  "— select grades:",
        'file-uploaded':      "File uploaded",
        'file-selected':      "Selected",
    }
};

let _adminLang = 'uz';

function adminT(key) {
    return (ADMIN_TRANSLATIONS[_adminLang] || ADMIN_TRANSLATIONS.uz)[key] || key;
}

function applyAdminLang(lang) {
    _adminLang = lang;
    const tr = ADMIN_TRANSLATIONS[lang] || ADMIN_TRANSLATIONS.uz;

    // Dashboard fan nomlarini tarjima qilish
    applySubjectNames(lang);

    // data-i18n atributli elementlar
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (tr[key] !== undefined) el.textContent = tr[key];
    });

    // placeholder-i18n
    document.querySelectorAll('[placeholder-i18n]').forEach(el => {
        const key = el.getAttribute('placeholder-i18n');
        if (tr[key] !== undefined) el.placeholder = tr[key];
    });

    // title-i18n
    document.querySelectorAll('[title-i18n]').forEach(el => {
        const key = el.getAttribute('title-i18n');
        if (tr[key] !== undefined) el.title = tr[key];
    });

    // page-title ni faol nav link data-key orqali yangilash
    const activeLink = document.querySelector('.admin-nav a.active');
    const activeKey  = activeLink ? activeLink.getAttribute('data-key') : 'dashboard';
    const titleKeyMapLocal = {
        'dashboard': 'nav-dashboard', 'test': 'nav-test', 'users': 'nav-users',
        'analytics': 'nav-analytics', 'settings': 'nav-settings',
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl && titleKeyMapLocal[activeKey]) titleEl.textContent = tr[titleKeyMapLocal[activeKey]] || titleEl.textContent;

    // file-status spanlarini yangilash (selectSubject innerText bilan yozadi,
    // shuning uchun alohida yangilaymiz)
    ['9','10','11'].forEach(g => {
        const sp = document.getElementById('file-name-' + g);
        if (!sp) return;
        const txt = sp.textContent.trim();
        // Faqat "fayl tanlanmagan" / "file not selected" matnlarini yangilaymiz,
        // yuklangan yoki tanlangan fayllarni emas
        const isNotSelected = Object.values(ADMIN_TRANSLATIONS).some(t =>
            t['file-not-selected'] && txt === t['file-not-selected']
        );
        if (isNotSelected || txt === '') {
            sp.textContent = tr['file-not-selected'] || txt;
        }
    });

    // selected-subject-title (agar ochiq bo'lsa)
    const subjTitleEl = document.getElementById('selected-subject-title');
    if (subjTitleEl && subjTitleEl.innerHTML.includes('fa-graduation-cap')) {
        const currentSubj = document.getElementById('selected-subject-input')?.value;
        if (currentSubj) {
            subjTitleEl.innerHTML = `<i class="fas fa-graduation-cap"></i> ${currentSubj} ${adminT('subj-select-title')}`;
        }
    }
}

function setAdminLang(lang, btn) {
    document.querySelectorAll('.stng-lang-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    localStorage.setItem('adminLang', lang);
    applyAdminLang(lang);
}

// --- Username yangilash (AJAX) ---
async function updateAdminUsername() {
    const input = document.getElementById('admin-username-input');
    const msg = document.getElementById('username-msg');
    const newUsername = input.value.trim();
    if (!newUsername) { showUsernameMsg(adminT('username-empty'), false); return; }

    try {
        const res = await fetch('/admin-update-username/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
            body: JSON.stringify({ username: newUsername })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showUsernameMsg(adminT('username-saved'), true);
            document.querySelector('.stng-profile-name').textContent = newUsername;
        } else {
            showUsernameMsg(data.message || adminT('server-error'), false);
        }
    } catch(e) {
        showUsernameMsg(adminT('server-error'), false);
    }
}

function showUsernameMsg(text, ok) {
    const msg = document.getElementById('username-msg');
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok ? '#10b981' : '#ef4444';
    setTimeout(() => { msg.textContent = ''; }, 3000);
}

function getCsrfToken() {
    const cookie = document.cookie.split(';').find(c => c.trim().startsWith('csrftoken='));
    return cookie ? cookie.split('=')[1] : '';
}

// --- Sahifa yuklanganda holatni tiklash ---
document.addEventListener('DOMContentLoaded', () => {
    // Dark mode
    if (localStorage.getItem('adminDark') === '1') {
        document.body.classList.add('admin-dark');
        const toggle = document.getElementById('admin-dark-toggle');
        if (toggle) toggle.checked = true;
    }
    // Til — applyAdminLang activateSection dan KEYIN chaqiriladi
    // (page-title to'g'ri til bilan ko'rinishi uchun)
    const savedLang = localStorage.getItem('adminLang') || 'uz';
    const langBtn = document.getElementById('lang-' + savedLang);
    if (langBtn) {
        document.querySelectorAll('.stng-lang-btn').forEach(b => b.classList.remove('active'));
        langBtn.classList.add('active');
    }
    applyAdminLang(savedLang);
    // page-title ni to'g'ri til bilan yangilash
    const ptEl = document.getElementById('page-title');
    const ptKey = document.querySelector('.admin-nav a.active')?.getAttribute('data-key') || 'dashboard';
    if (ptEl) ptEl.textContent = adminT('nav-' + ptKey);
    // Messages auto-hide
    setTimeout(() => {
        const msgs = document.getElementById('settings-messages');
        if (msgs) msgs.style.opacity = '0', msgs.style.transition = '0.5s', setTimeout(() => msgs.remove(), 500);
    }, 5000);
});
/* ================================================================
   EDIT STUDENT MODAL
   ================================================================ */
/* ================================================================
   EDIT STUDENT MODAL — TO'LIQ ISHLAYDIGAN VERSIYA
   ================================================================ */

// Edit tugma bosilganda — data-* dan o'qiydi
function handleEditClick(e, btn) {
    e.stopPropagation();
    e.preventDefault();

    var modal = document.getElementById('editStudentModal');
    if (!modal) { console.error('editStudentModal topilmadi!'); return; }

    // Maydonlarni to'ldirish
    document.getElementById('edit-student-id').value  = btn.dataset.id     || '';
    document.getElementById('edit-first-name').value  = btn.dataset.firstname  || '';
    document.getElementById('edit-last-name').value   = btn.dataset.lastname   || '';
    document.getElementById('edit-middle-name').value = btn.dataset.middlename || '';
    document.getElementById('edit-email').value       = btn.dataset.email      || '';
    document.getElementById('edit-exam-date').value   = btn.dataset.examdate   || '';
    document.getElementById('edit-exam-time').value   = btn.dataset.examtime   || '';

    _setEditSelect('edit-school',  btn.dataset.school   || '');
    _setEditSelect('edit-grade',   btn.dataset.grade    || '');
    _setEditSelect('edit-subject', btn.dataset.subject  || '');

    // Xabarni tozalash
    var msg = document.getElementById('edit-msg');
    if (msg) { msg.textContent = ''; msg.className = 'edit-msg'; }

    // Modalni ko'rsatish
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    applyAdminLang(_adminLang);
}

// Select qiymat o'rnatish
function _setEditSelect(id, val) {
    var sel = document.getElementById(id);
    if (!sel || !val) return;
    for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === String(val)) {
            sel.selectedIndex = i;
            return;
        }
    }
}

// Modalni yopish
function closeEditModal() {
    var modal = document.getElementById('editStudentModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Overlay fonga bosish — yopish
// (window load da bir marta bog'lanadi)
window.addEventListener('load', function() {
    var overlay = document.getElementById('editStudentModal');
    if (!overlay) return;

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeEditModal();
    });
});

// ESC bilan yopish
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        var modal = document.getElementById('editStudentModal');
        if (modal && modal.classList.contains('active')) closeEditModal();
    }
});

// openEditModal — eski chaqiruvlar uchun saqlanadi (updateStudentRow ishlatadi)
function openEditModal(id, fn, ln, mn, email, school, grade, subject, examDate, examTime) {
    var fakBtn = {
        dataset: {
            id: id, firstname: fn, lastname: ln, middlename: mn,
            email: email, school: school, grade: grade,
            subject: subject, examdate: examDate, examtime: examTime
        }
    };
    handleEditClick({ stopPropagation: function(){}, preventDefault: function(){} }, fakBtn);
}

function setSelectVal(id, val) { _setEditSelect(id, val); }

async function saveEditStudent() {
    const id  = document.getElementById('edit-student-id').value;
    const btn = document.getElementById('edit-save-btn');
    const msg = document.getElementById('edit-msg');

    const payload = {
        first_name:  document.getElementById('edit-first-name').value.trim(),
        last_name:   document.getElementById('edit-last-name').value.trim(),
        middle_name: document.getElementById('edit-middle-name').value.trim(),
        email:       document.getElementById('edit-email').value.trim(),
        school:      document.getElementById('edit-school').value,
        grade:       document.getElementById('edit-grade').value,
        subject:     document.getElementById('edit-subject').value,
        exam_date:   document.getElementById('edit-exam-date').value,
        exam_time:   document.getElementById('edit-exam-time').value,
    };

    // Validatsiya
    if (!payload.first_name || !payload.last_name || !payload.email) {
        msg.textContent = adminT('edit-error') + ': Ism, Familiya, Email majburiy';
        msg.className = 'edit-msg error';
        return;
    }

    btn.disabled = true;
    btn.querySelector('span').textContent = adminT('edit-saving');
    msg.textContent = '';

    try {
        const res = await fetch(`/edit-student/${id}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === 'success') {
            msg.textContent = adminT('edit-saved');
            msg.className = 'edit-msg success';
            // Jadval qatorini yangilash
            updateStudentRow(data.student);
            setTimeout(() => closeEditModal(), 1000);
        } else {
            msg.textContent = data.message || adminT('edit-error');
            msg.className = 'edit-msg error';
        }
    } catch(e) {
        msg.textContent = adminT('edit-error');
        msg.className = 'edit-msg error';
    } finally {
        btn.disabled = false;
        btn.querySelector('span').textContent = adminT('btn-save');
    }
}

function updateStudentRow(s) {
    // O'quvchi qatorini topib ma'lumotlarini yangilash
    // Edit tugmasi onclick argument orqali topamiz
    const editBtns = document.querySelectorAll('.edit-student-btn');
    editBtns.forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        if (onclick.includes(String(s.id) + ',')) {
            const row = btn.closest('tr');
            if (!row) return;
            const cells = row.querySelectorAll('td');
            // 0: F.I.SH
            if (cells[0]) {
                cells[0].querySelector('div[style*="font-weight: 600"]').textContent = s.last_name + ' ' + s.first_name;
                const emailDiv = cells[0].querySelector('div[style*="0.8rem"]');
                if (emailDiv) emailDiv.textContent = s.email;
            }
            // 1: Sinf & Maktab
            if (cells[1]) {
                const gradeSpan = cells[1].querySelector('span[style*="4e73df"]');
                if (gradeSpan) gradeSpan.innerHTML = s.grade + '-<span data-i18n="unit-sinf">sinf</span>';
                const schoolDiv = cells[1].querySelector('div[style*="0.8rem"]');
                if (schoolDiv) schoolDiv.textContent = s.school;
            }
            // 2: Fan
            if (cells[2]) {
                const subjSpan = cells[2].querySelector('span');
                if (subjSpan) subjSpan.innerHTML = '<i class="fas fa-book-reader"></i> ' + s.subject;
            }
            // Edit tugmasining onclick ni yangilash
            btn.setAttribute('onclick', btn.getAttribute('onclick')
                .replace(/openEditModal\([^)]+\)/,
                `openEditModal(${s.id},'${s.first_name}','${s.last_name}','${s.middle_name}','${s.email}','${s.school}','${s.grade}','${s.subject}','${s.exam_date}','${s.exam_time.substring(0,5)}')`));
        }
    });
}

/* ================================================================
   RASM YUKLASH — badge, modal, o'chirish
   (admin.html dan ko'chirildi — sweetalert2 keyin yuklangani uchun
    bu funksiyalar window.onload dan keyin ishlaydigan qilib yozildi)
   ================================================================ */

// Badge yangilash — fayl tanlanganda
function handleImagesUpload(input, badgeId) {
    var badge = document.getElementById(badgeId);
    if (!badge) return;
    var count = input.files ? input.files.length : 0;
    badge.textContent = count;
    if (count > 0) {
        badge.classList.add('has-images');
    } else {
        badge.classList.remove('has-images');
    }
}

// Serverdan bir sinf uchun rasm sonini olib badge ni yangilash
async function refreshBadgeForGrade(subject, grade) {
    var badge = document.getElementById('img-badge-' + grade);
    if (!badge) return;
    try {
        var resp = await fetch('/list-test-images/?subject=' + encodeURIComponent(subject) + '&grade=' + grade);
        var data = await resp.json();
        var count = (data.images || []).length;
        badge.textContent = count;
        if (count > 0) {
            badge.classList.add('has-images');
        } else {
            badge.classList.remove('has-images');
        }
    } catch(e) {}
}

window._refreshBadgeForGrade = refreshBadgeForGrade;

// Rasm ro'yxati modalini ochish
async function openImagesModal(grade) {
    var subjectInput = document.getElementById('selected-subject-input');
    var subject = subjectInput ? subjectInput.value.trim() : '';
    if (!subject || !grade) {
        Swal.fire('Xato', 'Avval fanni tanlang', 'warning');
        return;
    }
    Swal.fire({
        title: '<i class="fas fa-images" style="color:#10b981"></i> ' + subject + ' \u2014 ' + grade + '-sinf rasmlari',
        html: '<div style="text-align:center;padding:30px"><i class="fas fa-spinner fa-spin fa-2x" style="color:#10b981"></i><p style="margin-top:10px;color:#64748b">Yuklanmoqda...</p></div>',
        showConfirmButton: false,
        showCloseButton: true,
        width: 650,
        didOpen: async function() {
            try {
                var url = '/list-test-images/?subject=' + encodeURIComponent(subject) + '&grade=' + grade;
                var resp = await fetch(url);
                var data = await resp.json();
                var images = data.images || [];

                if (images.length === 0) {
                    Swal.update({
                        html: '<div style="text-align:center;padding:40px;color:#94a3b8"><i class="fas fa-image fa-3x" style="opacity:0.3"></i><p style="margin-top:15px;font-size:1rem">Hozircha rasmlar yuklanmagan</p></div>'
                    });
                    return;
                }

                var rows = images.map(function(img) {
                    return '<div class="img-modal-row" id="imgrow-' + encodeURIComponent(img.name) + '" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid #f1f5f9;transition:0.2s;">' +
                        '<img src="' + img.url + '" onerror="this.src=\'\';" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;flex-shrink:0">' +
                        '<span style="flex:1;font-size:0.88rem;color:#334155;word-break:break-all">' + img.name + '</span>' +
                        '<button onclick="deleteTestImage(\'' + img.name.replace(/'/g, "\\'") + '\',\'' + subject.replace(/'/g, "\\'") + '\',' + grade + ')" style="background:linear-gradient(135deg,#ef4444,#dc2626);color:white;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.82rem;font-weight:600;flex-shrink:0;">' +
                        '<i class="fas fa-trash-alt"></i> O&#39;chirish</button>' +
                        '</div>';
                }).join('');

                Swal.update({
                    html: '<div style="text-align:left;margin-bottom:12px;color:#64748b;font-size:0.85rem">Jami: <b style="color:#10b981">' + images.length + ' ta</b> rasm</div>' +
                          '<div style="max-height:420px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:10px">' + rows + '</div>'
                });
            } catch(e) {
                Swal.update({ html: '<p style="color:#ef4444">Server bilan bog&#39;liqda xato yuz berdi</p>' });
            }
        }
    });
}

// Rasmni o'chirish
async function deleteTestImage(filename, subject, grade) {
    var result = await Swal.fire({
        icon: 'warning',
        title: "O&#39;chirasizmi?",
        html: '<span style="font-size:0.9rem;color:#64748b;word-break:break-all">' + filename + '</span>',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: "<i class='fas fa-trash-alt'></i> Ha, o'chir",
        cancelButtonText: 'Bekor qilish'
    });
    if (!result.isConfirmed) return;

    try {
        var resp = await fetch('/delete-test-image/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ filename: filename, subject: String(subject), grade: String(grade) })
        });
        var data = await resp.json();
        if (data.status === 'success') {
            var row = document.getElementById('imgrow-' + encodeURIComponent(filename));
            if (row) {
                row.style.opacity = '0';
                row.style.transition = '0.3s';
                setTimeout(function() { row.remove(); }, 300);
            }
            var countEl = document.querySelector('.swal2-html-container b');
            if (countEl) {
                var cur = parseInt(countEl.textContent) - 1;
                countEl.textContent = cur + ' ta';
                if (cur === 0) openImagesModal(grade);
            }
            refreshBadgeForGrade(String(subject), grade);
        } else {
            Swal.fire('Xato!', data.message || "O'chirishda xato", 'error');
        }
    } catch(e) {
        Swal.fire('Xato!', "Server bilan bog'liqda xato", 'error');
    }
}