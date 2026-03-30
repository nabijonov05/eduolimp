// Barcha funksiyalarni bitta initAuth funksiyasiga yig'amiz
function initAuth() {
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const loginForm = document.getElementById('loginForm');

    // 1. Parol ko'rsatish/yashirish
    if (togglePassword && passwordInput) {
        togglePassword.onclick = function() {
            const isPass = passwordInput.type === 'password';
            passwordInput.type = isPass ? 'text' : 'password';

            // Ikonkalarni almashtirish
            this.classList.toggle('fa-eye-slash', !isPass);
            this.classList.toggle('fa-eye', isPass);
        };
    }

    // 2. Kirilmoqda effekti (Submit eventini shundan ichida ushlaymiz)
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            // Asosiy tugmani qidiramiz
            const btn = this.querySelector('.login-btn');

            if (btn) {
                // Tugma matnini o'zgartirish
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kirilmoqda...';

                // Tugmani qayta bosilmasligi uchun bloklaymiz
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.7';

                // Ba'zida brauzer tugma matni o'zgarishiga ulgurmay sahifani yuboradi
                // Shuning uchun bu yerda return true qaytaramiz
                return true;
            }
        });
    }
}

// Sahifa yuklanganda FAQAT BIR MARTA chaqiramiz
document.addEventListener('DOMContentLoaded', initAuth);