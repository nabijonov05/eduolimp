document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.admin-nav a');
    const sections = document.querySelectorAll('.admin-section');
    const pageTitle = document.getElementById('page-title');

    const sectionConfig = {
        'dashboard': { id: 'dashboard-section', title: "Umumiy nazorat" },
        'test':      { id: 'test-section',      title: "Yangi test qo'shish" },
        'users':     { id: 'user-section',      title: "Foydalanuvchilar" },
        'analytics': { id: 'analytics-section', title: "Analitika" },
        'settings':  { id: 'settings-section',  title: "Tizim sozlamalari" }
    };

    // --- ASOSIY FUNKSIYA: Bo'limni faollashtirish ---
    function activateSection(key) {
        if (!sectionConfig[key]) key = 'dashboard';
        const config = sectionConfig[key];

        // MUHIM: Har safar bo'lim o'zgarganda uni brauzer xotirasiga saqlaymiz
        localStorage.setItem('activeAdminTab', key);

        // 1. Hamma bo'limni yashirish
        sections.forEach(s => s.style.display = 'none');

        // 2. Kerakli bo'limni ochish
        const target = document.getElementById(config.id);
        if (target) target.style.display = 'block';

        // 3. Sarlavhani o'zgartirish
        if (pageTitle) pageTitle.innerText = config.title;

        // 4. Sidebar'da aktiv klassni to'g'rilash
        navLinks.forEach(l => {
            l.classList.remove('active');
            if (l.innerText.trim().includes(config.title)) {
                l.classList.add('active');
            }
        });

        // Grafiklar bo'lsa chizish
        if (key === 'analytics' && typeof renderAnalytics === 'function') {
            setTimeout(renderAnalytics, 150);
        }
    }

    // --- 1-QADAM: Sahifa yuklanganda holatni aniqlash ---
    const urlParams = new URLSearchParams(window.location.search);
    const urlSection = urlParams.get('section');
    const savedSection = localStorage.getItem('activeAdminTab');

    // Ustuvorlik: 1. URL parametri, 2. localStorage (saqlangan), 3. Default (dashboard)
    const initialSection = urlSection || savedSection || 'dashboard';

    activateSection(initialSection);

    // --- 2-QADAM: Tugmalar bosilganda ishlash ---
    navLinks.forEach((link) => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            const linkText = this.innerText.trim();
            let sectionKey = 'dashboard';

            if (linkText.includes("Yangi test qo'shish")) sectionKey = 'test';
            else if (linkText.includes("Foydalanuvchilar")) sectionKey = 'users';
            else if (linkText.includes("Analitika")) sectionKey = 'analytics';
            else if (linkText.includes("Tizim sozlamalari")) sectionKey = 'settings';

            // URL'ni o'zgartirish
            const newUrl = `${window.location.pathname}?section=${sectionKey}`;
            window.history.pushState({ section: sectionKey }, '', newUrl);

            activateSection(sectionKey);
        });
    });

    // Brauzerning "Orqaga" tugmasi bosilganda ishlashi uchun
    window.addEventListener('popstate', (event) => {
        const section = new URLSearchParams(window.location.search).get('section') || 'dashboard';
        activateSection(section);
    });
});















// Fan tanlanganda sinflarni chiqarish va statusni tekshirish
function selectSubject(subjectName, element) {
    // 1. Kartochkalarni rangini yangilash
    document.querySelectorAll('.subject-card').forEach(card => card.classList.remove('selected'));
    element.classList.add('selected');

    // 2. Yashirin inputga fan nomini yozish
    document.getElementById('selected-subject-input').value = subjectName;

    // 3. Formani ko'rsatish
    const selectionArea = document.getElementById('class-selection-area');
    selectionArea.style.display = 'block';
    document.getElementById('selected-subject-title').innerHTML = `<i class="fas fa-graduation-cap"></i> ${subjectName} fani bo'yicha sinflarni tanlang:`;

    // 4. BAZADAGI STATUSNI TEKSHIRISH
    [9, 10, 11].forEach(grade => {
        const statusSpan = document.getElementById(`file-name-${grade}`);
        const key = `${subjectName}_${grade}`;

        // uploadedStatus mavjudligini tekshiramiz
        if (typeof uploadedStatus !== 'undefined' && uploadedStatus[key]) {
            statusSpan.innerText = "✅ Tizimga fayl yuklandi";
            statusSpan.style.color = "#2ecc71";
            statusSpan.style.fontWeight = "bold";
        } else {
            statusSpan.innerText = "Fayl tanlanmagan";
            statusSpan.style.color = "#888";
            statusSpan.style.fontWeight = "normal";
        }
    });

    // 5. Ekranni pastga surish (TO'G'RILANDI)
    setTimeout(() => {
        selectionArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// Fayl tanlanganda ko'rinishni yangilash
function handleFileUpload(input, targetId) {
    const fileNameDisplay = document.getElementById(targetId);
    if (input.files.length > 0) {
        fileNameDisplay.innerText = "✅ Tanlandi: " + input.files[0].name;
        fileNameDisplay.style.color = "#2ecc71";
        fileNameDisplay.style.fontWeight = "bold";
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