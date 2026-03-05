// 1. Parolni ko'rsatish va yashirish funksiyasi
function togglePass(inputId, icon) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        // Ikonkani o'zgartirish (Slashni olib tashlash)
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
        icon.style.color = "#2563eb"; // Ko'k rang (faol)
    } else {
        input.type = "password";
        // Ikonkani qaytarish
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        icon.style.color = "#64748b"; // Kulrang (noaktiv)
    }
}

// 2. Forma yuborilganda yuklanish effekti
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('registerForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function() {
            const btn = this.querySelector('.main-btn');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Tekshirilmoqda...';
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.7';
            }
        });
    }
});