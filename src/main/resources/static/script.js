const api = "/api";
const $ = (id) => document.getElementById(id);
let assignments = [];
let calendarAssignments = [];
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDate = null;
let assignmentView = localStorage.getItem("studyflow-assignment-view") || "list";

async function request(url, options = {}) {
  const response = await fetch(api + url, { headers: { "Content-Type": "application/json" }, ...options });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.message || "Something went wrong");
  return body;
}

async function refresh() {
  try {
    const params = new URLSearchParams();
    if ($("search").value.trim()) params.set("search", $("search").value.trim());
    if ($("status-filter").value) params.set("status", $("status-filter").value);
    if ($("priority-filter").value) params.set("priority", $("priority-filter").value);
    const [stats, list, allAssignments] = await Promise.all([
      request("/dashboard/stats"),
      request("/assignments?" + params.toString()),
      request("/assignments")
    ]);
    assignments = list;
    calendarAssignments = allAssignments;
    ["total", "pending", "completed", "overdue"].forEach((key) => $(key + "-stat").textContent = stats[key]);
    renderDashboard(stats);
    render();
    renderCalendar();
    renderAnalytics();
    $("analytics-loading").classList.add("hidden");
    $("analytics-content").classList.remove("view-hidden");
  } catch (error) {
    showMessage(error.message, true);
    $("loading").classList.add("hidden");
    if ($("calendar-error")) {
      $("calendar-error").textContent = `Unable to load calendar assignments: ${error.message}`;
      $("calendar-error").classList.remove("hidden");
    }
    if ($("analytics-error")) {
      $("analytics-error").textContent = `Unable to load analytics: ${error.message}`;
      $("analytics-error").classList.remove("hidden");
      $("analytics-loading").classList.add("hidden");
    }
  }
}

function dashboardDateKey(date) {
  return localDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

function renderDashboard(stats) {
  $("focus-pending").textContent = stats.pending;
  $("focus-overdue").textContent = stats.overdue;

  const incomplete = calendarAssignments
    .filter((assignment) => assignment.status !== "COMPLETED")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const next = incomplete[0];
  $("focus-next").innerHTML = next
    ? `<p class="focus-next-label">Next up</p><button class="focus-next-assignment" type="button" data-assignment-id="${next.id}"><span><strong>${escapeHtml(next.title)}</strong><small>${escapeHtml(next.subject)} · ${dashboardDeadlineLabel(next)}</small></span><span class="badge ${next.priority.toLowerCase()}">${label(next.priority)}</span></button>`
    : '<div class="dashboard-empty">You are all caught up. Add a new assignment to keep your momentum going.</div>';
  $("dashboard-deadlines").innerHTML = incomplete.length
    ? incomplete.slice(0, 5).map(dashboardDeadlineMarkup).join("")
    : '<div class="dashboard-empty">No incomplete assignments. Great work!</div>';
  document.querySelectorAll("#focus-next [data-assignment-id], #dashboard-deadlines [data-assignment-id]").forEach((item) => {
    item.addEventListener("click", () => openForm(calendarAssignments.find((assignment) => assignment.id === Number(item.dataset.assignmentId))));
  });
  renderDashboardWeeklyProgress();
}

function dashboardDeadlineLabel(assignment) {
  const todayKey = dashboardDateKey(new Date());
  if (assignment.dueDate < todayKey) return `Overdue · ${formatDate(assignment.dueDate)}`;
  if (assignment.dueDate === todayKey) return "Due today";
  return `Due ${formatDate(assignment.dueDate)}`;
}

function dashboardDeadlineMarkup(assignment) {
  const todayKey = dashboardDateKey(new Date());
  const state = assignment.dueDate < todayKey ? "overdue" : assignment.dueDate === todayKey ? "today" : "upcoming";
  return `<button class="dashboard-deadline ${state}" type="button" data-assignment-id="${assignment.id}"><span class="deadline-date">${formatDate(assignment.dueDate)}</span><span class="deadline-info"><strong>${escapeHtml(assignment.title)}</strong><small>${escapeHtml(assignment.subject)}</small></span><span class="badge ${assignment.priority.toLowerCase()}">${label(assignment.priority)}</span><span class="badge ${assignment.status.toLowerCase().replace("_", "-")}">${state === "overdue" ? "Overdue" : label(assignment.status)}</span></button>`;
}

function renderDashboardWeeklyProgress() {
  const recorded = calendarAssignments.filter((assignment) => assignment.completedAt);
  const chart = $("dashboard-weekly-chart");
  if (!recorded.length) {
    $("weekly-completed-count").textContent = "—";
    chart.innerHTML = '<div class="dashboard-empty">Weekly progress will appear after an assignment is completed. Existing completed assignments without timestamps are excluded.</div>';
    $("dashboard-weekly-note").textContent = "";
    return;
  }
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index));
  const counts = days.map((day, index) => {
    const nextDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return recorded.filter((assignment) => localDateTimeInRange(assignment.completedAt, day, nextDay)).length;
  });
  const total = counts.reduce((sum, count) => sum + count, 0);
  const max = Math.max(1, ...counts);
  $("weekly-completed-count").textContent = total;
  chart.innerHTML = counts.map((count, index) => `<div class="dashboard-week-day"><span>${count || ""}</span><div class="dashboard-week-track"><i style="height:${(count / max) * 100}%"></i></div><small>${days[index].toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</small></div>`).join("");
  $("dashboard-weekly-note").textContent = "Based on recorded completion timestamps from this week.";
}

function render() {
  $("loading").classList.add("hidden");
  const tbody = $("assignment-table").querySelector("tbody");
  tbody.innerHTML = assignments.map((a) => {
    const overdue = a.status !== "COMPLETED" && new Date(a.dueDate + "T00:00:00") < new Date(new Date().toDateString());
    return `<tr><td><span class="assignment-name">${escapeHtml(a.title)}</span><span class="assignment-subject">${escapeHtml(a.subject)}</span></td>
      <td class="${overdue ? "overdue" : ""}">${formatDate(a.dueDate)}${overdue ? '<small class="overdue-label">Overdue</small>' : ""}</td>
      <td><span class="badge ${a.priority.toLowerCase()}">${label(a.priority)}</span></td>
      <td><span class="badge ${a.status.toLowerCase().replace("_", "-")}">${label(a.status)}</span></td>
      <td>${assignmentActionsMarkup(a)}</td></tr>`;
  }).join("");
  $("assignment-cards").innerHTML = assignments.map((a) => {
    const overdue = a.status !== "COMPLETED" && new Date(a.dueDate + "T00:00:00") < new Date(new Date().toDateString());
    return `<article class="assignment-card"><div class="assignment-card-top"><div><span class="assignment-name">${escapeHtml(a.title)}</span><span class="assignment-subject">${escapeHtml(a.subject)}</span></div><span class="badge ${a.status.toLowerCase().replace("_", "-")}">${label(a.status)}</span></div>
      <div class="assignment-card-meta"><span class="${overdue ? "overdue" : ""}">${formatDate(a.dueDate)}${overdue ? '<small class="overdue-label">Overdue</small>' : ""}</span><span class="badge ${a.priority.toLowerCase()}">${label(a.priority)}</span></div>
      ${assignmentActionsMarkup(a)}</article>`;
  }).join("");
  $("empty").classList.toggle("hidden", assignments.length !== 0);
  const hasFilters = Boolean($("search").value.trim() || $("status-filter").value || $("priority-filter").value);
  $("empty-title").textContent = hasFilters ? "No matching assignments" : "No assignments yet";
  $("empty-description").textContent = hasFilters ? "Try a different search or clear the filters to see all assignments." : "Create your first assignment to start organizing your workload.";
  $("empty-add").classList.toggle("hidden", hasFilters);
  $("empty-clear").classList.toggle("hidden", !hasFilters);
  $("assignment-table").classList.toggle("hidden", assignments.length === 0);
  $("assignment-cards").classList.toggle("hidden", assignments.length === 0 || assignmentView !== "card");
  $("table-wrap").classList.toggle("hidden", assignments.length === 0 || assignmentView !== "list");
  updateAssignmentViewControls();
}

function assignmentActionsMarkup(assignment) {
  return `<div class="actions"><button class="icon-button" title="Edit assignment" aria-label="Edit ${escapeHtml(assignment.title)}" onclick="editAssignment(${assignment.id})">✎</button><button class="icon-button" title="Delete assignment" aria-label="Delete ${escapeHtml(assignment.title)}" onclick="deleteAssignment(${assignment.id})">⌫</button>${assignment.status !== "COMPLETED" ? `<button class="icon-button" title="Mark completed" aria-label="Mark ${escapeHtml(assignment.title)} completed" onclick="completeAssignment(${assignment.id})">✓</button>` : ""}</div>`;
}

function updateAssignmentViewControls() {
  const cardView = assignmentView === "card";
  $("list-view-button").classList.toggle("active", !cardView);
  $("card-view-button").classList.toggle("active", cardView);
  $("list-view-button").setAttribute("aria-pressed", String(!cardView));
  $("card-view-button").setAttribute("aria-pressed", String(cardView));
}

function setAssignmentView(view) {
  assignmentView = view;
  localStorage.setItem("studyflow-assignment-view", view);
  render();
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportAssignmentsCsv() {
  if (!calendarAssignments.length) {
    showMessage("There are no assignments to export.", true);
    return;
  }
  const headers = ["ID", "Title", "Subject", "Description", "Due Date", "Priority", "Status", "Created Date", "Completed Date"];
  const rows = calendarAssignments.map((assignment) => [
    assignment.id,
    assignment.title,
    assignment.subject,
    assignment.description,
    assignment.dueDate,
    label(assignment.priority),
    label(assignment.status),
    assignment.createdAt || assignment.createdDate || "",
    assignment.completedAt || ""
  ]);
  const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
  const downloadUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "studyflow-assignments.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
  showMessage(`Exported ${calendarAssignments.length} assignment${calendarAssignments.length === 1 ? "" : "s"}.`);
}

function label(value) { return value.toLowerCase().replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function formatDate(date) { return new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
function showMessage(text, error = false) { $("message").textContent = text; $("message").classList.toggle("error", error); setTimeout(() => $("message").textContent = "", 4000); }
function openForm(assignment = null) {
  $("assignment-form").reset(); $("assignment-id").value = assignment?.id || ""; $("dialog-title").textContent = assignment ? "Edit assignment" : "Add assignment";
  if (assignment) { $("title").value = assignment.title; $("subject").value = assignment.subject; $("description").value = assignment.description; $("due-date").value = assignment.dueDate; $("priority").value = assignment.priority; $("status").value = assignment.status; }
  $("assignment-dialog").showModal();
}
async function editAssignment(id) { openForm(assignments.find((a) => a.id === id)); }
async function deleteAssignment(id) { if (!confirm("Delete this assignment? This cannot be undone.")) return; try { await request("/assignments/" + id, { method: "DELETE" }); showMessage("Assignment deleted."); refresh(); } catch (e) { showMessage(e.message, true); } }
async function completeAssignment(id) { try { await request("/assignments/" + id + "/complete", { method: "PATCH" }); showMessage("Assignment marked as completed."); refresh(); } catch (e) { showMessage(e.message, true); } }

function showView(view) {
  const activeView = ["assignments", "calendar", "analytics"].includes(view) ? view : "dashboard";
  $("dashboard").classList.toggle("view-hidden", activeView !== "dashboard");
  $("assignments").classList.toggle("view-hidden", activeView !== "assignments");
  $("calendar").classList.toggle("view-hidden", activeView !== "calendar");
  $("analytics").classList.toggle("view-hidden", activeView !== "analytics");
  document.querySelectorAll(".sidebar nav a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === "#" + activeView);
  });
  const viewCopy = {
    dashboard: ["Student workspace", "Good morning", "A calm place to plan, focus, and finish."],
    assignments: ["Workspace", "Your assignments", "Keep your coursework organized and moving forward."],
    calendar: ["Deadline planner", "Assignment calendar", "See what is due and plan your time ahead."],
    analytics: ["Progress overview", "Assignment analytics", "Understand your workload and completion progress."]
  }[activeView];
  $("page-eyebrow").textContent = viewCopy[0];
  $("page-title").textContent = viewCopy[1];
  const titleAccent = document.createElement("span");
  titleAccent.className = "accent";
  titleAccent.textContent = ".";
  $("page-title").append(titleAccent);
  $("page-subtitle").textContent = viewCopy[2];
  document.body.classList.remove("sidebar-open");
}

function localDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localDateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isOverdue(assignment) {
  const today = new Date();
  const todayKey = localDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  return assignment.status !== "COMPLETED" && assignment.dueDate < todayKey;
}

function calendarAssignmentClass(assignment) {
  if (isOverdue(assignment)) return "overdue";
  return assignment.status.toLowerCase().replace("_", "-");
}

function renderCalendar() {
  if (!$("calendar-grid")) return;
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  $("calendar-month").textContent = calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const cells = [];
  const totalCells = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;
  for (let index = 0; index < totalCells; index += 1) {
    const dayOffset = index - mondayOffset;
    const cellDate = new Date(year, month, dayOffset + 1);
    const day = cellDate.getDate();
    const inMonth = cellDate.getMonth() === month;
    const dateKey = localDateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
    const dueAssignments = calendarAssignments.filter((assignment) => assignment.dueDate === dateKey);
    cells.push(`<button type="button" class="calendar-day ${inMonth ? "" : "outside-month"} ${selectedDate === dateKey ? "selected" : ""}" data-date="${dateKey}"><span class="day-number">${day}</span>${dueAssignments.slice(0, 3).map((assignment) => `<span class="calendar-assignment ${calendarAssignmentClass(assignment)}" data-assignment-id="${assignment.id}">${escapeHtml(assignment.title)}</span>`).join("")}${dueAssignments.length > 3 ? `<span class="more-count">+${dueAssignments.length - 3} more</span>` : ""}</button>`);
  }
  $("calendar-grid").innerHTML = cells.join("");
  $("calendar-grid").querySelectorAll(".calendar-day").forEach((day) => day.addEventListener("click", () => selectCalendarDate(day.dataset.date, day.classList.contains("outside-month"))));
  $("calendar-grid").querySelectorAll(".calendar-assignment").forEach((item) => item.addEventListener("click", (event) => {
    event.stopPropagation();
    openForm(calendarAssignments.find((assignment) => assignment.id === Number(item.dataset.assignmentId)));
  }));
  const monthAssignments = calendarAssignments.filter((assignment) => assignment.dueDate.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`));
  $("calendar-empty").classList.toggle("hidden", monthAssignments.length !== 0);
  renderUpcoming();
  if (selectedDate) {
    renderSelectedDay();
  } else {
    $("selected-day-title").textContent = "Select a date";
    $("selected-day-assignments").innerHTML = "";
  }
}

function selectCalendarDate(dateKey, outsideMonth = false) {
  if (outsideMonth) {
    const clickedDate = localDateFromKey(dateKey);
    calendarMonth = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), 1);
  }
  selectedDate = dateKey;
  renderCalendar();
}

function renderSelectedDay() {
  const date = localDateFromKey(selectedDate);
  $("selected-day-title").textContent = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const dueAssignments = calendarAssignments.filter((assignment) => assignment.dueDate === selectedDate);
  $("selected-day-assignments").innerHTML = dueAssignments.length ? dueAssignments.map(calendarDeadlineMarkup).join("") : '<div class="calendar-empty-message">No assignments are due on this date.</div>';
  $("selected-day-assignments").querySelectorAll("[data-assignment-id]").forEach((item) => item.addEventListener("click", () => openForm(calendarAssignments.find((assignment) => assignment.id === Number(item.dataset.assignmentId)))));
}

function calendarDeadlineMarkup(assignment) {
  return `<button type="button" class="deadline-item ${calendarAssignmentClass(assignment)}" data-assignment-id="${assignment.id}"><span><strong>${escapeHtml(assignment.title)}</strong><small>${escapeHtml(assignment.subject)}</small></span><span class="badge ${assignment.status.toLowerCase().replace("_", "-")}">${isOverdue(assignment) ? "Overdue" : label(assignment.status)}</span></button>`;
}

function renderUpcoming() {
  const upcoming = calendarAssignments.filter((assignment) => assignment.status !== "COMPLETED").sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
  $("upcoming-deadlines").innerHTML = upcoming.length ? upcoming.map((assignment) => `<button type="button" class="deadline-item ${calendarAssignmentClass(assignment)}" data-assignment-id="${assignment.id}"><span><strong>${escapeHtml(assignment.title)}</strong><small>${formatDate(assignment.dueDate)} · ${escapeHtml(assignment.subject)}</small></span><span class="badge ${assignment.priority.toLowerCase()}">${label(assignment.priority)}</span></button>`).join("") : '<div class="calendar-empty-message">No upcoming deadlines.</div>';
  $("upcoming-deadlines").querySelectorAll("[data-assignment-id]").forEach((item) => item.addEventListener("click", () => openForm(calendarAssignments.find((assignment) => assignment.id === Number(item.dataset.assignmentId)))));
}

function renderAnalytics() {
  const total = calendarAssignments.length;
  const completed = calendarAssignments.filter((assignment) => assignment.status === "COMPLETED").length;
  const pending = total - completed;
  const overdue = calendarAssignments.filter(isOverdue).length;
  $("analytics-total").textContent = total;
  $("analytics-completed").textContent = completed;
  $("analytics-pending").textContent = pending;
  $("analytics-overdue").textContent = overdue;
  $("analytics-percentage").textContent = total ? `${Math.round((completed / total) * 100)}%` : "0%";

  const statusGroups = [
    ["Pending", calendarAssignments.filter((assignment) => assignment.status === "PENDING").length, "pending"],
    ["In progress", calendarAssignments.filter((assignment) => assignment.status === "IN_PROGRESS").length, "in-progress"],
    ["Completed", completed, "completed"],
    ["Overdue", overdue, "overdue"]
  ];
  const statusMax = Math.max(1, ...statusGroups.map((group) => group[1]));
  $("status-chart").innerHTML = statusGroups.map(([name, count, style]) => `<div class="bar-row"><span>${name}</span><div class="bar-track"><div class="bar-fill ${style}" style="width:${(count / statusMax) * 100}%"></div></div><strong>${count}</strong></div>`).join("");

  const subjects = {};
  calendarAssignments.forEach((assignment) => {
    subjects[assignment.subject] ??= { total: 0, completed: 0 };
    subjects[assignment.subject].total += 1;
    if (assignment.status === "COMPLETED") subjects[assignment.subject].completed += 1;
  });
  const subjectRows = Object.entries(subjects).sort(([a], [b]) => a.localeCompare(b));
  $("subject-chart").innerHTML = subjectRows.length ? subjectRows.map(([subject, values]) => `<div class="subject-row"><div class="subject-label"><strong>${escapeHtml(subject)}</strong><span>${values.completed}/${values.total} completed</span></div><div class="bar-track"><div class="bar-fill subject" style="width:${(values.completed / values.total) * 100}%"></div></div></div>`).join("") : '<div class="analytics-empty">No assignment data is available yet.</div>';
  renderWeeklyCompletions();
}

function renderWeeklyCompletions() {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const weeks = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - ((5 - index) * 7));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const count = calendarAssignments.filter((assignment) => assignment.completedAt && localDateTimeInRange(assignment.completedAt, start, end)).length;
    return { start, count };
  });
  const max = Math.max(1, ...weeks.map((week) => week.count));
  $("weekly-chart").innerHTML = weeks.map((week) => `<div class="weekly-column"><span>${week.count}</span><div class="weekly-bar-track"><div class="weekly-bar" style="height:${(week.count / max) * 100}%"></div></div><small>${week.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></div>`).join("");
  const recorded = calendarAssignments.filter((assignment) => assignment.completedAt).length;
  $("weekly-note").textContent = recorded ? `${recorded} completion${recorded === 1 ? "" : "s"} have a recorded timestamp. Existing completed assignments without a timestamp are excluded from this chart.` : "No completion timestamps have been recorded yet. Weekly history will appear as assignments are completed.";
}

function localDateTimeInRange(value, start, end) {
  const [datePart, timePart = "00:00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = "0"] = timePart.split(":").map(Number);
  const completion = new Date(year, month - 1, day, hour, minute, second);
  return completion >= start && completion < end;
}

function initializeApp() {
  const savedTheme = localStorage.getItem("studyflow-theme") || "light";
  document.documentElement.dataset.theme = savedTheme;
  $("theme-toggle").addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("studyflow-theme", theme);
    $("theme-toggle").setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  });
  $("open-sidebar").addEventListener("click", () => document.body.classList.add("sidebar-open"));
  $("close-sidebar").addEventListener("click", () => document.body.classList.remove("sidebar-open"));
  $("sidebar-overlay").addEventListener("click", () => document.body.classList.remove("sidebar-open"));
  $("list-view-button").addEventListener("click", () => setAssignmentView("list"));
  $("card-view-button").addEventListener("click", () => setAssignmentView("card"));
  $("export-csv").addEventListener("click", exportAssignmentsCsv);
  $("empty-add").addEventListener("click", () => openForm());
  $("empty-clear").addEventListener("click", () => {
    $("search").value = "";
    $("status-filter").value = "";
    $("priority-filter").value = "";
    refresh();
  });
  $("focus-assignments").addEventListener("click", () => { window.location.hash = "assignments"; });
  $("dashboard-add-assignment").addEventListener("click", () => openForm());
  updateAssignmentViewControls();
  $("assignment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = $("assignment-id").value;
    const payload = { title: $("title").value, subject: $("subject").value, description: $("description").value, dueDate: $("due-date").value, priority: $("priority").value, status: $("status").value };
    try { await request("/assignments" + (id ? "/" + id : ""), { method: id ? "PUT" : "POST", body: JSON.stringify(payload) }); $("assignment-dialog").close(); showMessage(id ? "Assignment updated." : "Assignment added."); refresh(); } catch (e) { showMessage(e.message, true); }
  });
  $("add-button").onclick = () => openForm(); $("add-top").onclick = () => openForm(); $("close-dialog").onclick = () => $("assignment-dialog").close(); $("cancel-dialog").onclick = () => $("assignment-dialog").close();
  ["search", "status-filter", "priority-filter"].forEach((id) => $(id).addEventListener("input", refresh));
  $("calendar-prev").onclick = $("calendar-prev-mobile").onclick = () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1); selectedDate = null; renderCalendar(); };
  $("calendar-next").onclick = $("calendar-next-mobile").onclick = () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1); selectedDate = null; renderCalendar(); };
  $("calendar-today").onclick = () => { const today = new Date(); calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1); selectedDate = localDateKey(today.getFullYear(), today.getMonth(), today.getDate()); renderCalendar(); };
  window.addEventListener("hashchange", () => showView(window.location.hash.slice(1)));
  showView(window.location.hash.slice(1));
  refresh();
}

document.addEventListener("DOMContentLoaded", initializeApp);
