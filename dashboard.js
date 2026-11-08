
// ================================================
// LIFE EMPOWERMENT FUND - STAFF & ADMIN DASHBOARDS
// FRONT-END DEMO ONLY: data is not saved permanently.
// ================================================

const sampleApplications = [
  {
    id: "LEF-2026-1048", name: "Maria Johnson", email: "maria@example.com",
    date: "Nov 2, 2026", amount: "$5,000", purpose: "Education expenses",
    status: "Submitted", assigned: "Jordan Smith",
    note: "", message: ""
  },
  {
    id: "LEF-2026-1047", name: "David Williams", email: "david@example.com",
    date: "Nov 1, 2026", amount: "$3,500", purpose: "Vehicle repairs",
    status: "Under Review", assigned: "Jordan Smith",
    note: "Reviewing submitted income information.", message: ""
  },
  {
    id: "LEF-2026-1046", name: "Ashley Brown", email: "ashley@example.com",
    date: "Oct 30, 2026", amount: "$2,000", purpose: "Emergency expenses",
    status: "Additional Info Needed", assigned: "Jordan Smith",
    note: "Waiting for supporting documentation.", message: "Please sign in to your account and provide the requested information."
  },
  {
    id: "LEF-2026-1045", name: "Michael Davis", email: "michael@example.com",
    date: "Oct 28, 2026", amount: "$4,000", purpose: "Housing expenses",
    status: "Approved", assigned: "Jordan Smith",
    note: "Decision recorded after staff review.", message: "Your application has been approved."
  },
  {
    id: "LEF-2026-1044", name: "Sofia Garcia", email: "sofia@example.com",
    date: "Oct 26, 2026", amount: "$1,500", purpose: "Medical-related expenses",
    status: "Declined", assigned: "Jordan Smith",
    note: "Demo decision record.", message: "A decision has been made on your application. Please sign in to view the result."
  }
];

let applications = sampleApplications.map(app => ({ ...app }));

let auditLogs = [
  { date: "Nov 4, 2026 · 9:42 AM", user: "Jordan Smith", role: "Staff", category: "Application", action: "Status changed", target: "LEF-2026-1047", details: "Submitted → Under Review" },
  { date: "Nov 4, 2026 · 9:15 AM", user: "Alex Morgan", role: "Admin", category: "Account", action: "Staff account updated", target: "Staff access", details: "Demo employee permissions reviewed" },
  { date: "Nov 3, 2026 · 3:20 PM", user: "Jordan Smith", role: "Staff", category: "Application", action: "Internal note added", target: "LEF-2026-1046", details: "Additional documentation requested" },
  { date: "Nov 3, 2026 · 11:08 AM", user: "Alex Morgan", role: "Admin", category: "System", action: "System settings updated", target: "Email notifications", details: "Notification setting reviewed" },
  { date: "Nov 2, 2026 · 2:35 PM", user: "Jordan Smith", role: "Staff", category: "Application", action: "Decision recorded", target: "LEF-2026-1045", details: "Application approved" }
];

let staffMembers = [
  { name: "Jordan Smith", email: "jordan@lef.example", role: "Staff", active: true },
  { name: "Taylor Reed", email: "taylor@lef.example", role: "Staff", active: true },
  { name: "Alex Morgan", email: "alex@lef.example", role: "Admin", active: true },
  { name: "Casey Lee", email: "casey@lef.example", role: "Staff", active: false }
];

let selectedApplicationId = null;

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function statusClass(status) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function statusPill(status) {
  return `<span class="pill ${statusClass(status)}">${escapeHTML(status)}</span>`;
}

function addAudit(category, action, target, details, user = "Jordan Smith", role = "Staff") {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  auditLogs.unshift({
    date: `${date} · ${time}`,
    user, role, category, action, target, details
  });
}

// ---------- NAVIGATION ----------

const pageTitles = {
  overview: { staff: "Staff Overview", admin: "System Overview" },
  applications: "Loan Applications",
  review: "My Review Queue",
  decisions: "Decision History",
  team: "Staff Accounts",
  audit: "Audit Trail",
  settings: "System Settings"
};

function showPage(page) {
  const target = document.getElementById(page);
  if (!target) return;

  $$(".page").forEach(section => section.classList.remove("active"));
  target.classList.add("active");

  $$(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  const role = document.body.dataset.role;
  const title = typeof pageTitles[page] === "object"
    ? pageTitles[page][role]
    : pageTitles[page];

  $("#page-title").textContent = title || "LEF Dashboard";
  renderAll();
}

$$(".nav-link").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

$$("[data-go]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});

// ---------- STAFF DASHBOARD ----------

function applicationRow(app) {
  return `
    <tr>
      <td><strong>${escapeHTML(app.id)}</strong></td>
      <td class="person-cell"><strong>${escapeHTML(app.name)}</strong><small>${escapeHTML(app.email)}</small></td>
      <td>${escapeHTML(app.date)}</td>
      <td>${escapeHTML(app.amount)}</td>
      <td>${statusPill(app.status)}</td>
      <td><button class="action-btn" data-review="${escapeHTML(app.id)}">Review</button></td>
    </tr>`;
}

function renderApplications() {
  const search = ($("#application-search")?.value || "").toLowerCase();
  const filter = $("#status-filter")?.value || "all";

  const filtered = applications.filter(app => {
    const matchesSearch = `${app.id} ${app.name} ${app.email}`.toLowerCase().includes(search);
    const matchesStatus = filter === "all" || app.status === filter;
    return matchesSearch && matchesStatus;
  });

  $("#applications-table").innerHTML = filtered.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>APPLICATION ID</th><th>APPLICANT</th><th>SUBMITTED</th><th>AMOUNT</th><th>STATUS</th><th>ACTION</th></tr></thead>
        <tbody>${filtered.map(applicationRow).join("")}</tbody>
      </table></div>`
    : `<div class="empty-state">No applications match your search.</div>`;

  $$("[data-review]").forEach(button => {
    button.addEventListener("click", () => openReview(button.dataset.review));
  });
}

function renderQueue() {
  const pending = applications.filter(app =>
    ["Submitted", "Under Review", "Additional Info Needed"].includes(app.status)
  );

  const markup = pending.length
    ? pending.map(app => `
      <div class="queue-item">
        <div class="avatar">${escapeHTML(app.name.split(" ").map(n => n[0]).join("").slice(0, 2))}</div>
        <div class="queue-info">
          <strong>${escapeHTML(app.name)}</strong>
          <small>${escapeHTML(app.id)} · ${escapeHTML(app.date)}</small>
        </div>
        ${statusPill(app.status)}
        <button data-review="${escapeHTML(app.id)}">Review</button>
      </div>`).join("")
    : `<div class="empty-state">Your review queue is clear.</div>`;

  $("#review-queue").innerHTML = markup;
  $("#overview-queue").innerHTML = pending.slice(0, 3).map(app => `
    <div class="queue-item">
      <div class="queue-info"><strong>${escapeHTML(app.name)}</strong><small>${escapeHTML(app.id)} · ${escapeHTML(app.date)}</small></div>
      ${statusPill(app.status)}
      <button data-review="${escapeHTML(app.id)}">Open</button>
    </div>`).join("") || `<div class="empty-state">No pending applications.</div>`;

  $$("[data-review]").forEach(button => {
    button.addEventListener("click", () => openReview(button.dataset.review));
  });
}

function renderDecisions() {
  const decided = applications.filter(app => ["Approved", "Declined"].includes(app.status));

  $("#decisions-table").innerHTML = decided.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>APPLICATION</th><th>APPLICANT</th><th>DECISION</th><th>STAFF NOTE</th></tr></thead>
        <tbody>${decided.map(app => `
          <tr><td>${escapeHTML(app.id)}</td><td>${escapeHTML(app.name)}</td>
          <td>${statusPill(app.status)}</td><td>${escapeHTML(app.note || "No note recorded")}</td></tr>
        `).join("")}</tbody></table></div>`
    : `<div class="empty-state">No decisions have been recorded yet.</div>`;
}

function openReview(id) {
  const app = applications.find(item => item.id === id);
  if (!app) return;

  selectedApplicationId = id;
  $("#modal-name").textContent = app.name;
  $("#modal-id").textContent = `${app.id} · Submitted ${app.date}`;
  $("#modal-details").innerHTML = `
    <div><small>Email</small>${escapeHTML(app.email)}</div>
    <div><small>Requested amount</small>${escapeHTML(app.amount)}</div>
    <div><small>Purpose</small>${escapeHTML(app.purpose)}</div>
    <div><small>Assigned staff</small>${escapeHTML(app.assigned)}</div>
  `;
  $("#new-status").value = app.status;
  $("#internal-note").value = app.note || "";
  $("#decision-reason").value = app.message || "";
  $("#review-modal").classList.add("show");
}

function closeReview() {
  $("#review-modal").classList.remove("show");
  selectedApplicationId = null;
}

$("#close-modal")?.addEventListener("click", closeReview);
$("#review-modal")?.addEventListener("click", event => {
  if (event.target.id === "review-modal") closeReview();
});

$("#save-review")?.addEventListener("click", () => {
  const app = applications.find(item => item.id === selectedApplicationId);
  if (!app) return;

  const previousStatus = app.status;
  const nextStatus = $("#new-status").value;
  const newNote = $("#internal-note").value.trim();
  const newMessage = $("#decision-reason").value.trim();

  if (["Approved", "Declined"].includes(nextStatus) && !newMessage) {
    alert("Please enter an applicant-facing message before recording this decision.");
    return;
  }

  app.status = nextStatus;
  app.note = newNote;
  app.message = newMessage;

  if (previousStatus !== nextStatus) {
    addAudit(
      "Application",
      "Status changed",
      app.id,
      `${previousStatus} → ${nextStatus}`
    );
  }

  if (newNote) {
    addAudit("Application", "Internal note saved", app.id, "Staff note updated");
  }

  if (["Approved", "Declined"].includes(nextStatus) && previousStatus !== nextStatus) {
    addAudit("Application", "Decision recorded", app.id, `Application ${nextStatus.toLowerCase()}`);
  }

  alert("Demo: Review changes saved locally. In the live system, the applicant would receive an email when their status changes.");
  closeReview();
  renderAll();
});

// ---------- ADMIN DASHBOARD ----------

function renderTeam() {
  $("#team-table").innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>EMPLOYEE</th><th>EMAIL</th><th>ROLE</th><th>ACCESS</th><th>ACTION</th></tr></thead>
      <tbody>${staffMembers.map((member, index) => `
        <tr>
          <td><strong>${escapeHTML(member.name)}</strong></td>
          <td>${escapeHTML(member.email)}</td>
          <td>${escapeHTML(member.role)}</td>
          <td>${member.active ? '<span class="pill approved">Active</span>' : '<span class="pill declined">Disabled</span>'}</td>
          <td><button class="action-btn" data-toggle-staff="${index}">${member.active ? "Disable" : "Enable"}</button></td>
        </tr>
      `).join("")}</tbody>
    </table></div>`;

  $$("[data-toggle-staff]").forEach(button => {
    button.addEventListener("click", () => {
      const member = staffMembers[Number(button.dataset.toggleStaff)];
      member.active = !member.active;

      addAudit("Account", member.active ? "Staff account enabled" : "Staff account disabled",
        member.email, `Account access changed for ${member.name}`, "Alex Morgan", "Admin");

      renderAll();
    });
  });
}

function renderAudit() {
  const search = ($("#audit-search")?.value || "").toLowerCase();
  const filter = $("#audit-filter")?.value || "all";

  const filtered = auditLogs.filter(log => {
    const matchesSearch = `${log.user} ${log.action} ${log.target} ${log.details}`.toLowerCase().includes(search);
    const matchesCategory = filter === "all" || log.category === filter;
    return matchesSearch && matchesCategory;
  });

  const markup = filtered.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>DATE / TIME</th><th>USER</th><th>ROLE</th><th>ACTION</th><th>RECORD</th><th>DETAILS</th></tr></thead>
        <tbody>${filtered.map(log => `
          <tr>
            <td>${escapeHTML(log.date)}</td>
            <td>${escapeHTML(log.user)}</td>
            <td>${escapeHTML(log.role)}</td>
            <td><strong>${escapeHTML(log.action)}</strong></td>
            <td>${escapeHTML(log.target)}</td>
            <td>${escapeHTML(log.details)}</td>
          </tr>
        `).join("")}</tbody>
      </table></div>`
    : `<div class="empty-state">No audit events match your search.</div>`;

  $("#audit-table").innerHTML = markup;
  $("#recent-audit").innerHTML = auditLogs.slice(0, 4).map(log => `
    <div class="audit-item">
      <div class="avatar">${escapeHTML(log.user.split(" ").map(n => n[0]).join("").slice(0, 2))}</div>
      <div class="audit-info"><strong>${escapeHTML(log.action)}</strong><small>${escapeHTML(log.user)} · ${escapeHTML(log.target)} · ${escapeHTML(log.date)}</small></div>
    </div>`).join("");
}

$("#add-staff")?.addEventListener("click", () => {
  $("#staff-modal").classList.add("show");
});

$("#close-staff-modal")?.addEventListener("click", () => {
  $("#staff-modal").classList.remove("show");
});

$("#staff-modal")?.addEventListener("click", event => {
  if (event.target.id === "staff-modal") {
    $("#staff-modal").classList.remove("show");
  }
});

$("#save-staff")?.addEventListener("click", () => {
  const name = $("#staff-name").value.trim();
  const email = $("#staff-email").value.trim();
  const role = $("#staff-role").value;

  if (!name || !email || !email.includes("@")) {
    alert("Please enter a name and valid email address.");
    return;
  }

  if (staffMembers.some(member => member.email.toLowerCase() === email.toLowerCase())) {
    alert("That email is already listed.");
    return;
  }

  staffMembers.push({ name, email, role, active: true });
  addAudit("Account", "Staff account added", email, `${role} account added for ${name}`, "Alex Morgan", "Admin");

  $("#staff-name").value = "";
  $("#staff-email").value = "";
  $("#staff-modal").classList.remove("show");
  renderAll();
});

$("#save-settings")?.addEventListener("click", () => {
  const platformName = $("#platform-name").value.trim() || "Life Empowerment Fund";
  const emailEnabled = $("#email-setting").checked;
  const maintenance = $("#maintenance-setting").checked;

  addAudit(
    "System",
    "System settings updated",
    "Platform settings",
    `Name: ${platformName}; Email notifications: ${emailEnabled ? "On" : "Off"}; Maintenance mode: ${maintenance ? "On" : "Off"}`,
    "Alex Morgan",
    "Admin"
  );

  $("#settings-message").textContent = "Demo settings updated locally. They will reset when you refresh.";
  renderAll();
});

// ---------- SEARCH / FILTER EVENTS ----------

$("#application-search")?.addEventListener("input", renderApplications);
$("#status-filter")?.addEventListener("change", renderApplications);
$("#audit-search")?.addEventListener("input", renderAudit);
$("#audit-filter")?.addEventListener("change", renderAudit);

// ---------- DASHBOARD COUNTS / INITIALIZATION ----------

function renderAll() {
  const total = applications.length;
  const pending = applications.filter(app =>
    ["Submitted", "Under Review"].includes(app.status)
  ).length;
  const infoNeeded = applications.filter(app => app.status === "Additional Info Needed").length;
  const decisions = applications.filter(app =>
    ["Approved", "Declined"].includes(app.status)
  ).length;

  if ($("#total-count")) $("#total-count").textContent = total;
  if ($("#pending-count")) $("#pending-count").textContent = pending;
  if ($("#info-count")) $("#info-count").textContent = infoNeeded;
  if ($("#decision-count")) $("#decision-count").textContent = decisions;

  if ($("#staff-count")) $("#staff-count").textContent = staffMembers.length;
  if ($("#active-count")) $("#active-count").textContent = staffMembers.filter(member => member.active).length;
  if ($("#event-count")) $("#event-count").textContent = auditLogs.length;

  if ($("#applications-table")) renderApplications();
  if ($("#review-queue")) renderQueue();
  if ($("#decisions-table")) renderDecisions();
  if ($("#team-table")) renderTeam();
  if ($("#audit-table")) renderAudit();
}

const todayElement = $("#today");
if (todayElement) {
  todayElement.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric"
  });
}

renderAll();
