// /mnt/data/skprofiling-backend/routes/members.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('../db'); // adjust path if your db.js is elsewhere

const upload = multer({ storage: multer.memoryStorage() }); // small images OK
const JWT_SECRET = process.env.JWT_SECRET || 'please_change_me';

// auth middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const token = auth.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

const PROFILE_FIELDS = [
  'name','dob','age','gender','civil_status','religion','contact','address',
  'school_level','school_name','school_status','employment','work_type','work_time',
  'illnesses','healthcare','disabilities','youth_org','risks','experience','groups',
  'willingness','guardian_name','guardian_contact','relationship'
];

// GET profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const uid = req.user.id;
    const q = await db.query('SELECT * FROM profiles WHERE user_id = $1', [uid]);
    if (!q.rowCount) return res.json({ profile: null });
    res.json({ profile: q.rows[0] });
  } catch (err) {
    console.error('GET profile err', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET profile image (public)
router.get('/profile/image/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const q = await db.query('SELECT profile_image, image_mime FROM profiles WHERE user_id = $1', [userId]);
    if (!q.rowCount || !q.rows[0].profile_image) return res.status(404).send('No image');
    const { profile_image, image_mime } = q.rows[0];
    res.setHeader('Content-Type', image_mime || 'application/octet-stream');
    res.send(profile_image);
  } catch (err) {
    console.error('GET image err', err);
    res.status(500).send('Server error');
  }
});

// POST profile (multipart) - upsert profile and store image as bytea
router.post('/profile', authMiddleware, upload.single('profileImage'), async (req, res) => {
  try {
    const uid = req.user.id;
    const body = req.body || {};

    // collect values in order
    const values = PROFILE_FIELDS.map(f => (body[f] !== undefined ? body[f] : null));

    // columns and params
    const cols = ['user_id', ...PROFILE_FIELDS];
    const params = [uid, ...values];

    if (req.file && req.file.buffer) {
      cols.push('profile_image', 'image_mime');
      params.push(req.file.buffer, req.file.mimetype);
    }

    const placeholders = cols.map((_, i) => `$${i+1}`).join(', ');

    // Build ON CONFLICT update list
    const updateParts = PROFILE_FIELDS.map(f => `${f} = EXCLUDED.${f}`);
    if (req.file && req.file.buffer) {
      updateParts.push('profile_image = EXCLUDED.profile_image', 'image_mime = EXCLUDED.image_mime');
    }
    updateParts.push('updated_at = now()');

    const sql = `
      INSERT INTO profiles (${cols.join(',')})
      VALUES (${placeholders})
      ON CONFLICT (user_id) DO UPDATE SET ${updateParts.join(', ')}
      RETURNING *;
    `;

    const r = await db.query(sql, params);
    return res.json({ ok: true, profile: r.rows[0] });
  } catch (err) {
    console.error('POST profile err', err);
    return res.status(500).json({ error: 'Server error' });
  }
  
});

module.exports = router;
