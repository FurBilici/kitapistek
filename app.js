let API_URL = '/api';
if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    API_URL = 'http://localhost:3000/api';
}

document.addEventListener('DOMContentLoaded', () => {
    // Session state uses both local and session storage memory based on 'remember me'
    let currentUser = JSON.parse(localStorage.getItem('pdfIstekUser')) || JSON.parse(sessionStorage.getItem('pdfIstekUser')) || null;
    
    const authView = document.getElementById('auth-view');
    const mainView = document.getElementById('main-view');
    const authForm = document.getElementById('auth-form');
    const bookRequestForm = document.getElementById('book-request-form');
    const welcomeText = document.getElementById('welcome-text');
    const logoutBtn = document.getElementById('logout-btn');
    const navButtons = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view-section');
    const requestsList = document.getElementById('requests-list');
    const emptyState = document.getElementById('empty-state');
    const toast = document.getElementById('toast');

    if (currentUser) showMainApp();

    // --- Authentication ---
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullname = document.getElementById('fullname').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me').checked;

        const nameParts = fullname.split(' ');
        const name = nameParts[0];
        const surname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        if (name.length < 2 || password.length < 4) {
            showToast('Lütfen bilgilerinizi geçerli girin (Şifre en az 4 hane)');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, surname, password })
            });

            const data = await res.json();

            if (res.ok) {
                currentUser = { id: data.id, name: data.name, surname: data.surname };
                
                // Memory logic
                if (rememberMe) {
                    localStorage.setItem('pdfIstekUser', JSON.stringify(currentUser));
                    sessionStorage.removeItem('pdfIstekUser');
                } else {
                    sessionStorage.setItem('pdfIstekUser', JSON.stringify(currentUser));
                    localStorage.removeItem('pdfIstekUser');
                }
                
                showToast('Giriş başarılı.');
                authForm.reset();
                showMainApp();
            } else {
                showToast(data.error || 'Giriş reddedildi.');
            }
        } catch (err) {
            console.error('API Hatası:', err);
            // Vercel KV eksikse veya backend kapalıysa oluşur
            showToast('Sunucu hatası: İnternet bağlantınızı kontrol edin veya sunucu kurallarını inceleyin.');
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('pdfIstekUser');
        sessionStorage.removeItem('pdfIstekUser');
        currentUser = null;
        authView.classList.remove('hidden');
        mainView.classList.add('hidden');
        showToast('Çıkış yapıldı.');
    });

    // --- Navigation & Other logic...
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.add('hidden'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('animate-fade-in');

            if (targetId === 'my-requests-view') renderRequests();
        });
    });

    bookRequestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const bookName = document.getElementById('book-name').value.trim();
        const bookAuthor = document.getElementById('book-author').value.trim();
        const contactEmail = document.getElementById('contact-email').value.trim();
        if (!bookName || !bookAuthor || !contactEmail) return;

        const date = new Date().toLocaleDateString('tr-TR', { 
            year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit'
        });

        try {
            const res = await fetch(`${API_URL}/requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, bookName, bookAuthor, contactEmail, date })
            });
            const data = await res.json();
            
            if (res.ok) {
                bookRequestForm.reset();
                showToast('Kitap isteğiniz başarıyla hocanıza iletildi.');
                document.querySelector('[data-target="my-requests-view"]').click();
            } else {
                showToast(data.error || 'İstek gönderilemedi.');
            }
        } catch (err) {
            showToast('Bağlantı sorunu yaşandı, lütfen tekrar deneyin.');
        }
    });

    async function renderRequests() {
        if (!currentUser) return;
        try {
            const res = await fetch(`${API_URL}/requests/${currentUser.id}`);
            const userRequests = await res.json();

            requestsList.innerHTML = '';

            if (res.ok && userRequests.length === 0) {
                emptyState.classList.remove('hidden');
            } else if (res.ok) {
                emptyState.classList.add('hidden');
                userRequests.forEach(req => {
                    const card = document.createElement('div');
                    card.className = 'request-item';
                    
                    let statusClass = req.status === 'Onaylandı' ? 'status-approved' : 'status-pending';
                    let statusTextColor = req.status === 'Reddedildi' ? 'style="color: #f43f5e"' : '';

                    card.innerHTML = `
                        <div class="req-header">
                            <span class="req-title"><i class="fas fa-book-open" style="font-size:0.9rem; margin-right:5px"></i> ${req.bookName}</span>
                            <span class="req-status ${statusClass}" ${statusTextColor}>${req.status}</span>
                        </div>
                        <div class="req-body">
                            <p><i class="fas fa-user-edit"></i> ${req.bookAuthor}</p>
                            <p><i class="fas fa-at"></i> ${req.contactEmail}</p>
                        </div>
                        <div class="req-date">${req.date}</div>
                    `;
                    requestsList.appendChild(card);
                });
            }
        } catch (err) {
            showToast('İstekler yüklenirken hata oluştu.');
        }
    }

    function showMainApp() {
        authView.classList.add('hidden');
        mainView.classList.remove('hidden');
        welcomeText.innerText = `${currentUser.name} ${currentUser.surname}`.trim();
        document.querySelector('[data-target="request-form-view"]').click();
    }

    let toastTimeout;
    function showToast(message) {
        toast.innerText = message;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 4000);
    }
});
