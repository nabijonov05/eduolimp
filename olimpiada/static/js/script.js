// 1. Teskari hisoblagich (Countdown Timer)
function startCountdown(deadline) {
    function updateTimer() {
        const now = new Date().getTime();
        const diff = deadline - now;

        if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            document.getElementById('timer-days').innerText = days.toString().padStart(2, '0');
            document.getElementById('timer-hours').innerText = hours.toString().padStart(2, '0');
            document.getElementById('timer-mins').innerText = mins.toString().padStart(2, '0');
        }
    }
    setInterval(updateTimer, 1000);
    updateTimer();
}

// Olimpiada sanasini belgilash (masalan, bugundan 5 kun keyin)
const targetDate = new Date();
targetDate.setDate(targetDate.getDate() + 5);
startCountdown(targetDate.getTime());


// 2. Statistika sonlarining o'sish effekti (Number Counter Animation)
const stats = document.querySelectorAll('.stat-item h3');
const speed = 200;

const animateStats = () => {
    stats.forEach(counter => {
        const updateCount = () => {
            const target = +counter.innerText.replace(/\D/g, ''); // Faqat sonni olish
            const count = +counter.dataset.current || 0;
            const inc = target / speed;

            if (count < target) {
                const newValue = Math.ceil(count + inc);
                counter.dataset.current = newValue;
                // Asl matndagi belgilarni saqlab qolish (masalan, + belgisi)
                counter.innerText = counter.innerText.includes('+') ? newValue + '+' : newValue;
                setTimeout(updateCount, 1);
            } else {
                counter.innerText = counter.innerText.includes('+') ? target + '+' : target;
            }
        };
        updateCount();
    });
};

// 3. Scroll bo'lganda elementlarning chiqib kelishi (Reveal on Scroll)
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.padding = '10px 0';
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
    } else {
        navbar.style.padding = '20px 0';
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
    }

    // Statistika qismiga yetganda animatsiyani boshlash
    const statsSection = document.querySelector('.stats-bar');
    const sectionPos = statsSection.getBoundingClientRect().top;
    const screenPos = window.innerHeight / 1.2;

    if (sectionPos < screenPos && !statsSection.classList.contains('animated')) {
        animateStats();
        statsSection.classList.add('animated');
    }
});

// 4. Tugmalarga bosilganda silliq o'tish (Smooth Scroll)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});