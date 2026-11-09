const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "replace-this-secret-before-deployment";
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], complaints: [] }, null, 2));
  }
  const db = readDB();
  let changed = false;
  db.complaints = db.complaints.map(c => {
    if (!c.priority) { changed = true; return { ...c, priority: "Medium" }; }
    return c;
  });
  if (changed) writeDB(db);
}
function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return { users: [], complaints: [] }; }
}
function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function createToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
}
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Please log in first." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Your session expired. Please log in again." });
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access only." });
  next();
}
const clean = value => String(value || "").trim();

app.post("/api/auth/register", async (req, res) => {
  const name = clean(req.body.name);
  const email = clean(req.body.email).toLowerCase();
  const password = String(req.body.password || "");
  if (!name || !email || password.length < 6)
    return res.status(400).json({ message: "Enter your name, valid email and password (at least 6 characters)." });
  const db = readDB();
  if (db.users.some(u => u.email === email))
    return res.status(409).json({ message: "An account with this email already exists." });
  const user = {
    id: "u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    name, email, passwordHash: await bcrypt.hash(password, 10), role: "student",
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  writeDB(db);
  res.status(201).json({
    token: createToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

app.post("/api/auth/login", async (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  const password = String(req.body.password || "");
  const db = readDB();
  const user = db.users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ message: "Incorrect email or password." });
  res.json({
    token: createToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

app.get("/api/auth/me", auth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: "Account not found." });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.post("/api/complaints", auth, (req, res) => {
  const title = clean(req.body.title);
  const description = clean(req.body.description);
  const category = clean(req.body.category);
  const priority = clean(req.body.priority);
  const allowedCategories = ["Classroom", "Hostel", "Library", "Canteen", "Transport", "Cleanliness", "Electrical", "Other"];
  if (!title || title.length < 4 || !description || description.length < 10 ||
      !allowedCategories.includes(category) || !["Low", "Medium", "High"].includes(priority)) {
    return res.status(400).json({ message: "Please complete all fields. Title needs 4+ characters and description 10+ characters." });
  }
  const db = readDB();
  const complaint = {
    id: "C" + Date.now().toString().slice(-8) + Math.random().toString(36).slice(2, 5).toUpperCase(),
    studentId: req.user.id,
    studentName: req.user.name,
    title, description, category, priority,
    status: "Pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    adminNote: ""
  };
  db.complaints.unshift(complaint);
  writeDB(db);
  res.status(201).json(complaint);
});

app.get("/api/complaints", auth, (req, res) => {
  const db = readDB();
  const complaints = req.user.role === "admin"
    ? db.complaints
    : db.complaints.filter(c => c.studentId === req.user.id);
  res.json(complaints.map(c => ({ ...c, priority: c.priority || "Medium" })));
});

app.patch("/api/complaints/:id", auth, adminOnly, (req, res) => {
  const db = readDB();
  const complaint = db.complaints.find(c => c.id === req.params.id);
  if (!complaint) return res.status(404).json({ message: "Complaint not found." });
  const { status, priority, adminNote } = req.body;
  if (status !== undefined && !["Pending", "In Progress", "Resolved"].includes(status))
    return res.status(400).json({ message: "Invalid status." });
  if (priority !== undefined && !["Low", "Medium", "High"].includes(priority))
    return res.status(400).json({ message: "Invalid priority." });
  if (status !== undefined) complaint.status = status;
  if (priority !== undefined) complaint.priority = priority;
  if (adminNote !== undefined) complaint.adminNote = clean(adminNote).slice(0, 500);
  complaint.updatedAt = new Date().toISOString();
  writeDB(db);
  res.json(complaint);
});

app.get("/api/dashboard", auth, adminOnly, (req, res) => {
  const complaints = readDB().complaints;
  res.json({
    total: complaints.length,
    pending: complaints.filter(c => c.status === "Pending").length,
    inProgress: complaints.filter(c => c.status === "In Progress").length,
    resolved: complaints.filter(c => c.status === "Resolved").length,
    highPriority: complaints.filter(c => (c.priority || "Medium") === "High").length
  });
});

// Create the first administrator automatically for the demo.
async function seedAdmin() {
  const db = readDB();
  if (!db.users.some(u => u.email === "admin@college.edu")) {
    db.users.push({
      id: "admin_001", name: "College Administrator", email: "admin@college.edu",
      passwordHash: await bcrypt.hash("Admin@123", 10), role: "admin",
      createdAt: new Date().toISOString()
    });
    writeDB(db);
    console.log("Demo admin created: admin@college.edu / Admin@123");
  }
}

ensureDatabase();
seedAdmin().then(() => {
  app.listen(PORT, () => console.log(`Student Complaint Box running at http://localhost:${PORT}`));
});
