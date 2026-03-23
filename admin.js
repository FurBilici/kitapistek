let API_URL = '/api';
if (window.location.protocol === 'file:' || window.location.hostname === 'localhost') {
    API_URL = 'http://localhost:3000/api';
}

document.addEventListener('DOMContentLoaded', () => {
    const adminLoginView = document.getElementById('admin-login-view');
    const adminDashboardView = document.getElementById('admin-dashboard-view');
    const adminLoginForm = document.getElementById('admin-login-form');
    const logoutBtn = document.getElementById('admin-logout-btn');
    const requestsList = document.getElementById('admin-requests-list');
    const emptyState = document.getElementById('admin-empty-state');
    const toast = document.getElementById('toast');

    let isAdminLoggedIn = localStorage.getItem('pdfAdminToken') === 'admin-granted';

    if (isAdminLoggedIn) {
        showDashboard();
    }

    // --- Login ---
    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('admin-password').value;

        try {
            const res = await fetch(`${API_URL}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('pdfAdminToken', data.token);
                showToast('Giriş başarılı. Yükleniyor...');
                showDashboard();
            } else {
                showToast(data.error || 'Hatalı şifre.');
            }
        } catch (err) {
            showToast('Sunucu ile bağlantı kurulamadı. Sunucunun çalıştığına emin olun.');
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('pdfAdminToken');
        adminDashboardView.classList.add('hidden');
        adminLoginView.classList.remove('hidden');
        showToast('Çıkış yapıldı.');
    });

    async function showDashboard() {
        adminLoginView.classList.add('hidden');
        adminDashboardView.classList.remove('hidden');
        await loadRequests();
    }

    async function loadRequests() {
        try {
            const res = await fetch(`${API_URL}/admin/requests`);
            const requests = await res.json();

            requestsList.innerHTML = '';
            
            if (requests.length === 0) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
                
                requests.forEach(req => {
                    const tr = document.createElement('tr');
                    
                    let badgeClass = '';
                    if (req.status === 'Onaylandı') badgeClass = 'onaylandi';
                    else if (req.status === 'Reddedildi') badgeClass = 'reddedildi';
                    else badgeClass = 'beklemede';

                    tr.innerHTML = `
                        <td>${req.date}</td>
                        <td style="font-weight: 500;">${req.userName}</td>
                        <td>
                            <div style="color: var(--primary); font-weight: 600;">${req.bookName}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${req.bookAuthor}</div>
                        </td>
                        <td><a href="mailto:${req.contactEmail}" style="color: var(--text-main); text-decoration: none;"><i class="fas fa-at"></i> ${req.contactEmail}</a></td>
                        <td><span class="status-badge ${badgeClass}">${req.status}</span></td>
                        <td>
                            <button class="action-btn btn-approve" data-id="${req.id}" data-action="Onaylandı" title="Onayla"><i class="fas fa-check"></i></button>
                            <button class="action-btn btn-reject" data-id="${req.id}" data-action="Reddedildi" title="Reddet"><i class="fas fa-times"></i></button>
                            <button class="action-btn btn-pending" data-id="${req.id}" data-action="Beklemede" title="Beklemeye Al"><i class="fas fa-clock"></i></button>
                        </td>
                    `;
                    requestsList.appendChild(tr);
                });

                // Attach Action Listeners
                document.querySelectorAll('.action-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.currentTarget.getAttribute('data-id');
                        const action = e.currentTarget.getAttribute('data-action');
                        updateRequestStatus(id, action);
                    });
                });
            }
        } catch (err) {
            console.error('Error loading requests:', err);
            showToast('İstekler yüklenemedi.');
        }
    }

    async function updateRequestStatus(id, status) {
        try {
            const res = await fetch(`${API_URL}/admin/requests/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                showToast(`İstek durumu '${status}' olarak güncellendi.`);
                loadRequests(); // Refresh table
            }
        } catch (err) {
            showToast('Durum güncellenemedi.');
        }
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
