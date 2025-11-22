const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change_me";

// Middleware: Only admin can access
function adminOnly(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token" });

  const token = authHeader.split(" ")[1];
  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (user.role !== "admin") return res.status(403).json({ error: "Not admin" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// POST announcement
router.post("/announcement", adminOnly, async (req, res) => {
  const { title, message } = req.body;
  try {
    const r = await db.query(
      "INSERT INTO announcements (title, message, created_at) VALUES ($1,$2,NOW()) RETURNING *",
      [title, message]
    );
    res.json({ ok: true, announcement: r.rows[0] });
  } catch (e) {
    console.error("Announcement error", e);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all announcements
router.get("/announcement/all", async (req, res) => {
  try {
    const r = await db.query(
      "SELECT * FROM announcements ORDER BY created_at DESC"
    );
    res.json({ announcements: r.rows });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE announcement by id
router.delete("/announcement/:id", adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query("DELETE FROM announcements WHERE id = $1 RETURNING *", [id]);
    if (!r.rowCount) return res.status(404).json({ error: "Announcement not found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("Delete announcement error", e);
    res.status(500).json({ error: "Server error" });
  }
});


/*  
======================================================
    FIXED MEMBER ROUTES — WORK WITH YOUR DATABASE
======================================================
*/

// SEARCH member by name (your DB does NOT have "surname")
router.get("/members/search", adminOnly, async (req, res) => {
  const q = `%${req.query.q}%`;
  try {
    const r = await db.query(
      `SELECT 
          id,
          name,
          contact,
          address,
          guardian_name,
          encode(profile_image, 'base64') AS img_base64,
          image_mime
       FROM profiles 
       WHERE LOWER(name) LIKE LOWER($1)
       ORDER BY name ASC`,
      [q]
    );
    res.json({ members: r.rows });
  } catch (e) {
    console.error("SEARCH ERROR", e);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/members/filter/:letter", adminOnly, async (req, res) => {
  const letter = (req.params.letter || '').toLowerCase();

  try {
    // Pull id, name, contact, address and compute surname = last word of name
    const r = await db.query(`
      SELECT
        id,
        name,
        contact,
        address,
        split_part(name, ' ', array_length(string_to_array(name, ' '), 1)) AS surname
      FROM profiles
      WHERE name IS NOT NULL
    `);

    // server-side filter where surname startsWith letter (case-insensitive)
    const filtered = (r.rows || []).filter(row =>
      row.surname && row.surname.toString().toLowerCase().startsWith(letter)
    );

    // sort by surname ascending
    filtered.sort((a,b) => {
      const sa = (a.surname || '').toString().toLowerCase();
      const sb = (b.surname || '').toString().toLowerCase();
      return sa.localeCompare(sb);
    });

    res.json({ members: filtered });
  } catch (e) {
    console.error('Filter by letter error', e);
    res.status(500).json({ error: 'Server error' });
  }
});


// Fetch full profile + image
router.get("/members/profile/:id", adminOnly, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT *,
        encode(profile_image, 'base64') AS img_base64
       FROM profiles 
       WHERE id = $1`,
      [req.params.id]
    );

    if (!r.rowCount) return res.status(404).json({ error: "Not found" });

    res.json({ profile: r.rows[0] });
  } catch (e) {
    console.error("PROFILE ERROR", e);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
