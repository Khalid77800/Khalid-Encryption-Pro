// متغيرات عامة
const API_BASE = '/api';
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');
let encryptFile = null;
let decryptFile = null;

// التحقق من المصادقة عند تحميل الصفحة
window.addEventListener('load', () => {
    if (!authToken) {
        window.location.href = '/';
        return;
    }
    loadUserProfile();
    loadLogs();
});

// تحميل بيانات المستخدم
async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE}/user/profile`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (response.ok) {
            currentUser = data;
            document.getElementById('userName').textContent = data.username;
            document.getElementById('userEmail').textContent = data.email;
            document.getElementById('settingsEmail').value = data.email;
            document.getElementById('themeSelect').value = data.theme || 'dark';
        }
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
    }
}

// عرض الأقسام المختلفة
function showSection(sectionId) {
    const sections = document.querySelectorAll('.section');
    const navItems = document.querySelectorAll('.nav-item');
    
    sections.forEach(section => section.classList.remove('active'));
    navItems.forEach(item => item.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    event.target.closest('.nav-item').classList.add('active');
}

// ============ قسم التشفير ============
document.getElementById('encryptDropZone')?.addEventListener('click', () => {
    document.getElementById('encryptFile').click();
});

document.getElementById('encryptDropZone')?.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.target.style.borderColor = '#6366f1';
});

document.getElementById('encryptDropZone')?.addEventListener('dragleave', (e) => {
    e.target.style.borderColor = '#2a2a3e';
});

document.getElementById('encryptDropZone')?.addEventListener('drop', (e) => {
    e.preventDefault();
    handleEncryptFileSelect(e.dataTransfer.files);
});

function handleEncryptFileSelect(files) {
    if (files.length === 0) return;
    
    encryptFile = files[0];
    const fileSize = (encryptFile.size / 1024 / 1024).toFixed(2);
    
    document.getElementById('encryptDropZone').style.display = 'none';
    document.getElementById('encryptFileSelected').style.display = 'block';
    document.getElementById('encryptFileName').textContent = `📁 ${encryptFile.name}`;
    document.getElementById('encryptFileSize').textContent = `📊 الحجم: ${fileSize} MB`;
}

async function startEncryption() {
    if (!encryptFile) {
        showNotification('الرجاء اختيار ملف', 'error');
        return;
    }

    const password = document.getElementById('encryptPassword').value;
    const passwordConfirm = document.getElementById('encryptPasswordConfirm').value;

    if (!password || !passwordConfirm) {
        showNotification('الرجاء إدخال كلمة المرور', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        showNotification('كلمات المرور غير متطابقة', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', encryptFile);
    formData.append('password', password);

    showEncryptProgress(true);

    try {
        const startTime = Date.now();
        const response = await fetch(`${API_BASE}/encrypt`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });

        const data = await response.json();
        const duration = (Date.now() - startTime) / 1000;

        if (response.ok) {
            showEncryptProgress(false);
            showEncryptResult(true, data, duration);
            loadLogs();
            
            // إعادة تعيين النموذج
            setTimeout(() => {
                resetEncryptForm();
            }, 3000);
        } else {
            showEncryptProgress(false);
            showEncryptError(data.error || 'خطأ في التشفير');
        }
    } catch (error) {
        showEncryptProgress(false);
        showEncryptError('خطأ في الاتصال: ' + error.message);
    }
}

function showEncryptProgress(show) {
    document.getElementById('encryptProgress').style.display = show ? 'block' : 'none';
    if (show) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress > 95) progress = 95;
            document.getElementById('encryptProgressFill').style.width = progress + '%';
            document.getElementById('encryptStatus').textContent = `جاري التشفير... ${Math.floor(progress)}%`;
        }, 300);
        
        setTimeout(() => {
            clearInterval(interval);
            document.getElementById('encryptProgressFill').style.width = '100%';
            document.getElementById('encryptStatus').textContent = 'اكتمل التشفير بنجاح!';
        }, 3000);
    }
}

function showEncryptResult(success, data, duration) {
    if (success) {
        document.getElementById('encryptResult').style.display = 'block';
        document.getElementById('encryptError').style.display = 'none';
        document.getElementById('encryptResultMessage').textContent = 
            `✅ ${data.message} | الحجم: ${(data.file_size / 1024 / 1024).toFixed(2)} MB | الوقت: ${duration.toFixed(2)} ثانية`;
        showNotification(`تم التشفير بنجاح في ${duration.toFixed(2)} ثانية`, 'success');
    }
}

function showEncryptError(error) {
    document.getElementById('encryptError').style.display = 'block';
    document.getElementById('encryptResult').style.display = 'none';
    document.getElementById('encryptErrorMessage').textContent = error;
    showNotification(error, 'error');
}

function resetEncryptForm() {
    encryptFile = null;
    document.getElementById('encryptDropZone').style.display = 'block';
    document.getElementById('encryptFileSelected').style.display = 'none';
    document.getElementById('encryptPassword').value = '';
    document.getElementById('encryptPasswordConfirm').value = '';
    document.getElementById('encryptResult').style.display = 'none';
    document.getElementById('encryptError').style.display = 'none';
}

// ============ قسم فك التشفير ============
document.getElementById('decryptDropZone')?.addEventListener('click', () => {
    document.getElementById('decryptFile').click();
});

document.getElementById('decryptDropZone')?.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.target.style.borderColor = '#6366f1';
});

document.getElementById('decryptDropZone')?.addEventListener('dragleave', (e) => {
    e.target.style.borderColor = '#2a2a3e';
});

document.getElementById('decryptDropZone')?.addEventListener('drop', (e) => {
    e.preventDefault();
    handleDecryptFileSelect(e.dataTransfer.files);
});

function handleDecryptFileSelect(files) {
    if (files.length === 0) return;
    
    decryptFile = files[0];
    const fileSize = (decryptFile.size / 1024 / 1024).toFixed(2);
    
    document.getElementById('decryptDropZone').style.display = 'none';
    document.getElementById('decryptFileSelected').style.display = 'block';
    document.getElementById('decryptFileName').textContent = `📁 ${decryptFile.name}`;
    document.getElementById('decryptFileSize').textContent = `📊 الحجم: ${fileSize} MB`;
}

async function startDecryption() {
    if (!decryptFile) {
        showNotification('الرجاء اختيار ملف مشفر', 'error');
        return;
    }

    const password = document.getElementById('decryptPassword').value;

    if (!password) {
        showNotification('الرجاء إدخال كلمة المرور', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', decryptFile);
    formData.append('password', password);

    showDecryptProgress(true);

    try {
        const startTime = Date.now();
        const response = await fetch(`${API_BASE}/decrypt`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });

        const data = await response.json();
        const duration = (Date.now() - startTime) / 1000;

        if (response.ok) {
            showDecryptProgress(false);
            showDecryptResult(true, data, duration);
            loadLogs();
            
            setTimeout(() => {
                resetDecryptForm();
            }, 3000);
        } else {
            showDecryptProgress(false);
            showDecryptError(data.error || 'خطأ في فك التشفير');
        }
    } catch (error) {
        showDecryptProgress(false);
        showDecryptError('خطأ في الاتصال: ' + error.message);
    }
}

function showDecryptProgress(show) {
    document.getElementById('decryptProgress').style.display = show ? 'block' : 'none';
    if (show) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress > 95) progress = 95;
            document.getElementById('decryptProgressFill').style.width = progress + '%';
            document.getElementById('decryptStatus').textContent = `جاري فك التشفير... ${Math.floor(progress)}%`;
        }, 300);
        
        setTimeout(() => {
            clearInterval(interval);
            document.getElementById('decryptProgressFill').style.width = '100%';
            document.getElementById('decryptStatus').textContent = 'اكتمل فك التشفير بنجاح!';
        }, 3000);
    }
}

function showDecryptResult(success, data, duration) {
    if (success) {
        document.getElementById('decryptResult').style.display = 'block';
        document.getElementById('decryptError').style.display = 'none';
        document.getElementById('decryptResultMessage').textContent = 
            `✅ ${data.message} | الحجم: ${(data.file_size / 1024 / 1024).toFixed(2)} MB | الوقت: ${duration.toFixed(2)} ثانية`;
        showNotification(`تم فك التشفير بنجاح في ${duration.toFixed(2)} ثانية`, 'success');
    }
}

function showDecryptError(error) {
    document.getElementById('decryptError').style.display = 'block';
    document.getElementById('decryptResult').style.display = 'none';
    document.getElementById('decryptErrorMessage').textContent = error;
    showNotification(error, 'error');
}

function resetDecryptForm() {
    decryptFile = null;
    document.getElementById('decryptDropZone').style.display = 'block';
    document.getElementById('decryptFileSelected').style.display = 'none';
    document.getElementById('decryptPassword').value = '';
    document.getElementById('decryptResult').style.display = 'none';
    document.getElementById('decryptError').style.display = 'none';
}

// ============ قسم السجلات ============
async function loadLogs(operation = 'all') {
    try {
        const response = await fetch(`${API_BASE}/logs?page=1&per_page=20`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();

        if (response.ok) {
            let logs = data.logs;
            if (operation !== 'all') {
                logs = logs.filter(log => log.operation === operation);
            }

            const tbody = document.getElementById('logsBody');
            tbody.innerHTML = '';

            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center">لا توجد سجلات</td></tr>';
                return;
            }

            logs.forEach(log => {
                const row = tbody.insertRow();
                const fileSize = (log.file_size / 1024 / 1024).toFixed(2);
                const date = new Date(log.timestamp).toLocaleString('ar-EG');
                const operationText = log.operation === 'encrypt' ? '🔒 تشفير' : '🔓 فك تشفير';
                const statusBadge = log.status === 'success' ? '✅ نجح' : '❌ فشل';

                row.innerHTML = `
                    <td>${log.filename}</td>
                    <td>${operationText}</td>
                    <td>${fileSize} MB</td>
                    <td>${log.duration?.toFixed(4) || '--'} ثانية</td>
                    <td>${statusBadge}</td>
                    <td>${date}</td>
                `;
            });
        }
    } catch (error) {
        console.error('خطأ في تحميل السجلات:', error);
    }
}

function filterLogs(operation) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    loadLogs(operation);
}

// ============ قسم الإعدادات ============
async function updateProfile() {
    const email = document.getElementById('settingsEmail').value.trim();

    if (!email) {
        showNotification('الرجاء إدخال البريد الإلكتروني', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/user/update`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser.email = email;
            localStorage.setItem('user', JSON.stringify(currentUser));
            showNotification('تم تحديث البيانات بنجاح', 'success');
        } else {
            showNotification(data.error || 'خطأ في التحديث', 'error');
        }
    } catch (error) {
        showNotification('خطأ في الاتصال: ' + error.message, 'error');
    }
}

async function changePassword() {
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!oldPassword || !newPassword || !confirmPassword) {
        showNotification('الرجاء ملء جميع الحقول', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification('كلمات المرور الجديدة غير متطابقة', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showNotification('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/user/change-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('تم تغيير كلمة المرور بنجاح', 'success');
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            showNotification(data.error || 'خطأ في تغيير كلمة المرور', 'error');
        }
    } catch (error) {
        showNotification('خطأ في الاتصال: ' + error.message, 'error');
    }
}

function changeTheme(theme) {
    document.body.className = theme + '-theme';
    // يمكن حفظ الاختيار في قاعدة البيانات
}

// ============ دوال مساعدة ============
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

function logout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}
