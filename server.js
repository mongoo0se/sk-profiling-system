// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const membersRoutes = require('./routes/members');
const adminRoutes = require('./routes/admin');
const annRoutes = require('./routes/announcements');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/announcements', annRoutes);

// also added as requested (duplicate is safe)
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
