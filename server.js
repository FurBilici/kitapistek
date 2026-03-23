require('dotenv').config();

if (process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL) {
    process.env.KV_REST_API_URL = process.env.UPSTASH_REDIS_REST_URL;
    process.env.KV_REST_API_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { kv } = require('@vercel/kv');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');
const USE_KV = !!process.env.KV_REST_API_URL;
const IS_VERCEL = !!process.env.VERCEL;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const readDB = async () => {
    if (USE_KV) {
        const users = (await kv.get('users')) || [];
        const requests = (await kv.get('requests')) || [];
        return { users, requests };
    } else if (IS_VERCEL) {
        // Prevent EROFS (Read Only File System) crash on Vercel without KV logic.
        throw new Error('KV_MISSING');
    } else {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], requests: [] }, null, 2));
        }
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
};

const writeDB = async (db) => {
    if (USE_KV) {
        await kv.set('users', db.users);
        await kv.set('requests', db.requests);
    } else if (IS_VERCEL) {
        throw new Error('KV_MISSING');
    } else {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
};

app.post('/api/auth', async (req, res) => {
    try {
        const { name, surname, password } = req.body;
        if (!name || !password) return res.status(400).json({ error: 'Eksik bilgi' });

        const userId = `${name.toLowerCase()}_${(surname||'').toLowerCase()}`;
        const db = await readDB();
        
        let user = db.users.find(u => u.id === userId);
        
        if (user) {
            if (user.password !== password) return res.status(401).json({ error: 'Hatalı şifre' });
        } else {
            user = { id: userId, name, surname: surname || '', password };
            db.users.push(user);
            await writeDB(db);
        }
        
        res.json({ id: user.id, name: user.name, surname: user.surname });
    } catch (err) {
        if (err.message === 'KV_MISSING') {
            return res.status(500).json({ error: 'Vercel KV Hatası: Vercel Storage henüz cihaza bağlanmadı.' });
        }
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

app.post('/api/requests', async (req, res) => {
    try {
        const { userId, bookName, bookAuthor, contactEmail, date } = req.body;
        if (!userId || !bookName) return res.status(400).json({ error: 'Eksik bilgi' });

        const db = await readDB();
        const newRequest = { id: Date.now().toString(), userId, bookName, bookAuthor, contactEmail, status: 'Beklemede', date };
        
        db.requests.unshift(newRequest);
        await writeDB(db);
        
        res.json({ success: true, request: newRequest });
    } catch (err) {
        if (err.message === 'KV_MISSING') return res.status(500).json({ error: 'Storage henüz bağlı değil.' });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

app.get('/api/requests/:userId', async (req, res) => {
    try {
        const db = await readDB();
        const userRequests = db.requests.filter(r => r.userId === req.params.userId);
        res.json(userRequests);
    } catch (err) {
        if (err.message === 'KV_MISSING') return res.status(500).json({ error: 'Storage hatası' });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

app.post('/api/admin/login', (req, res) => {
    if (req.body.password === 'admin123') res.json({ success: true, token: 'admin-granted' });
    else res.status(401).json({ error: 'Hatalı yönetici şifresi' });
});

app.get('/api/admin/requests', async (req, res) => {
    try {
        const db = await readDB();
        const detailedRequests = db.requests.map(req => {
            const user = db.users.find(u => u.id === req.userId);
            return {
                ...req,
                userName: user ? `${user.name} ${user.surname}` : 'Bilinmeyen Öğrenci'
            };
        });
        res.json(detailedRequests);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

app.put('/api/admin/requests/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const db = await readDB();
        const idx = db.requests.findIndex(r => r.id === req.params.id);
        
        if (idx === -1) return res.status(404).json({ error: 'Bulunamadı' });
        db.requests[idx].status = status;
        await writeDB(db);
        
        res.json({ success: true, request: db.requests[idx] });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`[VERITABANI MODU] ${USE_KV ? 'Vercel KV (Bulut)' : 'Yerel database.json (Bilgisayar)'}`);
        console.log(`Server: http://localhost:${PORT}`);
    });
}
