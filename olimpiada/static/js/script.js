/* ============================================================
   EduOlimp — script.js (Professional)
   ============================================================ */

// ── 1. Navbar scroll effect ───────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
}, { passive: true });


// ── 2. Countdown Timer ───────────────────────────────────
function startCountdown(deadline) {
    const els = {
        days:  document.getElementById('timer-days'),
        hours: document.getElementById('timer-hours'),
        mins:  document.getElementById('timer-mins'),
    };

    function pad(n) { return n.toString().padStart(2, '0'); }

    function tick() {
        const diff = deadline - Date.now();
        if (diff <= 0) {
            els.days.textContent = els.hours.textContent = els.mins.textContent = '00';
            return;
        }
        els.days.textContent  = pad(Math.floor(diff / 864e5));
        els.hours.textContent = pad(Math.floor((diff % 864e5) / 36e5));
        els.mins.textContent  = pad(Math.floor((diff % 36e5) / 6e4));
    }
    tick();
    setInterval(tick, 1000);
}

const target = new Date();
target.setDate(target.getDate() + 5);
startCountdown(target.getTime());


// ── 3. Number Counter Animation ──────────────────────────
function animateCounter(el, to, suffix = '') {
    const duration = 1600;
    const start    = performance.now();
    const from     = 0;

    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(from + (to - from) * eased);
        el.textContent = value.toLocaleString('uz') + suffix;
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = to.toLocaleString('uz') + suffix;
    }
    requestAnimationFrame(step);
}

const statData = [
    { selector: '.stat-info:nth-of-type(1) h3', value: 15000, suffix: '+' },
    { selector: '.stat-info:nth-of-type(2) h3', value: 50,    suffix: '+' },
    { selector: '.stat-info:nth-of-type(3) h3', value: 1200,  suffix: '+' },
];

// Read raw values from DOM
const statEls = document.querySelectorAll('.stat-info h3');
const statValues = Array.from(statEls).map(el => ({
    el,
    value: parseInt(el.textContent.replace(/\D/g, ''), 10) || 0,
    suffix: el.textContent.includes('+') ? '+' : '',
}));


// ── 4. Scroll Reveal (IntersectionObserver) ───────────────
function initScrollReveal() {
    const targets = [
        ...document.querySelectorAll('.feature-card'),
        ...document.querySelectorAll('.stat-item'),
        ...document.querySelectorAll('.footer-col'),
        document.querySelector('.rating-section .section-header'),
        document.querySelector('.about-section .section-header'),
    ].filter(Boolean);

    targets.forEach((el, i) => {
        el.classList.add('reveal');
        el.style.transitionDelay = `${(i % 4) * 80}ms`;
    });

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(el => io.observe(el));
}

// Stats counter trigger (once)
let statsTriggered = false;
const statsBar = document.querySelector('.stats-bar');

const statsObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !statsTriggered) {
        statsTriggered = true;
        statValues.forEach(({ el, value, suffix }) => animateCounter(el, value, suffix));
        statsObserver.disconnect();
    }
}, { threshold: 0.3 });

if (statsBar) statsObserver.observe(statsBar);


// ── 5. Smooth Scroll (href="#…") ─────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const id = this.getAttribute('href').slice(1);
        if (!id) return;
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        const offset = parseInt(getComputedStyle(document.documentElement)
            .getPropertyValue('--nav-h')) || 72;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
    });
});


// ── 6. Active nav link on scroll ─────────────────────────
const sections = document.querySelectorAll('section[id], header[id], footer[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            navAnchors.forEach(a => a.classList.remove('active'));
            const active = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
            if (active) active.classList.add('active');
        }
    });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => sectionObserver.observe(s));


// ── 7. Rating table row hover highlight ──────────────────
document.querySelectorAll('.rating-table tbody tr').forEach(row => {
    row.addEventListener('mouseenter', () => {
        row.style.transition = 'background .2s';
    });
});


// ── 8. Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
});