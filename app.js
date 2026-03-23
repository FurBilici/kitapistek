const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    // --- State & Setup ---
    let currentUser = JSON.parse(localStorage.getItem('pdfIstekUser')) || null;
    
    // --- DOM Elements ---
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

    // --- Init ---
    if (currentUser) {
        showMainApp();
    }

    // --- Authentication ---
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value.trim();
        const surname = document.getElementById('surname').value.trim();
        const password = document.getElementById('password').value;

        // Simple validation
        if (name.length < 2 || surname.length < 2 || password.length < 4) {
            showToast('Lütfen bilgileri eksiksiz girin (Şifre en az 4 hane)');
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
                localStorage.setItem('pdfIstekUser', JSON.stringify(currentUser));
                
                showToast('Giriş başarılı.');
                authForm.reset();
                showMainApp();
            } else {
                showToast(data.error || 'Bir hata oluştu.');
            }
        } catch (err) {
            console.error('API Error:', err);
            showToast('Sunucuya bağlanılamadı. Lütfen Node.js sunucusunu başlattığınızdan emin olun (`npm start`).');
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('pdfIstekUser');
        currentUser = null;
        authView.classList.remove('hidden');
        mainView.classList.add('hidden');
        showToast('Çıkış yapıldı.');
    });

    // --- Navigation ---
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            navButtons.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.add('hidden'));
            
            // Add active class to clicked
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('animate-fade-in');

            if (targetId === 'my-requests-view') {
                renderRequests();
            }
        });
    });

    // --- Book Requests ---
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

        const requestPayload = {
            userId: currentUser.id,
            bookName,
            bookAuthor,
            contactEmail,
            date
        };

        try {
            const res = await fetch(`${API_URL}/requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
            });

            if (res.ok) {
                bookRequestForm.reset();
                showToast('Kitap isteğiniz başarıyla hocanıza iletildi.');
                
                // Switch to "My Requests" tab automatically
                document.querySelector('[data-target="my-requests-view"]').click();
            }
        } catch (err) {
            showToast('İstek gönderilemedi. Sunucu bağlantısını kontrol edin.');
        }
    });

    async function renderRequests() {
        if (!currentUser) return;
        
        try {
            const res = await fetch(`${API_URL}/requests/${currentUser.id}`);
            const userRequests = await res.json();

            requestsList.innerHTML = '';

            if (userRequests.length === 0) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
                userRequests.forEach(req => {
                    const card = document.createElement('div');
                    card.className = 'request-item';
                    
                    let statusClass = '';
                    if (req.status === 'Onaylandı') statusClass = 'status-approved';
                    else if (req.status === 'Reddedildi') statusClass = 'status-pending'; // We can use pending styles or create new ones, default style doesn't have reddedildi
                    else statusClass = 'status-pending';

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
            console.error(err);
            showToast('İstekler yüklenirken hata oluştu.');
        }
    }

    // --- Helpers ---
    function showMainApp() {
        authView.classList.add('hidden');
        mainView.classList.remove('hidden');
        welcomeText.innerText = `${currentUser.name} ${currentUser.surname}`;
        // Ensure request form is showing first
        document.querySelector('[data-target="request-form-view"]').click();
    }

    let toastTimeout;
    function showToast(message) {
        toast.innerText = message;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});
