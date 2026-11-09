const $ = id => document.getElementById(id);
let token = localStorage.getItem("cc_token") || "";
let currentUser = null;
let complaints = [];
let authMode = "login";

function toast(message, error = false) {
  const el = $("toast"); el.textContent = message;
  el.style.background = error ? "#9d3939" : "#24233b";
  el.classList.add("show"); clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 3000);
}
async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) logout(false);
    throw new Error(data.message || "Something went wrong.");
  }
  return data;
}
function setAuthMode(mode) {
  authMode = mode;
  $("loginTab").classList.toggle("active", mode === "login");
  $("registerTab").classList.toggle("active", mode === "register");
  $("nameField").hidden = mode !== "register";
  $("name").required = mode === "register";
  $("authTitle").textContent = mode === "login" ? "Welcome back" : "Create your account";
  $("authSubtitle").textContent = mode === "login" ? "Sign in to submit and track your complaints." : "Join CampusCare to make your voice heard.";
  $("authSubmit").innerHTML = mode === "login" ? 'Sign in <span>→</span>' : 'Create account <span>→</span>';
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
}
$("loginTab").onclick = () => setAuthMode("login");
$("registerTab").onclick = () => setAuthMode("register");
$("authForm").onsubmit = async e => {
  e.preventDefault();
  const body = { email: $("email").value, password: $("password").value };
  if (authMode === "register") body.name = $("name").value;
  try {
    const result = await api(`/api/auth/${authMode === "login" ? "login" : "register"}`, { method: "POST", body: JSON.stringify(body) });
    token = result.token; currentUser = result.user; localStorage.setItem("cc_token", token);
    showApp(true); toast(authMode === "login" ? "Welcome back!" : "Account created successfully!");
  } catch (err) { toast(err.message, true); }
};
async function boot() {
  if (!token) return showAuth();
  try { currentUser = await api("/api/auth/me"); showApp(false); }
  catch { showAuth(); }
}
function showAuth() { $("authView").hidden = false; $("appView").hidden = true; }
function pageFromHash() {
  const page = location.hash.replace(/^#\/?/, "");
  return ["dashboard", "complaints", "new-complaint"].includes(page) ? page : "dashboard";
}
function navigateTo(page) {
  const hash = `#/${page}`;
  if (location.hash === hash) renderPage();
  else location.hash = hash;
}
function renderPage() {
  if (!currentUser) return;
  const admin = currentUser.role === "admin";
  const page = pageFromHash();
  if (admin && page === "new-complaint") return navigateTo("dashboard");
  $("studentDashboard").hidden = admin || page !== "dashboard";
  $("adminDashboard").hidden = !admin || page !== "dashboard";
  $("studentComplaints").hidden = admin || page !== "complaints";
  $("adminComplaints").hidden = !admin || page !== "complaints";
  $("formView").hidden = page !== "new-complaint";
  $("navDashboard").classList.toggle("active", page === "dashboard");
  $("navComplaints").classList.toggle("active", page === "complaints");
  $("navNew").classList.toggle("active", page === "new-complaint");
  $("pageTitle").textContent = page === "dashboard" ? "Dashboard"
    : page === "new-complaint" ? "New complaint"
    : admin ? "All complaints" : "My complaints";
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", renderPage);
function showApp(resetRoute) {
  $("authView").hidden = true; $("appView").hidden = false;
  const admin = currentUser.role === "admin";
  $("sideName").textContent = currentUser.name; $("sideRole").textContent = admin ? "Administrator" : "Student";
  $("topName").textContent = currentUser.name; $("avatar").textContent = currentUser.name[0].toUpperCase(); $("topAvatar").textContent = currentUser.name[0].toUpperCase();
  $("welcomeTitle").textContent = `Hello, ${currentUser.name.split(" ")[0]} 👋`;
  document.querySelectorAll("[data-student-only]").forEach(el => el.hidden = admin);
  $("navNew").hidden = admin;
  $("pageEyebrow").textContent = admin ? "ADMIN PORTAL" : "STUDENT PORTAL";
  if (resetRoute) navigateTo("dashboard");
  else {
    if (!location.hash) history.replaceState(null, "", `${location.pathname}${location.search}#/dashboard`);
    renderPage();
  }
  loadComplaints();
}
function logout(showMessage = true) {
  token = ""; currentUser = null; complaints = []; localStorage.removeItem("cc_token");
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  showAuth(); if (showMessage) toast("You have signed out.");
}
$("logoutBtn").onclick = () => logout();
$("navDashboard").onclick = () => navigateTo("dashboard");
$("navComplaints").onclick = () => navigateTo("complaints");
$("navNew").onclick = () => navigateTo("new-complaint");
$("newComplaintBtn").onclick = () => navigateTo("new-complaint");
$("backBtn").onclick = () => navigateTo("dashboard");
$("cancelForm").onclick = () => navigateTo("dashboard");
document.querySelectorAll('input[name="priority"]').forEach(input => input.addEventListener("change", () => {
  document.querySelectorAll(".priority-choice").forEach(el => el.classList.remove("selected"));
  input.closest(".priority-choice").classList.add("selected");
}));
$("complaintForm").onsubmit = async e => {
  e.preventDefault();
  const body = {
    title: $("complaintTitle").value, category: $("category").value,
    description: $("description").value,
    priority: document.querySelector('input[name="priority"]:checked').value
  };
  try {
    await api("/api/complaints", { method: "POST", body: JSON.stringify(body) });
    $("complaintForm").reset();
    document.querySelector('input[name="priority"][value="Medium"]').checked = true;
    document.querySelectorAll(".priority-choice").forEach(el => el.classList.toggle("selected", el.querySelector("input").value === "Medium"));
    toast("Complaint submitted successfully."); navigateTo("complaints"); await loadComplaints();
  } catch (err) { toast(err.message, true); }
};
async function loadComplaints() {
  try {
    complaints = await api("/api/complaints");
    if (currentUser.role === "admin") {
      const stats = await api("/api/dashboard");
      $("aTotal").textContent = stats.total; $("aPending").textContent = stats.pending;
      $("aProgress").textContent = stats.inProgress; $("aResolved").textContent = stats.resolved;
      renderAdmin();
    } else renderStudent();
  } catch (err) { toast(err.message, true); }
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function date(value) { return new Date(value).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }); }
function statusClass(status) { return status === "In Progress" ? "status-in-progress" : `status-${status.toLowerCase()}`; }
function priorityClass(priority) { return `priority-${(priority || "Medium").toLowerCase()}`; }
function card(c, admin = false) {
  return `<article class="complaint-card"><div class="complaint-main">
    <div class="complaint-top"><span class="complaint-title">${esc(c.title)}</span><span class="pill ${statusClass(c.status)}">${esc(c.status)}</span><span class="pill ${priorityClass(c.priority)}">${esc(c.priority || "Medium")} priority</span></div>
    <p class="complaint-desc">${esc(c.description)}</p>
    <div class="meta"><span>▧ ${esc(c.category)}</span>${admin ? `<span>♙ ${esc(c.studentName)}</span>` : ""}<span>◷ ${date(c.createdAt)}</span><span>ID: ${esc(c.id)}</span></div>
  </div><div class="card-actions">${admin ? `<button class="small-btn" onclick="openAdminEdit('${esc(c.id)}')">Manage ↗</button>` : `<button class="small-btn" onclick="openDetails('${esc(c.id)}')">View details ↗</button>`}</div></article>`;
}
function emptyHTML() { return '<div class="empty"><strong>No complaints found</strong>Try changing your search or submit a new complaint.</div>'; }
function renderStudent() {
  const total = complaints.length, pending = complaints.filter(c => c.status === "Pending").length;
  $("sTotal").textContent = total; $("sPending").textContent = pending;
  $("sProgress").textContent = complaints.filter(c => c.status === "In Progress").length;
  $("sResolved").textContent = complaints.filter(c => c.status === "Resolved").length;
  const q = $("studentSearch").value.toLowerCase(), status = $("studentStatus").value;
  const filtered = complaints.filter(c => (!status || c.status === status) && `${c.title} ${c.description} ${c.category}`.toLowerCase().includes(q));
  $("studentList").innerHTML = filtered.length ? filtered.map(c => card(c)).join("") : emptyHTML();
}
function renderAdmin() {
  const q = $("adminSearch").value.toLowerCase(), status = $("adminStatus").value, priority = $("adminPriority").value;
  const filtered = complaints.filter(c => (!status || c.status === status) && (!priority || (c.priority || "Medium") === priority) && `${c.title} ${c.description} ${c.category} ${c.studentName}`.toLowerCase().includes(q));
  // Urgent complaints are shown first, then newest complaints.
  const rank = { High: 0, Medium: 1, Low: 2 };
  filtered.sort((a,b) => rank[a.priority || "Medium"] - rank[b.priority || "Medium"] || new Date(b.createdAt)-new Date(a.createdAt));
  $("adminList").innerHTML = filtered.length ? filtered.map(c => card(c, true)).join("") : emptyHTML();
}
["studentSearch","studentStatus"].forEach(id => $(id).addEventListener("input", renderStudent));
["adminSearch","adminStatus","adminPriority"].forEach(id => $(id).addEventListener("input", renderAdmin));
function openDetails(id) {
  const c = complaints.find(x => x.id === id); if (!c) return;
  $("modalContent").innerHTML = `<span class="modal-label">COMPLAINT DETAILS · ${esc(c.id)}</span><h3>${esc(c.title)}</h3><div class="complaint-top"><span class="pill ${statusClass(c.status)}">${esc(c.status)}</span><span class="pill ${priorityClass(c.priority)}">${esc(c.priority || "Medium")} priority</span></div><p class="modal-description">${esc(c.description)}</p><p class="meta">Category: ${esc(c.category)} · Submitted: ${date(c.createdAt)}</p>${c.adminNote ? `<div class="admin-note"><strong>Administrator update</strong><br>${esc(c.adminNote)}</div>` : '<p class="field-hint">No administrator note yet.</p>'}`;
  $("detailModal").hidden = false;
}
window.openDetails = openDetails;
window.openAdminEdit = id => {
  const c = complaints.find(x => x.id === id); if (!c) return;
  $("modalContent").innerHTML = `<span class="modal-label">MANAGE COMPLAINT · ${esc(c.id)}</span><h3>${esc(c.title)}</h3><p class="modal-description">${esc(c.description)}</p><p class="meta">Submitted by ${esc(c.studentName)} · ${esc(c.category)} · ${date(c.createdAt)}</p>
  <div class="field"><label for="editStatus">Complaint status</label><select id="editStatus"><option ${c.status==="Pending"?"selected":""}>Pending</option><option ${c.status==="In Progress"?"selected":""}>In Progress</option><option ${c.status==="Resolved"?"selected":""}>Resolved</option></select></div>
  <div class="field"><label for="editPriority">Priority</label><select id="editPriority"><option ${c.priority==="Low"?"selected":""}>Low</option><option ${(c.priority||"Medium")==="Medium"?"selected":""}>Medium</option><option ${c.priority==="High"?"selected":""}>High</option></select></div>
  <div class="field"><label for="editNote">Update / note for student (optional)</label><textarea id="editNote" rows="3" maxlength="500" placeholder="Add an update about the action taken…">${esc(c.adminNote || "")}</textarea></div>
  <div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveAdminEdit('${esc(c.id)}')">Save changes</button></div>`;
  $("detailModal").hidden = false;
};
window.saveAdminEdit = async id => {
  try {
    await api(`/api/complaints/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({
      status: $("editStatus").value, priority: $("editPriority").value, adminNote: $("editNote").value
    })});
    closeModal(); toast("Complaint updated."); await loadComplaints();
  } catch (err) { toast(err.message, true); }
};
function closeModal() { $("detailModal").hidden = true; }
$("modalClose").onclick = closeModal; $("modalBackdrop").onclick = closeModal;
boot();
