// routes/announcements.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'please_change_me';

// public fetch announcements (latest first)
router.get('/', async (req, res) => {
  try {
    const q = await db.query('SELECT id,title,message,created_at FROM announcements ORDER BY created_at DESC LIMIT 50');
    res.json({ announcements: q.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// admin create announcement
router.post('/', async (req,res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'No token' });
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

    const { title, message } = req.body;
    const q = await db.query('INSERT INTO announcements(title,message) VALUES($1,$2) RETURNING *', [title, message]);
    res.json({ announcement: q.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
