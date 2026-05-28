// متغيرات عامة
const API_BASE = '/api';
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// التحقق من تسجيل الدخول
function checkAuth() {
    if (authToken) {
        window.location.href = '/dashboard';
    }
}

checkAuth();

// التعامل مع تسجيل الدخول
async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showNotification('الرجاء ملء جميع الحقول', 'error');
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('authToken', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            showNotification('تم تسجيل الدخول بنجاح', 'success');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1000);
        } else {
            showNotification(data.error || 'خطأ في تسجيل الدخول', 'error');
        }
    } catch (error) {
        showNotification('خطأ في الاتصال: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// التعامل مع التسجيل
async function handleRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regPasswordConfirm').value;

    if (!username || !email || !password || !confirmPassword) {
        showNotification('الرجاء ملء جميع الحقول', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('كلمات المرور غير متطابقة', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('authToken', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            showNotification('تم التسجيل بنجاح', 'success');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1000);
        } else {
            showNotification(data.error || 'خطأ في التسجيل', 'error');
        }
    } catch (error) {
        showNotification('خطأ في الاتصال: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// التبديل بين نماذج التسجيل والدخول
function toggleRegister() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    loginForm.style.display = loginForm.style.display === 'none' ? 'flex' : 'none';
    registerForm.style.display = registerForm.style.display === 'none' ? 'flex' : 'none';
    
    // تنظيف الحقول
    if (loginForm.style.display === 'flex') {
        document.getElementById('regUsername').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regPasswordConfirm').value = '';
    } else {
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
    }
}

// عرض/إخفاء عنصر التحميل
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    spinner.style.display = show ? 'flex' : 'none';
}

// عرض الإخطارات
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    notification.style.backgroundColor = type === 'success' ? '#10b981' : '#ef4444';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 4000);
}

// معالجة المفاتيح المختصرة
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const loginForm = document.getElementById('loginForm');
        if (loginForm.style.display !== 'none') {
            handleLogin();
        } else {
            handleRegister();
        }
    }
});
