// ==========================================
// 0. UPDATE SAFETY NET
// Right after a new version is published, a browser can briefly mix cached old files with new
// ones. If that breaks something, offer a one-click reload instead of leaving a half-drawn page.
// ==========================================
window.addEventListener('error', e => {
  // Only our own files; ignore browser extensions and third-party scripts
  if (!e.filename || !e.filename.startsWith(location.origin)) return;
  if (document.getElementById('update-reload-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'update-reload-bar';
  bar.className = 'fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-stone-900 text-amber-50 text-sm shadow-2xl';
  bar.innerHTML = '<span>☀️ Sunbeam was just updated.</span>';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold';
  btn.textContent = 'Reload';
  btn.addEventListener('click', () => location.reload());
  bar.appendChild(btn);
  (document.body || document.documentElement).appendChild(bar);
});

// ==========================================
// 1. HELPERS
// ==========================================
function formatYMD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYMD(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(ymd, days) {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() + days);
  return formatYMD(d);
}

// ---------- Planner time zone & work week ----------
// Every plan's date and time is a wall-clock time in PLANNER_TZ (Cairo by default), so the
// planner behaves the same even if the computer's own clock is set to another zone.
const CFG = window.SUNBEAM_CONFIG || {};
const PLANNER_TZ = (() => {
  try {
    const tz = CFG.timeZone || 'Africa/Cairo';
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch (e) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
})();
const WEEK_STARTS_ON = Number.isInteger(CFG.weekStartsOn) ? CFG.weekStartsOn : 0;
const WORK_DAYS = Array.isArray(CFG.workDays) ? CFG.workDays : [0, 1, 2, 3, 4];
const WORK_HOURS = { start: (CFG.workHours && CFG.workHours.start) || '09:00', end: (CFG.workHours && CFG.workHours.end) || '17:00' };
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const zoneFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PLANNER_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

// Wall-clock parts of an instant in the planner zone
function zonedParts(date) {
  const p = Object.fromEntries(zoneFormatter.formatToParts(date).map(x => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}`, hour: Number(p.hour) };
}

// The instant at which the planner zone's clock shows ymd + hm (DST-safe: corrects the guess twice)
function zonedToDate(ymd, hm) {
  const [y, mo, d] = ymd.split('-').map(Number);
  const [h, mi] = (hm || '00:00').split(':').map(Number);
  const target = Date.UTC(y, mo - 1, d, h || 0, mi || 0);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess));
    const [py, pm, pd] = p.ymd.split('-').map(Number);
    const [ph, pmi] = p.hm.split(':').map(Number);
    guess += target - Date.UTC(py, pm - 1, pd, ph, pmi);
  }
  return new Date(guess);
}

function todayYMD() {
  return zonedParts(new Date()).ymd;
}

function taskStartDate(task) {
  return zonedToDate(task.date, task.time || '09:00');
}

function monthOf(ymd) {
  const [year, month] = ymd.split('-').map(Number);
  return { year, month: month - 1 };
}

function weekdayOf(ymd) {
  return parseYMD(ymd).getDay();
}

function isWorkDay(ymd) {
  return WORK_DAYS.includes(weekdayOf(ymd));
}

function workHoursLabel() {
  const days = WORK_DAYS.length ? `${DAY_SHORT[WORK_DAYS[0]]}–${DAY_SHORT[WORK_DAYS[WORK_DAYS.length - 1]]}` : '';
  return `${days}, ${shortTime(WORK_HOURS.start)}–${shortTime(WORK_HOURS.end)}`;
}

// "9 AM" instead of "9:00 AM" when on the hour
function shortTime(hm) {
  return formatTime12(hm).replace(':00', '');
}

// Why a time falls outside working hours, or '' if it's inside them. All-day plans count as inside.
function outsideWorkReason(date, time, duration = 60) {
  if (!date) return '';
  if (!isWorkDay(date)) return `${DAY_SHORT[weekdayOf(date)]} is a weekend day`;
  if (!time) return '';
  const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const start = toMin(time);
  if (start < toMin(WORK_HOURS.start)) return 'starts before working hours';
  if (start + Number(duration || 0) > toMin(WORK_HOURS.end)) return 'runs past working hours';
  return '';
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uid() {
  return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function formatTime12(time) {
  if (!time) return 'All day';
  const [h, m] = time.split(':').map(Number);
  // Format the wall-clock time itself; a fixed UTC date avoids daylight-saving gaps
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

function relativeFromNow(date) {
  const mins = Math.round((date.getTime() - Date.now()) / 60000);
  if (Math.abs(mins) < 1) return 'now';
  const abs = Math.abs(mins);
  const label = abs < 60 ? `${abs}m` : abs < 1440 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / 1440)}d`;
  return mins > 0 ? `in ${label}` : `${label} ago`;
}

function sortByTime(a, b) {
  return (a.date + (a.time || '00:00')).localeCompare(b.date + (b.time || '00:00'));
}

// ==========================================
// 2. CONSTANTS
// ==========================================
// Each life area has its own Nile colour: lapis, terracotta, faience and saffron
const CATEGORIES = {
  Work: { label: 'Work', icon: 'briefcase', stripe: '#2A4A91', bar: 'bg-sky-600', tag: 'bg-sky-50 text-sky-800 border-sky-200' },
  Personal: { label: 'Personal', icon: 'house', stripe: '#C8553D', bar: 'bg-rose-500', tag: 'bg-rose-50 text-rose-800 border-rose-200' },
  Health: { label: 'Health', icon: 'heart-pulse', stripe: '#1F9488', bar: 'bg-emerald-500', tag: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  Learning: { label: 'Learning', icon: 'book-open', stripe: '#E9AE30', bar: 'bg-amber-400', tag: 'bg-amber-50 text-amber-800 border-amber-200' }
};

const PRIORITIES = {
  high: { label: 'High', icon: 'flame', tag: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', chipOn: 'bg-rose-50 border-rose-300 text-rose-700 font-bold shadow-xs', chipOff: 'bg-white border-rose-200 text-rose-700 font-medium' },
  medium: { label: 'Medium', icon: 'zap', tag: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500', chipOn: 'bg-amber-50 border-amber-300 text-amber-800 font-bold shadow-xs', chipOff: 'bg-white border-amber-200 text-amber-800 font-medium' },
  low: { label: 'Chill', icon: 'coffee', tag: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', chipOn: 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold shadow-xs', chipOff: 'bg-white border-emerald-200 text-emerald-700 font-medium' }
};

const celebrations = [
  { emoji: '🌻', msg: 'One less thing on your plate! Take a slow, happy breath.' },
  { emoji: '🍪', msg: "Beautifully done! You've earned a stretch or a warm treat." },
  { emoji: '✨', msg: 'Look at you moving through today with grace!' },
  { emoji: '☕', msg: 'Checked off! Your future self is smiling right now.' },
  { emoji: '🌿', msg: "Step by step — you're making real progress today." },
  { emoji: '🎉', msg: 'Crossed off and out of your head.' }
];

const ranks = [
  { threshold: 0, title: 'Cozy Start', icon: 'sprout', desc: "Every good day begins gently. Pick one small thing whenever you're ready." },
  { threshold: 1, title: 'Warming Up', icon: 'coffee', desc: "You've set your rhythm in motion! Keep going at your own comfortable pace." },
  { threshold: 50, title: 'Steady Flow', icon: 'flower-2', desc: "Halfway through today's list! You're balancing things wonderfully." },
  { threshold: 80, title: 'Radiant Momentum', icon: 'sparkles', desc: 'Almost everything wrapped up — what a thoughtful, productive day.' },
  { threshold: 100, title: 'Day Complete', icon: 'crown', desc: 'All done! Relax your shoulders and enjoy your evening.' }
];

const REMINDER_LEAD_MIN = 15;

// ==========================================
// 3. STATE
// ==========================================
let tasks = [];
let activeView = 'day';
let currentFilter = 'all';
let selectedPriority = 'medium';
let selectedDate = todayYMD();
let currentWeekOffset = 0;
let currentMonthYear = monthOf(todayYMD());
let lastKnownToday = todayYMD();

let userName = '';
let settingsSavedAt = 0;      // when settings/local plans last changed (ms), to merge with the Outlook backup
let userMood = 'steady';
let dailyIntention = '';
let outlookEmail = '';
let msClientIdOverride = '';
let msTenantOverride = '';
let autoSyncDefault = true;
let emailScope = 'day';
let isEveningMode = false;
let hiddenOutlookIds = [];
let firedReminderKeys = [];

let focusTotalSeconds = 25 * 60;
let focusRemainingSeconds = 25 * 60;
let focusEndsAt = null;
let focusIntervalId = null;
let focusedTaskId = null;
let focusSessionsCompleted = 0;

let searchQuery = '';
let searchAllDates = false;
let openSubtaskInputTaskId = null;
let toastTimeout = null;
let outlookBusy = false;

function normalizeTask(t) {
  const validDate = typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date);
  const validTime = typeof t.time === 'string' && /^\d{2}:\d{2}$/.test(t.time);
  return {
    id: String(t.id || uid()),
    text: String(t.text || 'Untitled plan').slice(0, 300),
    date: validDate ? t.date : todayYMD(),
    time: validTime ? t.time : '',
    duration: Number(t.duration) > 0 ? Number(t.duration) : 60,
    category: CATEGORIES[t.category] ? t.category : 'Work',
    priority: PRIORITIES[t.priority] ? t.priority : 'medium',
    reminder: !!t.reminder,
    completed: !!t.completed,
    subtasks: Array.isArray(t.subtasks)
      ? t.subtasks.map(st => ({ id: String(st.id || uid()), text: String(st.text || ''), done: !!st.done })).filter(st => st.text)
      : [],
    source: t.source === 'outlook' ? 'outlook' : 'sunbeam',
    outlookEventId: t.outlookEventId || null,
    webLink: t.webLink || null,
    seriesId: t.seriesId || null,
    attendees: parseEmails(Array.isArray(t.attendees) ? t.attendees.join(',') : ''),
    // Plans made in Sunbeam are always yours; imported meetings are only editable if you organised them
    isOrganizer: t.source === 'outlook' ? !!t.isOrganizer : true,
    // Edits made while signed out, waiting to be sent to Outlook
    needsSync: !!t.needsSync,
    needsAttendeeSync: !!t.needsAttendeeSync,
    // You unticked "Add to my Outlook calendar" for this plan
    keepLocal: !!t.keepLocal
  };
}

const EMAIL_RE = /^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/;

// Accepts "a@x.com, b@y.com; Name <c@z.com>" and returns unique lowercase addresses
function parseEmails(text) {
  const found = String(text || '')
    .split(/[,;\s]+/)
    .map(s => s.replace(/^.*</, '').replace(/>.*$/, '').trim().toLowerCase())
    .filter(s => EMAIL_RE.test(s));
  return [...new Set(found)];
}

function invalidEmails(text) {
  return String(text || '').split(/[,;]+/).map(s => s.trim()).filter(s => s && !EMAIL_RE.test(s.replace(/^.*</, '').replace(/>.*$/, '').trim()));
}

// Only flag work plans and meetings; a personal plan in the evening is perfectly normal
function workOutsideHours(task) {
  const workish = task.category === 'Work' || task.source === 'outlook' || task.attendees.length > 0;
  return workish ? outsideWorkReason(task.date, task.time, task.duration) : '';
}

function setHoursHint(hintEl, { date, time, duration, category, guests, source }) {
  const reason = workOutsideHours({ date, time, duration, category, attendees: guests, source });
  hintEl.textContent = reason ? `☾ Outside working hours (${workHoursLabel()}): ${reason}.` : '';
  hintEl.classList.toggle('hidden', !reason);
}

function updateFormHoursHint() {
  setHoursHint($('task-hours-hint'), {
    date: taskDateInput.value,
    time: taskTimeInput.value,
    duration: Number(taskDurationSelect.value),
    category: taskCategorySelect.value,
    guests: parseEmails($('task-invitees-input').value),
    source: 'sunbeam'
  });
}

function canEdit(task) {
  return task.source === 'sunbeam' || task.isOrganizer;
}

// The old demo plans; removed from anyone's list on load so they never get pushed to Outlook
const DEMO_PLAN_TEXTS = new Set([
  'Morning stretch & a glass of water', 'Focus block: wrap up main project priorities', 'Reply to key emails & clear inbox',
  'Pick up groceries & unwind for dinner', 'Prepare weekly team notes', 'Read 20 pages of a favourite book',
  'Catch-up call with family', 'Nature walk & coffee break'
]);

function readStored(key, fallback, parse = false) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return parse ? JSON.parse(raw) : raw;
  } catch (e) {
    return fallback;
  }
}

// Each value is read on its own, so one damaged entry can never wipe out your plans
function loadSavedState() {
  const raw = readStored('sunbeam_tasks_v1', null);
  if (raw) {
    try {
      tasks = JSON.parse(raw)
        .filter(t => !String(t.id).startsWith('outlook-demo-') && !(String(t.id).startsWith('graph-') && !t.outlookEventId))
        .filter(t => !(DEMO_PLAN_TEXTS.has(t.text) && !t.outlookEventId))
        .map(normalizeTask);
    } catch (e) {
      // Keep the unreadable copy aside instead of overwriting it
      try { localStorage.setItem(`sunbeam_tasks_unreadable_${Date.now()}`, raw); } catch (err) {}
      tasks = [];
    }
  }

  const storedName = readStored('sunbeam_user_name', '');
  userName = storedName && storedName !== 'friend' ? storedName : defaultName();
  userMood = readStored('sunbeam_user_mood', 'steady');
  outlookEmail = readStored('sunbeam_outlook_email', '');
  msClientIdOverride = readStored('sunbeam_ms_client_id', '');
  msTenantOverride = readStored('sunbeam_ms_tenant', '');
  autoSyncDefault = readStored('sunbeam_autosync', 'true') !== 'false';
  emailScope = readStored('sunbeam_email_scope', 'day');
  hiddenOutlookIds = readStored('sunbeam_hidden_outlook_ids', [], true);
  firedReminderKeys = readStored('sunbeam_fired_reminders', [], true);
  if (!Array.isArray(hiddenOutlookIds)) hiddenOutlookIds = [];
  if (!Array.isArray(firedReminderKeys)) firedReminderKeys = [];
  settingsSavedAt = Number(readStored('sunbeam_settings_saved_at', '0')) || 0;

  const savedTheme = readStored('sunbeam_evening_mode', null);
  isEveningMode = savedTheme === null ? window.matchMedia('(prefers-color-scheme: dark)').matches : savedTheme === 'true';

  // Intention and focus count are per day
  if (readStored('sunbeam_day_stamp', '') === todayYMD()) {
    dailyIntention = readStored('sunbeam_daily_intention', '');
    focusSessionsCompleted = parseInt(readStored('sunbeam_focus_sessions', '0'), 10) || 0;
  }
}

// Your first name: set in config.js, else from your Microsoft account
function defaultName() {
  if (CFG.ownerName) return CFG.ownerName;
  const full = (Outlook.account && Outlook.account.name) || '';
  return full.trim().split(/\s+/)[0] || 'there';
}

function saveState() {
  try {
    localStorage.setItem('sunbeam_tasks_v1', JSON.stringify(tasks));
    localStorage.setItem('sunbeam_user_name', userName);
    localStorage.setItem('sunbeam_user_mood', userMood);
    localStorage.setItem('sunbeam_daily_intention', dailyIntention);
    localStorage.setItem('sunbeam_outlook_email', outlookEmail);
    localStorage.setItem('sunbeam_ms_client_id', msClientIdOverride);
    localStorage.setItem('sunbeam_ms_tenant', msTenantOverride);
    localStorage.setItem('sunbeam_autosync', autoSyncDefault ? 'true' : 'false');
    localStorage.setItem('sunbeam_settings_saved_at', String(settingsSavedAt));
    localStorage.setItem('sunbeam_email_scope', emailScope);
    localStorage.setItem('sunbeam_evening_mode', isEveningMode ? 'true' : 'false');
    localStorage.setItem('sunbeam_focus_sessions', String(focusSessionsCompleted));
    localStorage.setItem('sunbeam_day_stamp', todayYMD());
    localStorage.setItem('sunbeam_hidden_outlook_ids', JSON.stringify(hiddenOutlookIds.slice(-500)));
    localStorage.setItem('sunbeam_fired_reminders', JSON.stringify(firedReminderKeys.slice(-300)));
  } catch (e) {}
  scheduleCloudSave();
}

function effectiveClientId() {
  return msClientIdOverride || (window.SUNBEAM_CONFIG && window.SUNBEAM_CONFIG.clientId) || '';
}

// Apps registered for a single organisation must sign in through that organisation's endpoint, not /common.
function effectiveAuthority() {
  if (msTenantOverride) return `https://login.microsoftonline.com/${msTenantOverride}`;
  return (window.SUNBEAM_CONFIG && window.SUNBEAM_CONFIG.authority) || 'https://login.microsoftonline.com/common';
}

function effectiveTenant() {
  return effectiveAuthority().replace(/\/+$/, '').split('/').pop();
}

function initOutlook() {
  return Outlook.init(effectiveClientId(), effectiveAuthority());
}

// ==========================================
// 4. DOM REFERENCES
// ==========================================
const $ = id => document.getElementById(id);

const taskForm = $('task-form');
const taskInput = $('task-input');
const taskSubtasksInput = $('task-subtasks-input');
const taskDateInput = $('task-date-input');
const taskTimeInput = $('task-time-input');
const taskDurationSelect = $('task-duration-select');
const taskCategorySelect = $('task-category-select');
const taskRecurSelect = $('task-recur-select');
const taskReminderCheck = $('task-reminder-check');
const taskAutosyncCheck = $('task-autosync-check');
const taskList = $('task-list');
const emptyState = $('empty-state');
const toastContainer = $('toast-container');
const priorityChips = document.querySelectorAll('.priority-chip');
const filterTabs = document.querySelectorAll('.filter-tab');
const navTabs = document.querySelectorAll('.nav-tab');
const moodBtns = document.querySelectorAll('.mood-btn');
const timerPresetBtns = document.querySelectorAll('.timer-preset-btn');
const emailScopeBtns = document.querySelectorAll('.email-scope-btn');

const views = {
  day: $('view-day-container'),
  week: $('view-week-container'),
  month: $('view-month-container'),
  analysis: $('view-analysis-container'),
  reminders: $('view-reminders-container'),
  outlook: $('view-outlook-container')
};

// ==========================================
// 5. FEEDBACK: TOAST & CONFETTI
// ==========================================
function triggerConfetti(isGrand = false) {
  if (typeof confetti !== 'function') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (isGrand) {
    confetti({ particleCount: 110, spread: 85, origin: { y: 0.6 } });
  } else {
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.75 }, ticks: 180 });
  }
}

function showToast(msg, emoji = '☀️', title = 'Sunbeam') {
  if (toastTimeout) clearTimeout(toastTimeout);
  $('toast-emoji').textContent = emoji;
  $('toast-title').textContent = title;
  $('toast-msg').textContent = msg;
  toastContainer.classList.remove('-translate-y-24', 'opacity-0');
  toastContainer.classList.add('translate-y-0', 'opacity-100');
  toastTimeout = setTimeout(() => {
    toastContainer.classList.remove('translate-y-0', 'opacity-100');
    toastContainer.classList.add('-translate-y-24', 'opacity-0');
  }, 3800);
}

function celebrate(dayComplete) {
  if (dayComplete) {
    sounds.playFanfare();
    triggerConfetti(true);
    showToast('Everything on today\'s list is complete! Enjoy a well-deserved rest.', '👑', 'Day complete');
  } else {
    const item = celebrations[Math.floor(Math.random() * celebrations.length)];
    sounds.playComplete();
    triggerConfetti(false);
    showToast(item.msg, item.emoji, 'Little victory!');
  }
}

// ==========================================
// 6. OUTLOOK GLUE
// ==========================================
function appendSyncLog(msg, isError = false) {
  const logBox = $('graph-sync-log');
  if (!logBox) return;
  if (logBox.dataset.empty !== 'false') {
    logBox.innerHTML = '';
    logBox.dataset.empty = 'false';
  }
  const nowStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: PLANNER_TZ });
  const line = el('div', isError ? 'text-rose-600' : '', `[${nowStr}] ${msg}`);
  logBox.prepend(line);
}

function outlookStatus() {
  if (!Outlook.canSignIn) return 'file';
  if (!effectiveClientId()) return 'unconfigured';
  if (Outlook.initError) return 'error';
  if (!Outlook.connected) return 'ready';
  if (Outlook.needsReconnect) return 'expired';
  return 'connected';
}

function refreshOutlookUI() {
  const status = outlookStatus();
  const connected = status === 'connected';
  const user = Outlook.account ? Outlook.account.username : '';

  const pillStyles = {
    connected: ['bg-emerald-100 text-emerald-900 border-emerald-300', `Connected · ${user}`],
    expired: ['bg-amber-100 text-amber-900 border-amber-300', 'Sign-in expired'],
    ready: ['bg-sky-100 text-sky-900 border-sky-200', 'Ready to connect'],
    unconfigured: ['bg-amber-100 text-amber-900 border-amber-200', 'Setup needed'],
    file: ['bg-rose-100 text-rose-900 border-rose-200', 'Needs a web address'],
    error: ['bg-rose-100 text-rose-900 border-rose-200', 'Sign-in unavailable']
  };
  const descs = {
    connected: 'Sunbeam keeps your calendar and plans in step automatically: when you sign in, when you open it, and every 15 minutes. Your plans are backed up in Outlook, so signing in on any browser brings them back.',
    expired: 'Microsoft asks you to sign in again about once a day. Your plans are safe; press Sign in again to pick up where you left off.',
    ready: 'Sign in with your Microsoft account to link your calendar and email.',
    unconfigured: 'Finish the one-time setup below to link Sunbeam to your Microsoft account.',
    file: 'Microsoft sign-in needs Sunbeam to be served from a web address (GitHub Pages or localhost), not opened as a file.',
    error: Outlook.initError
  };

  const pill = $('graph-connection-pill');
  pill.className = `text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${pillStyles[status][0]}`;
  pill.textContent = pillStyles[status][1];
  $('graph-connection-desc').textContent = descs[status];

  const loginBtn = $('ms-graph-login-btn');
  loginBtn.textContent = connected ? 'Sign out' : status === 'expired' ? 'Sign in again' : status === 'ready' ? 'Connect Microsoft account' : 'Open setup';
  loginBtn.className = connected
    ? 'h-10 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-bold rounded-xl transition-all'
    : 'h-10 px-4 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm';

  $('ms-graph-sync-now-btn').disabled = !connected || outlookBusy;
  $('ms-graph-pull-btn').disabled = !connected || outlookBusy;
  $('graph-send-email-btn').disabled = !connected || outlookBusy;

  const unsynced = tasks.filter(needsPush).length;
  $('sync-now-desc').textContent = unsynced
    ? `${unsynced} open ${unsynced === 1 ? 'plan isn\'t' : 'plans aren\'t'} on your calendar yet`
    : 'Everything open is already on your calendar';

  const onCalendar = tasks.filter(t => t.outlookEventId).length;
  $('synced-count-badge').textContent = `${onCalendar} on calendar`;

  $('file-protocol-warning').classList.toggle('hidden', status !== 'file');
  if (status === 'unconfigured' || status === 'file') $('outlook-setup-details').open = true;

  // Header chip
  $('header-outlook-dot').className = `w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : status === 'expired' ? 'bg-amber-500 animate-pulse' : status === 'ready' ? 'bg-sky-500' : 'bg-stone-400'}`;
  $('header-outlook-label').textContent = connected ? (outlookBusy ? 'Syncing…' : 'Outlook on') : status === 'expired' ? 'Sign in again' : 'Outlook off';

  // Quick card on day view
  const quick = $('quick-outlook-status');
  quick.textContent = connected ? (outlookBusy ? 'Syncing…' : user) : pillStyles[status][1];
  quick.className = `text-[10px] px-2 py-0.5 rounded-full font-semibold truncate max-w-[60%] ${connected ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`;
  $('quick-outlook-desc').textContent = connected
    ? 'Plans you add land on your Outlook calendar automatically.'
    : 'Connect your Microsoft account to put plans on your calendar and email yourself the day.';

  // Form badge
  const badge = $('form-sync-badge');
  badge.textContent = connected ? 'Connected' : 'Not connected';
  badge.className = `text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${connected ? 'bg-sky-100 text-sky-800' : 'bg-stone-100 text-stone-600'}`;

  const emailInput = $('outlook-email-input');
  if (emailInput && document.activeElement !== emailInput) {
    emailInput.value = outlookEmail || user;
  }
}

async function withOutlookBusy(fn) {
  outlookBusy = true;
  refreshOutlookUI();
  try {
    return await fn();
  } finally {
    outlookBusy = false;
    refreshOutlookUI();
  }
}

function describeGraphError(err) {
  if (err && (err.errorCode === 'popup_window_error' || err.errorCode === 'empty_window_error')) {
    return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.';
  }
  if (err && err.errorCode === 'user_cancelled') return 'Sign-in was cancelled.';
  if (err && /AADSTS50194/.test(err.message)) {
    return 'Your app is registered for your organisation only. Enter your organisation domain (e.g. cef-eg.org) under Outlook → One-time setup, then press Save and connect again.';
  }
  if (err && /AADSTS50011/.test(err.message)) {
    return `The redirect URI isn't registered. In Entra, add ${Outlook.redirectUri()} as a Single-page application redirect URI.`;
  }
  if (err && /AADSTS9002326/.test(err.message)) {
    return 'The redirect URI is registered as "Web". In Entra, move it to the "Single-page application" platform.';
  }
  if (err && err.status === 403) return 'Microsoft refused the request. Your organisation may need an admin to approve Sunbeam\'s permissions.';
  return (err && err.message) || String(err);
}

async function connectOrDisconnectOutlook() {
  const status = outlookStatus();
  if (status === 'connected') {
    await Outlook.signOut();
    appendSyncLog('Signed out of Microsoft.');
    showToast('Signed out of Outlook. Your plans stay here.', '👋', 'Outlook');
    refreshOutlookUI();
    return;
  }
  if (status !== 'ready' && status !== 'expired') {
    switchView('outlook');
    $('outlook-setup-details').open = true;
    $('ms-client-id-input').focus();
    return;
  }
  try {
    const account = await Outlook.signIn();
    appendSyncLog(`Signed in as ${account.username}`);
    sounds.playComplete();
    showToast(`Welcome back, ${userName}! Bringing in your calendar…`, '🔐', 'Outlook');
    refreshOutlookUI();
    render();
    await syncWithOutlook({ quiet: false });
  } catch (err) {
    appendSyncLog(`Sign-in failed: ${describeGraphError(err)}`, true);
    showToast(describeGraphError(err), '⚠️', 'Outlook');
    if (/AADSTS50194/.test(err && err.message)) {
      $('outlook-setup-details').open = true;
      $('ms-tenant-input').focus();
    }
  }
}

async function pushTaskToOutlook(task, { quiet = false, attendeesChanged = false } = {}) {
  if (!Outlook.connected) return false;
  // Imported meetings can only be changed (never created) and only if you organised them
  if (task.source === 'outlook' && (!task.isOrganizer || !task.outlookEventId)) return false;
  try {
    if (task.outlookEventId) {
      await Outlook.updateEvent(task, { attendeesChanged: attendeesChanged || task.needsAttendeeSync });
      if (task.needsSync) appendSyncLog(`Updated "${task.text}" in Outlook`);
    } else {
      const ev = await Outlook.createEvent(task);
      task.outlookEventId = ev.id;
      task.webLink = ev.webLink;
      appendSyncLog(`Added "${task.text}" to Outlook (${task.date} ${task.time || ''})${task.attendees.length ? ` and invited ${task.attendees.join(', ')}` : ''}`);
    }
    task.needsSync = false;
    task.needsAttendeeSync = false;
    task.keepLocal = false;
    saveState();
    if (!quiet) render();
    return true;
  } catch (err) {
    if (err.status === 404 && task.outlookEventId) {
      // The event was deleted in Outlook; forget the link so it can be re-added.
      task.outlookEventId = null;
      task.webLink = null;
      saveState();
    } else if (err.reconnect && task.outlookEventId) {
      // Try again after you sign in again
      task.needsSync = true;
      saveState();
    }
    appendSyncLog(`Couldn't sync "${task.text}": ${describeGraphError(err)}`, true);
    return false;
  }
}

async function pushUnsyncedTasks() {
  const pending = tasks.filter(needsPush);
  if (pending.length === 0) {
    showToast('Everything open is already on your calendar.', '☁️', 'Outlook');
    return;
  }
  await withOutlookBusy(async () => {
    let ok = 0;
    for (const t of pending) {
      if (await pushTaskToOutlook(t, { quiet: true })) ok++;
    }
    render();
    sounds.playComplete();
    showToast(`Synced ${ok} of ${pending.length} plans with your Outlook calendar.`, '🔄', 'Outlook');
  });
}

// Open plans not on the calendar yet, plus any edits made while signed out
function needsPush(t) {
  return t.needsSync || (t.source === 'sunbeam' && !t.outlookEventId && !t.completed && !t.keepLocal);
}

// ---------- Reading your calendar ----------
// Outlook is the long-term memory: plans made in Sunbeam carry their details inside the event,
// so after a browser wipe, signing in brings everything back.
const loadedMonths = new Set();   // "YYYY-MM" ranges fetched this session
let lastFullSyncAt = 0;

function stripDone(subject) {
  return String(subject || '').replace(/^✓\s*/, '');
}

function eventFields(ev) {
  const startDt = fromGraphUtc(ev.start.dateTime);
  const endDt = fromGraphUtc(ev.end.dateTime);
  return {
    text: stripDone(ev.subject) || '(No title)',
    date: ev.isAllDay ? ev.start.dateTime.slice(0, 10) : zonedParts(startDt).ymd,
    time: ev.isAllDay ? '' : zonedParts(startDt).hm,
    duration: Math.max(15, Math.round((endDt - startDt) / 60000)),
    webLink: ev.webLink || null,
    isOrganizer: !!ev.isOrganizer,
    attendees: (ev.attendees || []).map(a => (a.emailAddress && a.emailAddress.address || '').toLowerCase()).filter(Boolean)
  };
}

// Apply stored Sunbeam details, keeping step ids stable where the text matches
function applyMeta(task, meta) {
  if (!meta) return;
  if (CATEGORIES[meta.category]) task.category = meta.category;
  if (PRIORITIES[meta.priority]) task.priority = meta.priority;
  if (typeof meta.completed === 'boolean') task.completed = meta.completed;
  if (typeof meta.reminder === 'boolean') task.reminder = meta.reminder;
  if (meta.seriesId) task.seriesId = meta.seriesId;
  if (Array.isArray(meta.subtasks)) {
    task.subtasks = meta.subtasks.map(st => {
      const same = task.subtasks.find(x => x.text === st.text);
      return { id: same ? same.id : uid(), text: String(st.text || ''), done: !!st.done };
    }).filter(st => st.text);
  }
}

// Fetch Outlook events between two dates (YYYY-MM-DD, end exclusive) and merge them in
async function pullOutlookRange(startYmd, endYmd) {
  const events = await Outlook.listEvents(zonedToDate(startYmd, '00:00'), zonedToDate(endYmd, '00:00'));
  const seen = new Set();
  let added = 0, updated = 0;

  events.forEach(ev => {
    if (ev.isCancelled || hiddenOutlookIds.includes(ev.id)) return;
    seen.add(ev.id);
    const fields = eventFields(ev);
    const ours = !!ev.sunbeam || (Array.isArray(ev.categories) && ev.categories.includes('Sunbeam'));
    // Details for meetings with guests (and imported meetings) live in the settings backup
    const meta = cloudMeetingMeta[ev.id] || ev.sunbeam;
    const existing = tasks.find(t => t.outlookEventId === ev.id);

    if (existing) {
      if (existing.needsSync) return; // your unsent edit wins; it gets pushed
      const before = JSON.stringify([existing.text, existing.date, existing.time, existing.duration, existing.attendees]);
      Object.assign(existing, fields);
      // Details from Outlook only fill in once per session, so ticks you make now aren't undone
      if (meta && !metaAppliedThisSession.has(ev.id)) applyMeta(existing, meta);
      metaAppliedThisSession.add(ev.id);
      if (before !== JSON.stringify([existing.text, existing.date, existing.time, existing.duration, existing.attendees])) updated++;
      return;
    }

    const task = normalizeTask({
      ...fields,
      id: uid(),
      source: ours ? 'sunbeam' : 'outlook',
      outlookEventId: ev.id,
      category: 'Work',
      priority: 'medium',
      reminder: !!ev.isReminderOn,
      completed: ours && /^✓/.test(ev.subject || '')
    });
    task.isOrganizer = ours ? true : !!ev.isOrganizer;
    applyMeta(task, meta);
    metaAppliedThisSession.add(ev.id);
    tasks.push(task);
    added++;
  });

  // Anything linked to Outlook in this range that's gone was deleted or cancelled in Outlook
  const before = tasks.length;
  tasks = tasks.filter(t => !(t.outlookEventId && !t.needsSync && t.date >= startYmd && t.date < endYmd && !seen.has(t.outlookEventId)));
  return { added, updated, removed: before - tasks.length };
}

function monthRange(year, month) {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return [start, formatYMD(new Date(year, month + 1, 1))];
}

// Full sync: settings backup first, then last month through two months ahead
async function syncWithOutlook({ quiet = true } = {}) {
  if (!Outlook.connected || outlookBusy) return;
  await withOutlookBusy(async () => {
    try {
      await loadCloudSettings();
      const now = monthOf(todayYMD());
      const totals = { added: 0, updated: 0, removed: 0 };
      for (const d of [-1, 0, 1, 2]) {
        const m = new Date(now.year, now.month + d, 1);
        const [a, b] = monthRange(m.getFullYear(), m.getMonth());
        const r = await pullOutlookRange(a, b);
        loadedMonths.add(a.slice(0, 7));
        totals.added += r.added;
        totals.updated += r.updated;
        totals.removed += r.removed;
      }
      lastFullSyncAt = Date.now();
      saveState();
      render();
      appendSyncLog(`Synced with Outlook: ${totals.added} new, ${totals.updated} changed, ${totals.removed} removed.`);
      if (!quiet) {
        sounds.playAdd();
        showToast(`Calendar synced: ${totals.added} new, ${totals.updated} changed.`, '📥', 'Outlook');
      }
      // Plans edited or created while signed out go up now
      const pending = tasks.filter(t => t.needsSync || (autoSyncDefault && needsPush(t)));
      for (const t of pending) await pushTaskToOutlook(t, { quiet: true });
      if (pending.length) render();
    } catch (err) {
      appendSyncLog(`Sync failed: ${describeGraphError(err)}`, true);
      if (!quiet || err.reconnect) showToast(describeGraphError(err), err.reconnect ? '🔐' : '⚠️', 'Outlook');
    }
  });
}

// Make sure the month(s) you're looking at have been fetched from Outlook
async function ensureMonthsLoaded(ymdList) {
  if (!Outlook.connected || Outlook.needsReconnect || !cloudReady || outlookBusy) return;
  const missing = [...new Set(ymdList.map(d => d.slice(0, 7)))].filter(m => !loadedMonths.has(m));
  if (!missing.length) return;
  missing.forEach(m => loadedMonths.add(m));
  try {
    for (const m of missing) {
      const [y, mo] = m.split('-').map(Number);
      const [a, b] = monthRange(y, mo - 1);
      await pullOutlookRange(a, b);
    }
    saveState();
    render();
  } catch (err) {
    missing.forEach(m => loadedMonths.delete(m));
    appendSyncLog(`Couldn't load that month from Outlook: ${describeGraphError(err)}`, true);
  }
}

// Kept for the "Import Outlook events" buttons
function pullOutlookEvents({ quiet = false } = {}) {
  return syncWithOutlook({ quiet });
}

// ---------- Settings backup on your calendar ----------
// Holds what isn't inside an event: your name and preferences, plans not on the calendar,
// done/steps for meetings with guests (changing those events would email the guests) and
// hidden meetings.
let cloudMeetingMeta = {};
const metaAppliedThisSession = new Set();
let deletedLocalIds = [];
let cloudReady = false;          // don't upload until the backup has been read once
let lastCloudJson = '';
let cloudSaveTimer = null;
const CLOUD_MAX_CHARS = 30000;

function buildCloudSettings() {
  const meetingMeta = {};
  tasks
    .filter(t => t.outlookEventId && (t.source === 'outlook' || t.attendees.length))
    .slice(-300)
    .forEach(t => { meetingMeta[t.outlookEventId] = planMeta(t); });
  const data = {
    v: 1,
    userName, userMood, outlookEmail, emailScope, autoSyncDefault, isEveningMode,
    hiddenOutlookIds: hiddenOutlookIds.slice(-300),
    meetingMeta,
    localPlans: tasks.filter(t => !t.outlookEventId && t.source === 'sunbeam').map(t => ({
      id: t.id, text: t.text, date: t.date, time: t.time, duration: t.duration, category: t.category,
      priority: t.priority, completed: t.completed, reminder: t.reminder, attendees: t.attendees, keepLocal: t.keepLocal,
      subtasks: t.subtasks.map(st => ({ text: st.text, done: st.done }))
    })),
    deletedIds: deletedLocalIds.slice(-300)
  };
  // Stay within what Outlook will store: drop the oldest finished, then the oldest local plans
  while (JSON.stringify(data).length > CLOUD_MAX_CHARS && data.localPlans.length) {
    const doneIdx = data.localPlans.findIndex(p => p.completed);
    data.localPlans.splice(doneIdx >= 0 ? doneIdx : 0, 1);
  }
  return data;
}

function scheduleCloudSave() {
  if (!cloudReady || !Outlook.connected) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(saveCloudSettings, 2500);
}

async function saveCloudSettings() {
  if (!cloudReady || !Outlook.connected || Outlook.needsReconnect) return;
  const data = buildCloudSettings();
  const json = JSON.stringify(data);
  if (json === lastCloudJson) return;
  settingsSavedAt = Date.now();
  try {
    await Outlook.saveSettings({ ...data, savedAt: settingsSavedAt });
    lastCloudJson = json;
    try { localStorage.setItem('sunbeam_settings_saved_at', String(settingsSavedAt)); } catch (e) {}
  } catch (err) {
    appendSyncLog(`Couldn't back up settings to Outlook: ${describeGraphError(err)}`, true);
  }
}

async function loadCloudSettings() {
  let remote = null;
  try {
    remote = await Outlook.loadSettings();
  } catch (err) {
    if (err.reconnect) throw err;
    appendSyncLog(`Couldn't read the settings backup: ${describeGraphError(err)}`, true);
  }
  if (remote && remote.v === 1) {
    cloudMeetingMeta = remote.meetingMeta || {};
    if ((remote.savedAt || 0) > settingsSavedAt) {
      if (remote.userName) userName = remote.userName;
      if (remote.userMood) userMood = remote.userMood;
      if (typeof remote.outlookEmail === 'string') outlookEmail = remote.outlookEmail;
      if (remote.emailScope) emailScope = remote.emailScope;
      if (typeof remote.autoSyncDefault === 'boolean') autoSyncDefault = remote.autoSyncDefault;
      if (typeof remote.isEveningMode === 'boolean') isEveningMode = remote.isEveningMode;
      settingsSavedAt = remote.savedAt;
      applyEveningThemeUI();
      applyMoodUI();
      taskAutosyncCheck.checked = autoSyncDefault;
    }
    hiddenOutlookIds = [...new Set([...hiddenOutlookIds, ...(remote.hiddenOutlookIds || [])])];
    deletedLocalIds = [...new Set([...deletedLocalIds, ...(remote.deletedIds || [])])];
    // Plans that only live in Sunbeam: add any this browser doesn't have (and you didn't delete)
    (remote.localPlans || []).forEach(p => {
      if (tasks.some(t => t.id === p.id) || deletedLocalIds.includes(p.id)) return;
      tasks.push(normalizeTask({ ...p, source: 'sunbeam' }));
    });
  }
  // Remember what's in the cloud now, then allow uploads of later changes
  lastCloudJson = remote ? JSON.stringify(buildCloudSettings()) : '';
  cloudReady = true;
  scheduleCloudSave();
}

// ---------- Email digest ----------
function digestTasks(scope) {
  if (scope === 'week') {
    const dates = getWeekDaysArray(currentWeekOffset).map(d => d.date);
    return { label: `Week of ${parseYMD(dates[0]).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`, items: tasks.filter(t => dates.includes(t.date)).sort(sortByTime) };
  }
  return { label: parseYMD(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), items: tasks.filter(t => t.date === selectedDate).sort(sortByTime) };
}

function buildDigestText(scope = emailScope) {
  const { label, items } = digestTasks(scope);
  const open = items.filter(t => !t.completed);
  const done = items.filter(t => t.completed);
  const line = t => `  ${t.completed ? '✓' : '•'} ${scope === 'week' ? parseYMD(t.date).toLocaleDateString('en-US', { weekday: 'short' }) + ' ' : ''}${formatTime12(t.time)} — ${t.text}${t.priority === 'high' ? ' (high)' : ''}`;
  return [
    `☀️ Sunbeam plan — ${label}`,
    `${done.length} of ${items.length} done`,
    dailyIntention && scope === 'day' ? `Intention: "${dailyIntention}"` : null,
    '',
    `To do (${open.length}):`,
    ...(open.length ? open.map(line) : ['  All caught up!']),
    '',
    `Done (${done.length}):`,
    ...(done.length ? done.map(line) : ['  Nothing yet']),
  ].filter(l => l !== null).join('\n');
}

function buildDigestHtml(scope = emailScope) {
  const { label, items } = digestTasks(scope);
  const rows = items.map(t => `
    <tr>
      <td style="padding:6px 10px;color:#78716c;white-space:nowrap;vertical-align:top">${scope === 'week' ? escapeHtml(parseYMD(t.date).toLocaleDateString('en-US', { weekday: 'short' })) + ' ' : ''}${escapeHtml(formatTime12(t.time))}</td>
      <td style="padding:6px 10px;${t.completed ? 'color:#a8a29e;text-decoration:line-through' : 'color:#292524'}">${escapeHtml(t.text)}${t.priority === 'high' && !t.completed ? ' <span style="color:#e11d48">●</span>' : ''}</td>
    </tr>`).join('');
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px">
      <h2 style="font-family:Georgia,serif;color:#292524;margin:0 0 4px">☀️ Your Sunbeam plan</h2>
      <p style="color:#b45309;margin:0 0 12px;font-weight:600">${escapeHtml(label)} · ${items.filter(t => t.completed).length} of ${items.length} done</p>
      ${dailyIntention && scope === 'day' ? `<p style="background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 12px;color:#78350f">🌿 ${escapeHtml(dailyIntention)}</p>` : ''}
      <table style="border-collapse:collapse;width:100%;font-size:14px">${rows || '<tr><td style="padding:6px 10px;color:#78716c">Nothing planned — a peaceful, open day.</td></tr>'}</table>
    </div>`;
}

function emailRecipient() {
  return (outlookEmail || (Outlook.account && Outlook.account.username) || '').trim();
}

async function sendDigestEmail() {
  if (!Outlook.connected) {
    switchView('outlook');
    showToast('Connect your Microsoft account first.', '📧', 'Outlook');
    return;
  }
  const to = emailRecipient();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    $('outlook-email-input').focus();
    showToast('Add a valid email address to send to.', '📧', 'Outlook');
    return;
  }
  const { label } = digestTasks(emailScope);
  await withOutlookBusy(async () => {
    try {
      await Outlook.sendMail({ to, subject: `☀️ Sunbeam plan — ${label}`, html: buildDigestHtml(emailScope) });
      appendSyncLog(`Emailed ${emailScope === 'week' ? 'week' : 'day'} plan to ${to}`);
      sounds.playComplete();
      showToast(`Sent your plan to ${to}`, '✉️', 'Outlook');
    } catch (err) {
      appendSyncLog(`Email failed: ${describeGraphError(err)}`, true);
      showToast(describeGraphError(err), '⚠️', 'Outlook');
    }
  });
}

function openOutlookWebCompose() {
  const { label } = digestTasks(emailScope);
  // Long URLs get cut off by Outlook, so keep the body reasonably short
  const body = buildDigestText(emailScope).slice(0, 1800);
  window.open(Outlook.composeMailUrl({ to: emailRecipient(), subject: `☀️ Sunbeam plan — ${label}`, body }), '_blank', 'noopener');
}

// ==========================================
// 7. RENDERING
// ==========================================
function updateDashboard() {
  const hr = zonedParts(new Date()).hour;
  let greeting = 'Good morning';
  if (hr >= 12 && hr < 17) greeting = 'Good afternoon';
  else if (hr >= 17 || hr < 4) greeting = 'Good evening';
  // "Good morning, Jimmy" with a hand-drawn underline under the name
  const h1 = $('view-greeting');
  h1.innerHTML = '';
  h1.appendChild(document.createTextNode(`${greeting}, `));
  const name = el('span', 'name-squiggle', userName);
  name.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true"><path d="M2 9 C 30 2, 55 13, 85 7 S 140 2, 170 8 S 192 10, 198 5" fill="none" stroke="#1F9488" stroke-width="3.2" stroke-linecap="round"/></svg>');
  h1.appendChild(name);
  $('hero-date').textContent = parseYMD(todayYMD()).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  $('header-date').textContent = parseYMD(todayYMD()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ` · ${PLANNER_TZ.split('/').pop().replace(/_/g, ' ')} time`;

  const today = todayYMD();
  const todays = tasks.filter(t => t.date === today);
  const total = todays.length;
  const completed = todays.filter(t => t.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const reminderCount = upcomingReminders().length;

  $('stat-total').textContent = total;
  $('stat-completed').textContent = completed;
  $('stat-pending').textContent = total - completed;
  $('stat-reminders').textContent = reminderCount;
  $('nav-reminder-badge').classList.toggle('hidden', reminderCount === 0);

  $('progress-percent').textContent = `${percent}%`;
  $('progress-text').textContent = `${completed} of ${total} done`;
  $('progress-circle').style.strokeDashoffset = 251.2 - (percent / 100) * 251.2;
  $('progress-bar').style.width = `${percent}%`;
  $('progress-bar').setAttribute('aria-valuenow', percent);

  let currentRank = ranks[0];
  for (let i = ranks.length - 1; i >= 0; i--) {
    if (percent >= ranks[i].threshold && (total > 0 || ranks[i].threshold === 0)) {
      currentRank = ranks[i];
      break;
    }
  }
  if ($('rank-emoji').dataset.icon !== currentRank.icon) {
    $('rank-emoji').dataset.icon = currentRank.icon;
    setIcon($('rank-emoji'), currentRank.icon);
  }
  $('rank-text').textContent = currentRank.title;
  // The progress message moves to the badge tooltip; the banner shows the quote of the day instead
  $('rank-badge').title = currentRank.desc;
  renderDailyQuote();
}

function renderDailyQuote() {
  const today = todayYMD();
  const figure = $('daily-quote');
  // Missing pieces mean the browser mixed an old cached page with new code; skip rather than break
  if (!figure || figure.dataset.date === today || typeof getQuoteOfTheDay !== 'function') return;
  const q = getQuoteOfTheDay(today, WORK_DAYS);
  figure.dataset.date = today;
  $('quote-text').textContent = `“${q.text}”`;
  $('quote-author').textContent = `— ${q.author}`;
  $('quote-occasion').textContent = q.occasion || '';
  $('quote-occasion').classList.toggle('hidden', !q.occasion);
}

// Line icons from Lucide (loaded in index.html); <i data-lucide> placeholders become SVGs in refreshIcons()
function icon(name, className = '') {
  const i = document.createElement('i');
  i.setAttribute('data-lucide', name);
  if (className) i.setAttribute('class', className);
  return i;
}

function refreshIcons() {
  if (window.lucide && lucide.createIcons) lucide.createIcons({ attrs: { 'stroke-width': 1.85 } });
}

function setIcon(container, name) {
  container.innerHTML = '';
  container.appendChild(icon(name));
  refreshIcons();
}

function tag(text, classes, iconName) {
  const t = el('span', `inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-semibold ${classes}`);
  if (iconName) t.appendChild(icon(iconName));
  if (text) t.appendChild(document.createTextNode(text));
  return t;
}

function iconButton(iconName, title, classes, onClick, text) {
  const btn = el('button', `h-8 min-w-8 px-2 rounded-lg text-sm font-semibold border transition-colors flex items-center justify-center gap-1 ${classes}`);
  btn.appendChild(icon(iconName));
  if (text) btn.appendChild(el('span', 'text-xs', text));
  btn.type = 'button';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.addEventListener('click', e => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

function renderDayView() {
  const isToday = selectedDate === todayYMD();
  $('day-current-label').textContent = parseYMD(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  $('jump-today-btn').textContent = isToday ? 'Today' : 'Back to today';
  $('jump-today-btn').disabled = isToday;

  let dayTasks = searchAllDates && searchQuery.trim() ? tasks.slice() : tasks.filter(t => t.date === selectedDate);

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    dayTasks = dayTasks.filter(t =>
      t.text.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.subtasks.some(st => st.text.toLowerCase().includes(q))
    );
  }
  dayTasks.sort(sortByTime);

  const completedDay = dayTasks.filter(t => t.completed).length;
  $('count-all').textContent = dayTasks.length;
  $('count-active').textContent = dayTasks.length - completedDay;
  $('count-completed').textContent = completedDay;
  $('task-count').textContent = `${dayTasks.length} ${dayTasks.length === 1 ? 'plan' : 'plans'}`;

  if (currentFilter === 'active') dayTasks = dayTasks.filter(t => !t.completed);
  else if (currentFilter === 'completed') dayTasks = dayTasks.filter(t => t.completed);

  taskList.innerHTML = '';
  emptyState.classList.toggle('hidden', dayTasks.length > 0);

  dayTasks.forEach(task => {
    const li = el('li', 'rise-in cat-stripe group flex flex-wrap sm:flex-nowrap items-start gap-3 p-4 pl-5 bg-[#FBF6EC] hover:bg-[#F1E6D0] rounded-2xl border border-[#E3D3B5] transition-colors');
    // Coloured stripe on the left: the life area (imported Outlook meetings are lapis)
    li.style.setProperty('--stripe', task.source === 'outlook' ? '#5B7FC4' : CATEGORIES[task.category].stripe);

    const checkBtn = el('button', `w-6 h-6 mt-0.5 shrink-0 rounded-lg border flex items-center justify-center text-sm transition-all ${
      task.completed ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-stone-300 bg-white hover:border-amber-500 text-transparent'
    }`, '✓');
    checkBtn.type = 'button';
    checkBtn.setAttribute('aria-label', task.completed ? 'Mark as not done' : 'Mark as done');
    checkBtn.addEventListener('click', () => toggleTask(task.id));

    const body = el('div', 'min-w-0 flex-1 cursor-pointer');
    body.addEventListener('click', () => toggleTask(task.id));

    const title = el('p', `text-sm font-semibold break-words ${task.completed ? 'line-through text-stone-400' : 'text-stone-800'}`, task.text);

    const meta = el('div', 'flex items-center gap-1.5 mt-1.5 flex-wrap text-[11px]');
    meta.appendChild(tag(formatTime12(task.time), 'bg-white text-stone-600 border-stone-200/80 font-medium', 'clock'));
    if (task.source === 'outlook') {
      meta.appendChild(tag('Outlook event', 'bg-sky-50 text-sky-800 border-sky-200', 'mail'));
    } else {
      meta.appendChild(tag(CATEGORIES[task.category].label, CATEGORIES[task.category].tag, CATEGORIES[task.category].icon));
      meta.appendChild(tag(PRIORITIES[task.priority].label, PRIORITIES[task.priority].tag, PRIORITIES[task.priority].icon));
      if (task.outlookEventId) meta.appendChild(tag('On calendar', 'bg-sky-50 text-sky-800 border-sky-200', 'calendar-check'));
    }
    if (task.attendees.length) {
      const guests = tag(`👥 ${task.attendees.length}`, 'bg-sky-50 text-sky-800 border-sky-200');
      guests.title = task.attendees.join(', ');
      meta.appendChild(guests);
    }
    if (task.needsSync) meta.appendChild(tag('Edit not in Outlook yet', 'bg-amber-50 text-amber-800 border-amber-200', 'hourglass'));
    if (task.reminder) meta.appendChild(tag('', 'bg-rose-50 text-rose-700 border-rose-200', 'bell'));
    if (task.seriesId) meta.appendChild(tag('', 'bg-stone-100 text-stone-600 border-stone-200', 'repeat'));
    if (task.subtasks.length) {
      meta.appendChild(tag(`${task.subtasks.filter(st => st.done).length}/${task.subtasks.length}`, 'bg-emerald-50 text-emerald-800 border-emerald-200', 'list-checks'));
    }
    if (task.date !== selectedDate) {
      meta.appendChild(tag(parseYMD(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 'bg-stone-200 text-stone-700 border-stone-300', 'calendar'));
    }

    body.appendChild(title);
    body.appendChild(meta);

    if (task.subtasks.length || openSubtaskInputTaskId === task.id) {
      const subContainer = el('div', 'mt-2.5 space-y-1.5 pl-2.5 border-l-2 border-amber-200/80');
      subContainer.addEventListener('click', e => e.stopPropagation());

      task.subtasks.forEach(st => {
        const row = el('div', 'flex items-center justify-between gap-2 text-xs bg-white/80 px-2.5 py-1.5 rounded-lg border border-stone-200/70');
        const label = el('label', 'flex items-center gap-2 cursor-pointer flex-1 min-w-0');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = st.done;
        check.className = 'w-3.5 h-3.5 shrink-0 rounded text-emerald-600 border-stone-300 focus:ring-amber-400';
        check.addEventListener('change', () => toggleSubtask(task.id, st.id));
        label.appendChild(check);
        label.appendChild(el('span', `break-words ${st.done ? 'line-through text-stone-400' : 'text-stone-700 font-medium'}`, st.text));
        const del = el('button', 'w-6 h-6 shrink-0 rounded text-stone-300 hover:text-rose-500 font-bold', '×');
        del.type = 'button';
        del.title = 'Remove step';
        del.addEventListener('click', () => deleteSubtask(task.id, st.id));
        row.appendChild(label);
        row.appendChild(del);
        subContainer.appendChild(row);
      });

      if (openSubtaskInputTaskId === task.id) {
        const addRow = el('form', 'flex items-center gap-1.5 pt-1');
        const stepInput = document.createElement('input');
        stepInput.type = 'text';
        stepInput.placeholder = 'A small step…';
        stepInput.className = 'flex-1 min-w-0 px-2.5 py-1 text-xs rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400';
        const addBtn = el('button', 'px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg', 'Add');
        addBtn.type = 'submit';
        addRow.addEventListener('submit', e => {
          e.preventDefault();
          addSubtaskToTask(task.id, stepInput.value);
        });
        addRow.appendChild(stepInput);
        addRow.appendChild(addBtn);
        subContainer.appendChild(addRow);
        setTimeout(() => stepInput.focus(), 0);
      }
      body.appendChild(subContainer);
    }

    const actions = el('div', 'flex items-center gap-1 shrink-0 w-full sm:w-auto justify-end');
    actions.appendChild(iconButton('list-plus', 'Break into smaller steps', 'bg-white text-stone-600 border-stone-200 hover:bg-amber-50 hover:text-amber-900', () => {
      openSubtaskInputTaskId = openSubtaskInputTaskId === task.id ? null : task.id;
      renderDayView();
      refreshIcons();
    }, 'Step'));
    if (!task.completed) {
      actions.appendChild(iconButton('play', 'Start a focus session on this', 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100', () => selectTaskForFocus(task)));
    }
    if (task.webLink) {
      actions.appendChild(iconButton('external-link', 'Open in Outlook', 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100', () => window.open(task.webLink, '_blank', 'noopener')));
    } else if (task.source === 'sunbeam') {
      actions.appendChild(iconButton('calendar-plus', Outlook.connected ? 'Add to Outlook calendar' : 'Open in Outlook calendar', 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50', async () => {
        if (Outlook.connected) {
          if (await pushTaskToOutlook(task)) showToast(`"${task.text}" is on your Outlook calendar.`, '☁️', 'Outlook');
        } else {
          window.open(Outlook.composeEventUrl(task), '_blank', 'noopener');
        }
      }));
    }
    if (canEdit(task)) {
      actions.appendChild(iconButton('pencil', 'Edit time, details and guests', 'bg-white text-stone-600 border-stone-200 hover:bg-amber-50 hover:text-amber-900', () => openEditDialog(task.id)));
    }
    actions.appendChild(iconButton('x', 'Delete plan', 'bg-white text-stone-400 border-stone-200 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200', () => deleteTask(task.id)));

    li.appendChild(checkBtn);
    li.appendChild(body);
    li.appendChild(actions);
    taskList.appendChild(li);
  });
}

function getWeekDaysArray(offsetWeeks = 0) {
  const anchor = parseYMD(todayYMD());
  anchor.setDate(anchor.getDate() + offsetWeeks * 7);
  anchor.setDate(anchor.getDate() - ((anchor.getDay() - WEEK_STARTS_ON + 7) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i);
    return {
      name: DAY_SHORT[d.getDay()],
      date: formatYMD(d),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isWork: WORK_DAYS.includes(d.getDay())
    };
  });
}

function renderWeekView() {
  const grid = $('week-columns-grid');
  grid.innerHTML = '';
  const weekDays = getWeekDaysArray(currentWeekOffset);
  const today = todayYMD();
  $('week-range-subtitle').textContent = `${weekDays[0].label} – ${weekDays[6].label} · Work week ${workHoursLabel()}`;
  // On wide screens weekend columns are narrower than work days (see #week-columns-grid in styles.css)
  // (only while they're empty, so weekend plans never get squeezed)
  grid.style.setProperty('--week-cols', weekDays
    .map(d => d.isWork || tasks.some(t => t.date === d.date) ? 'minmax(0, 1fr)' : 'minmax(0, 0.72fr)').join(' '));

  weekDays.forEach(day => {
    const isToday = day.date === today;
    const col = el('div', `warm-card rounded-2xl p-3 flex flex-col min-h-[200px] lg:min-h-[360px] ${isToday ? 'ring-2 ring-amber-400' : ''} ${day.isWork ? '' : 'weekend-col'}`);

    const header = el('div', 'border-b border-stone-100 pb-2 mb-2 flex items-center justify-between gap-1');
    const titleDiv = el('div', 'min-w-0');
    titleDiv.appendChild(el('span', `block text-xs font-bold ${isToday ? 'text-amber-700' : 'text-stone-800'}`, isToday ? `${day.name} · Today` : day.name));
    titleDiv.appendChild(el('span', 'block text-[11px] text-stone-400 font-medium', day.label));
    titleDiv.appendChild(day.isWork
      ? el('span', 'block text-[10px] text-stone-400 whitespace-nowrap', `${shortTime(WORK_HOURS.start)}–${shortTime(WORK_HOURS.end)}`)
      : el('span', 'inline-block mt-0.5 text-[10px] font-bold px-1.5 rounded-full bg-stone-100 text-stone-500', 'Weekend'));

    const addBtn = el('button', 'w-7 h-7 shrink-0 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-sm font-bold transition-colors', '+');
    addBtn.type = 'button';
    addBtn.title = `Add a plan on ${day.label}`;
    addBtn.addEventListener('click', () => {
      selectedDate = day.date;
      taskDateInput.value = day.date;
      switchView('day');
      taskInput.focus();
    });

    header.appendChild(titleDiv);
    header.appendChild(addBtn);
    col.appendChild(header);

    const list = el('div', 'space-y-1.5 flex-1 overflow-y-auto lg:max-h-[300px] pr-0.5');
    const dayTasks = tasks.filter(t => t.date === day.date).sort(sortByTime);

    if (dayTasks.length === 0) {
      list.appendChild(el('div', 'text-center py-6 text-[11px] text-stone-300 italic', 'Open day'));
    }
    dayTasks.forEach(task => {
      // A div (not a button) so the ✎ edit button can sit inside it
      const card = el('div', `week-task-card cat-stripe w-full text-left p-2 pl-3 rounded-xl border text-xs transition-colors cursor-pointer ${
        task.completed ? 'bg-stone-50 border-stone-200 opacity-60' : 'bg-[#FBF6EC] hover:border-amber-300 border-[#E3D3B5]'
      }`);
      card.style.setProperty('--stripe', task.source === 'outlook' ? '#5B7FC4' : CATEGORIES[task.category].stripe);
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.title = task.completed ? 'Mark as not done' : 'Mark as done';
      card.addEventListener('click', () => toggleTask(task.id));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleTask(task.id);
        }
      });

      const top = el('div', 'flex items-center justify-between gap-1 mb-0.5');
      const time = el('span', 'flex items-center gap-1 text-[10px] font-bold text-stone-500 tabular-nums whitespace-nowrap min-w-0');
      time.appendChild(el('span', `w-1.5 h-1.5 rounded-full ${PRIORITIES[task.priority].dot}`));
      time.appendChild(document.createTextNode(formatTime12(task.time)));
      if (task.attendees.length) time.appendChild(el('span', 'text-sky-700', `· 👥${task.attendees.length}`));
      const offHours = workOutsideHours(task);
      if (offHours) {
        const moon = el('span', 'text-indigo-500 flex');
        moon.appendChild(icon('moon-star'));
        moon.title = `Outside working hours: ${offHours}`;
        time.appendChild(moon);
      }
      top.appendChild(time);
      const right = el('span', 'flex items-center gap-1');
      if (canEdit(task)) {
        const edit = el('button', 'w-5 h-5 rounded text-[11px] text-stone-400 hover:text-amber-800 hover:bg-amber-100 flex items-center justify-center');
        edit.appendChild(icon('pencil'));
        edit.type = 'button';
        edit.title = 'Edit';
        edit.setAttribute('aria-label', `Edit ${task.text}`);
        edit.addEventListener('click', e => {
          e.stopPropagation();
          openEditDialog(task.id);
        });
        right.appendChild(edit);
      }
      right.appendChild(el('span', `text-[10px] font-bold ${task.completed ? 'text-emerald-600' : 'text-stone-300'}`, task.completed ? '✓' : '○'));
      top.appendChild(right);

      card.appendChild(top);
      card.appendChild(el('p', `font-medium line-clamp-2 break-words ${task.completed ? 'line-through text-stone-400' : 'text-stone-800'}`, task.text));
      list.appendChild(card);
    });

    col.appendChild(list);
    grid.appendChild(col);
  });
}

function renderMonthView() {
  const grid = $('month-calendar-grid');
  grid.innerHTML = '';
  const { year, month } = currentMonthYear;
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() - WEEK_STARTS_ON + 7) % 7;
  $('month-weekday-row').innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const wd = (WEEK_STARTS_ON + i) % 7;
    $('month-weekday-row').appendChild(el('div', WORK_DAYS.includes(wd) ? '' : 'text-stone-300', DAY_SHORT[wd]));
  }
  const totalDays = new Date(year, month + 1, 0).getDate();
  const today = todayYMD();
  $('month-title-heading').textContent = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cellBase = 'month-cell h-16 sm:h-28 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border flex flex-col overflow-hidden';
  for (let i = 0; i < startOffset; i++) {
    grid.appendChild(el('div', `${cellBase} bg-stone-100/40 border-stone-200/40 opacity-40`));
  }

  for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const dayTasks = tasks.filter(t => t.date === dateStr).sort(sortByTime);
    const doneCount = dayTasks.filter(t => t.completed).length;
    const allDone = dayTasks.length > 0 && doneCount === dayTasks.length;

    const cell = el('button', `${cellBase} text-left transition-colors ${isWorkDay(dateStr) ? 'bg-white' : 'bg-[#EFE3CB] weekend-cell'} ${
      isToday ? 'border-amber-500 ring-2 ring-amber-200' : 'border-[#E3D3B5] hover:border-amber-300 hover:bg-amber-50/30'
    }`);
    cell.type = 'button';
    cell.setAttribute('aria-label', `${parseYMD(dateStr).toDateString()}, ${dayTasks.length} plans`);
    cell.addEventListener('click', () => {
      selectedDate = dateStr;
      taskDateInput.value = dateStr;
      switchView('day');
    });

    const top = el('div', 'flex items-center justify-between w-full gap-1');
    top.appendChild(el('span', `text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isToday ? 'bg-amber-500 text-white' : 'text-stone-700'}`, String(dayNum)));
    if (dayTasks.length) {
      top.appendChild(el('span', `hidden sm:inline text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${allDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`, `${doneCount}/${dayTasks.length}`));
    }
    cell.appendChild(top);

    // Phones: coloured dots. Larger screens: the first few titles.
    if (dayTasks.length) {
      const dots = el('div', 'flex sm:hidden flex-wrap gap-0.5 mt-1');
      dayTasks.slice(0, 6).forEach(t => dots.appendChild(el('span', `w-1.5 h-1.5 rounded-full ${t.completed ? 'bg-stone-300' : PRIORITIES[t.priority].dot}`)));
      cell.appendChild(dots);

      const listDiv = el('div', 'hidden sm:block mt-1 space-y-0.5 w-full min-w-0');
      dayTasks.slice(0, 3).forEach(t => {
        listDiv.appendChild(el('p', `text-[10px] truncate ${t.completed ? 'line-through text-stone-300' : 'text-stone-600'}`, `${t.time ? t.time + ' ' : ''}${t.text}`));
      });
      if (dayTasks.length > 3) listDiv.appendChild(el('p', 'text-[10px] text-amber-700 font-bold', `+${dayTasks.length - 3} more`));
      cell.appendChild(listDiv);
    }
    grid.appendChild(cell);
  }

  const trailing = (7 - ((startOffset + totalDays) % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    grid.appendChild(el('div', `${cellBase} bg-stone-100/40 border-stone-200/40 opacity-40`));
  }
}

function renderAnalysisView() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const velocity = total === 0 ? 0 : Math.round((completed / total) * 100);
  const highTasks = tasks.filter(t => t.priority === 'high');
  const highRate = highTasks.length === 0 ? 0 : Math.round((highTasks.filter(t => t.completed).length / highTasks.length) * 100);

  $('analytics-velocity').textContent = `${velocity}%`;
  $('analytics-high-rate').textContent = `${highRate}%`;
  $('analytics-reminder-count').textContent = upcomingReminders().length;

  const horizon = (items, statId, barId) => {
    const done = items.filter(t => t.completed).length;
    const pct = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
    $(statId).textContent = `${done}/${items.length} · ${pct}%`;
    $(barId).style.width = `${pct}%`;
  };
  horizon(tasks.filter(t => t.date === selectedDate), 'horizon-day-stat', 'horizon-day-bar');
  const weekDates = getWeekDaysArray(currentWeekOffset).map(d => d.date);
  horizon(tasks.filter(t => weekDates.includes(t.date)), 'horizon-week-stat', 'horizon-week-bar');
  const monthPrefix = `${currentMonthYear.year}-${String(currentMonthYear.month + 1).padStart(2, '0')}-`;
  horizon(tasks.filter(t => t.date.startsWith(monthPrefix)), 'horizon-month-stat', 'horizon-month-bar');

  const own = tasks.filter(t => t.source === 'sunbeam');
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map(c => [c, own.filter(t => t.category === c).length]));
  const topCat = own.length ? Object.keys(counts).reduce((a, b) => (counts[b] > counts[a] ? b : a)) : null;
  $('analytics-top-category').textContent = topCat || '—';

  const bars = $('category-bars');
  bars.innerHTML = '';
  Object.entries(CATEGORIES).forEach(([key, meta]) => {
    const pct = own.length === 0 ? 0 : Math.round((counts[key] / own.length) * 100);
    const row = el('div');
    const labels = el('div', 'flex justify-between text-xs font-semibold mb-1');
    labels.appendChild(el('span', 'text-stone-700', meta.label));
    labels.appendChild(el('span', 'text-stone-500 tabular-nums', `${counts[key]} · ${pct}%`));
    const track = el('div', 'w-full bg-stone-100 rounded-full h-2.5 overflow-hidden');
    const bar = el('div', `${meta.bar} h-2.5 rounded-full transition-all duration-500`);
    bar.style.width = `${pct}%`;
    track.appendChild(bar);
    row.appendChild(labels);
    row.appendChild(track);
    bars.appendChild(row);
  });

  const meetings = tasks.filter(t => t.source === 'outlook' && weekDates.includes(t.date)).length;
  const insights = [
    {
      icon: 'sun', title: 'Your rhythm', bg: 'bg-amber-50/90 text-amber-950 border-amber-200',
      desc: velocity >= 60
        ? `You've wrapped up ${velocity}% of your plans. Pause and notice how far you've come.`
        : `You're at ${velocity}% overall. Pick one gentle priority to build momentum.`
    },
    {
      icon: 'scale', title: 'Life balance', bg: 'bg-rose-50/80 text-rose-950 border-rose-200',
      desc: topCat
        ? `Most plans are in ${topCat} (${counts[topCat]}). Leave a little room for rest and self-care.`
        : 'Add a few plans to see how your time is spread.'
    },
    {
      icon: 'mail', title: 'Outlook', bg: 'bg-sky-50/80 text-sky-950 border-sky-200',
      desc: Outlook.connected
        ? `Linked to ${Outlook.account.username}. ${meetings} Outlook ${meetings === 1 ? 'meeting' : 'meetings'} in the shown week.`
        : 'Connect Outlook to see your meetings next to your plans.'
    }
  ];
  const container = $('insights-container');
  container.innerHTML = '';
  insights.forEach(item => {
    const card = el('div', `p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${item.bg}`);
    const ic = el('span', 'text-xl leading-none flex mt-0.5');
    ic.appendChild(icon(item.icon));
    card.appendChild(ic);
    const text = el('div');
    text.appendChild(el('p', 'font-bold text-sm mb-0.5', item.title));
    text.appendChild(el('p', 'leading-relaxed opacity-90', item.desc));
    card.appendChild(text);
    container.appendChild(card);
  });
}

function upcomingReminders() {
  const cutoff = Date.now() - 60 * 60000;
  return tasks.filter(t => t.reminder && !t.completed && t.time && taskStartDate(t).getTime() > cutoff);
}

function renderRemindersView() {
  const list = $('reminders-list');
  list.innerHTML = '';
  const flagged = upcomingReminders().sort(sortByTime);
  $('reminders-empty-state').classList.toggle('hidden', flagged.length > 0);

  const notifBtn = $('enable-notifications-btn');
  if (!('Notification' in window)) {
    notifBtn.classList.add('hidden');
  } else if (Notification.permission === 'granted') {
    notifBtn.textContent = '✓ Desktop alerts on';
    notifBtn.disabled = true;
  } else if (Notification.permission === 'denied') {
    notifBtn.textContent = 'Desktop alerts blocked';
    notifBtn.disabled = true;
  }

  flagged.forEach(task => {
    const start = taskStartDate(task);
    const soon = start.getTime() - Date.now() < 60 * 60000;
    const li = el('li', `p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 bg-white ${soon ? 'border-amber-300 shadow-xs' : 'border-stone-200'}`);

    const left = el('div', 'flex items-center gap-3 min-w-0 flex-1');
    const bell = el('div', `w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg ${soon ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`);
    bell.appendChild(icon('bell'));
    left.appendChild(bell);
    const details = el('div', 'min-w-0 flex-1');
    details.appendChild(el('p', 'text-sm font-bold text-stone-800 break-words', task.text));
    details.appendChild(el('p', 'text-xs text-stone-500 mt-0.5', `${parseYMD(task.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${formatTime12(task.time)} · ${relativeFromNow(start)}`));
    left.appendChild(details);

    const btns = el('div', 'flex items-center gap-2');
    const snooze = el('button', 'h-8 px-3 rounded-xl text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors', '+15 min');
    snooze.type = 'button';
    snooze.addEventListener('click', () => snoozeTask(task.id));
    const done = el('button', 'h-8 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors', 'Check off');
    done.type = 'button';
    done.addEventListener('click', () => toggleTask(task.id));
    // Snoozing moves the event, so it's only offered for your own plans without guests
    if (task.source === 'sunbeam' && !task.attendees.length) btns.appendChild(snooze);
    btns.appendChild(done);

    li.appendChild(left);
    li.appendChild(btns);
    list.appendChild(li);
  });
}

function renderOutlookView() {
  $('outlook-digest-preview').textContent = buildDigestText(emailScope);
  emailScopeBtns.forEach(btn => {
    const on = btn.dataset.scope === emailScope;
    btn.className = `email-scope-btn h-9 rounded-xl text-xs font-bold border transition-colors ${on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-sky-50'}`;
  });
  $('last-sync-label').textContent = lastFullSyncAt
    ? `Last synced ${new Date(lastFullSyncAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: PLANNER_TZ })}`
    : 'Syncs as soon as you sign in';
  $('detected-redirect-uri').value = Outlook.redirectUri();
  const clientInput = $('ms-client-id-input');
  if (document.activeElement !== clientInput) clientInput.value = effectiveClientId();
  const tenantInput = $('ms-tenant-input');
  if (document.activeElement !== tenantInput) tenantInput.value = effectiveTenant() === 'common' ? '' : effectiveTenant();
}

function render() {
  updateDashboard();
  refreshOutlookUI();
  updateFormHoursHint();
  ({ day: renderDayView, week: renderWeekView, month: renderMonthView, analysis: renderAnalysisView, reminders: renderRemindersView, outlook: renderOutlookView })[activeView]();
  saveState();
  refreshIcons();
  ensureMonthsLoaded(visibleDates());
}

// The dates on screen, so their months can be fetched from Outlook if needed
function visibleDates() {
  if (activeView === 'week') return getWeekDaysArray(currentWeekOffset).map(d => d.date);
  if (activeView === 'month') return monthRange(currentMonthYear.year, currentMonthYear.month).slice(0, 1);
  return [selectedDate];
}

function switchView(viewName) {
  activeView = viewName;
  Object.entries(views).forEach(([name, section]) => section.classList.toggle('hidden', name !== viewName));
  navTabs.forEach(tab => {
    const on = tab.dataset.view === viewName;
    tab.classList.toggle('bg-white', on);
    tab.classList.toggle('text-sky-800', on);
    tab.classList.toggle('shadow-sm', on);
    tab.classList.toggle('font-bold', on);
    tab.classList.toggle('text-stone-600', !on);
    tab.classList.toggle('font-semibold', !on);
    tab.classList.toggle('hover:bg-white/60', !on);
    tab.setAttribute('aria-current', on ? 'page' : 'false');
  });
  render();
}

// ==========================================
// 8. TASK ACTIONS
// ==========================================
function parseSubtasksInput() {
  return taskSubtasksInput.value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(text => ({ id: uid(), text, done: false }));
}

async function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;

  const baseDate = taskDateInput.value || selectedDate;
  const recur = taskRecurSelect.value;
  const dates = [baseDate];
  if (recur === 'daily') for (let i = 1; i <= 6; i++) dates.push(addDays(baseDate, i));
  if (recur === 'weekly') for (let i = 1; i <= 3; i++) dates.push(addDays(baseDate, i * 7));

  const seriesId = recur !== 'none' ? uid() : null;
  const subtasks = parseSubtasksInput();
  const attendees = parseEmails($('task-invitees-input').value);
  const created = dates.map(date => normalizeTask({
    id: uid(),
    text,
    date,
    time: taskTimeInput.value || WORK_HOURS.start,
    duration: Number(taskDurationSelect.value),
    category: taskCategorySelect.value,
    priority: selectedPriority,
    reminder: taskReminderCheck.checked,
    subtasks: subtasks.map(st => ({ ...st, id: uid() })),
    seriesId,
    attendees,
    keepLocal: !taskAutosyncCheck.checked && !attendees.length
  }));
  tasks.push(...created);

  // Keep the day view on the date you just planned for
  selectedDate = baseDate;
  sounds.playAdd();
  render();

  const when = parseYMD(baseDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const invites = attendees.length ? ` and invited ${attendees.length} ${attendees.length === 1 ? 'person' : 'people'}` : '';
  // Invitations are sent by Outlook, so a plan with guests always goes on the calendar
  if ((taskAutosyncCheck.checked || attendees.length) && Outlook.connected) {
    let ok = 0;
    for (const t of created) {
      if (await pushTaskToOutlook(t, { quiet: true })) ok++;
    }
    render();
    showToast(ok === created.length
      ? `Added for ${when}, put on your Outlook calendar${invites}.`
      : `Added for ${when}. ${created.length - ok} couldn't reach Outlook — see the Outlook tab.`, ok === created.length ? '☁️' : '⚠️', 'Plan added');
  } else if (attendees.length) {
    showToast(`Added for ${when}. Invitations go out once you connect Outlook and press "Push unsynced plans".`, '✉️', 'Plan added');
  } else if (taskAutosyncCheck.checked) {
    showToast(`Added for ${when}. Connect Outlook to put it on your calendar.`, '🌻', 'Plan added');
  } else {
    showToast(`Added for ${when}.`, '🌻', 'Plan added');
  }
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;

  if (task.completed) {
    const today = todayYMD();
    const todays = tasks.filter(t => t.date === today);
    celebrate(task.date === today && todays.length > 0 && todays.every(t => t.completed));
    if (focusedTaskId === id) clearFocusTask();
  } else {
    sounds.playTick();
  }

  render();
  // Mirror the ✓ onto the Outlook event title (only for events Sunbeam created, and never for
  // meetings with guests, who would otherwise get an update email every time you tick it)
  if (task.outlookEventId && task.source === 'sunbeam' && !task.attendees.length) pushTaskToOutlook(task, { quiet: true });
}

function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  tasks = tasks.filter(t => t.id !== id);
  sounds.playDelete();
  render();
  if (task.source === 'outlook') {
    showToast('Hidden from Sunbeam. The meeting is still in Outlook.', '🙈', 'Removed');
  }
  forgetTask(task);
}

// Clean-up after a task leaves the list: focus timer, hidden Outlook meetings, Outlook event removal.
async function forgetTask(task) {
  if (focusedTaskId === task.id) clearFocusTask();
  // So the Outlook backup doesn't bring back a plan you deleted
  if (!task.outlookEventId) {
    deletedLocalIds.push(task.id);
    saveState();
  }
  if (task.source === 'outlook') {
    // Never delete someone's real meeting; just hide it from Sunbeam
    hiddenOutlookIds.push(task.outlookEventId);
    saveState();
  } else if (task.outlookEventId) {
    if (Outlook.connected) {
      try {
        await Outlook.deleteEvent(task.outlookEventId);
        appendSyncLog(`Removed "${task.text}" from Outlook`);
      } catch (err) {
        appendSyncLog(`Couldn't remove "${task.text}" from Outlook: ${describeGraphError(err)}`, true);
      }
    } else {
      appendSyncLog(`"${task.text}" was deleted here but is still on your Outlook calendar (not signed in).`, true);
    }
  }
}

function clearCompleted() {
  const done = tasks.filter(t => t.completed && t.date === selectedDate);
  if (!done.length) return;
  tasks = tasks.filter(t => !done.includes(t));
  sounds.playDelete();
  render();
  showToast(`Cleared ${done.length} finished ${done.length === 1 ? 'plan' : 'plans'}.`, '🧹', 'Tidy');
  done.forEach(forgetTask);
}

// Steps live inside the Outlook event; send changes a moment after you stop clicking.
// Meetings with guests keep them in the settings backup instead (so guests get no update emails).
const pushTimers = {};
function schedulePush(task) {
  if (!task.outlookEventId || task.source !== 'sunbeam' || task.attendees.length || !Outlook.connected) return;
  clearTimeout(pushTimers[task.id]);
  pushTimers[task.id] = setTimeout(() => pushTaskToOutlook(task, { quiet: true }), 1500);
}

function addSubtaskToTask(taskId, stepText) {
  const text = (stepText || '').trim();
  const task = tasks.find(t => t.id === taskId);
  if (!text || !task) return;
  task.subtasks.push({ id: uid(), text, done: false });
  sounds.playAdd();
  render();
  schedulePush(task);
}

function toggleSubtask(taskId, subId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  const st = task.subtasks.find(s => s.id === subId);
  if (!st) return;
  st.done = !st.done;
  if (task.subtasks.every(s => s.done) && !task.completed) {
    toggleTask(taskId); // celebrates and syncs
    showToast('All steps finished — plan complete!', '🎉', 'Little victory!');
    return;
  }
  st.done ? sounds.playAdd() : sounds.playTick();
  render();
  schedulePush(task);
}

function deleteSubtask(taskId, subId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  task.subtasks = task.subtasks.filter(s => s.id !== subId);
  sounds.playDelete();
  render();
  schedulePush(task);
}

function snoozeTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const next = new Date(Math.max(taskStartDate(task).getTime(), Date.now()) + 15 * 60000);
  task.date = zonedParts(next).ymd;
  task.time = zonedParts(next).hm;
  sounds.playAdd();
  showToast(`Snoozed to ${formatTime12(task.time)}`, '⏰', 'Reminder');
  render();
  if (task.outlookEventId && task.source === 'sunbeam') pushTaskToOutlook(task, { quiet: true });
}

// ==========================================
// EDIT DIALOG
// Edits a Sunbeam plan or a meeting you organised; changes go to Outlook (and to guests).
// ==========================================
let editingTaskId = null;

function sameList(a, b) {
  return a.length === b.length && a.every(x => b.includes(x));
}

function updateEditDialogHints() {
  const task = tasks.find(t => t.id === editingTaskId);
  if (!task) return;
  const allDay = $('edit-allday').checked;
  $('edit-time').disabled = allDay;
  $('edit-duration').disabled = allDay;
  setHoursHint($('edit-hours-hint'), {
    date: $('edit-date').value,
    time: allDay ? '' : $('edit-time').value,
    duration: Number($('edit-duration').value),
    category: task.source === 'outlook' ? task.category : $('edit-category').value,
    guests: parseEmails($('edit-invitees').value),
    source: task.source
  });

  const guests = parseEmails($('edit-invitees').value);
  const added = guests.filter(g => !task.attendees.includes(g));
  const removed = task.attendees.filter(g => !guests.includes(g));
  const note = $('edit-dialog-note');
  const saveBtn = $('edit-save-btn');
  let msg = '';
  saveBtn.textContent = 'Save';

  if (task.outlookEventId || guests.length) {
    if (!Outlook.connected) {
      msg = 'You\'re not signed in to Outlook. The change is saved here and sent to Outlook when you press "Push unsynced plans" after connecting.';
    } else if (!task.outlookEventId) {
      msg = `This plan isn't on your calendar yet. Saving adds it and emails an invitation to ${guests.length} ${guests.length === 1 ? 'guest' : 'guests'}.`;
      saveBtn.textContent = 'Save & send invites';
    } else if (task.attendees.length || guests.length) {
      const parts = [];
      if (added.length) parts.push(`invites ${added.join(', ')}`);
      if (removed.length) parts.push(`cancels it for ${removed.join(', ')}`);
      msg = `Saving updates the Outlook meeting${parts.length ? ' and ' + parts.join(', and ') : ''}. Guests get an update email if the time or title changes.`;
      saveBtn.textContent = added.length ? 'Save & send invites' : 'Save & update guests';
    } else {
      msg = 'Saving updates the event on your Outlook calendar.';
    }
  }
  note.textContent = msg;
  note.classList.toggle('hidden', !msg);
}

function openEditDialog(id) {
  const task = tasks.find(t => t.id === id);
  if (!task || !canEdit(task)) return;
  editingTaskId = id;
  $('edit-dialog-title').textContent = task.source === 'outlook' ? 'Edit Outlook meeting' : 'Edit plan';
  $('edit-dialog-sub').textContent = task.source === 'outlook'
    ? 'You organised this meeting, so your changes go to Outlook.'
    : task.seriesId ? 'Repeating plan: this changes only this one.' : '';
  $('edit-text').value = task.text;
  $('edit-date').value = task.date;
  $('edit-time').value = task.time || '09:00';
  $('edit-duration').value = task.duration;
  $('edit-allday').checked = !task.time;
  $('edit-reminder').checked = task.reminder;
  $('edit-category').value = task.category;
  $('edit-priority').value = task.priority;
  $('edit-invitees').value = task.attendees.join(', ');
  // Area and priority are Sunbeam-only labels; they don't mean anything on someone else's invite list
  $('edit-local-fields').classList.toggle('hidden', task.source === 'outlook');
  updateEditDialogHints();
  $('edit-dialog').showModal();
  $('edit-text').focus();
}

function closeEditDialog() {
  editingTaskId = null;
  if ($('edit-dialog').open) $('edit-dialog').close();
}

async function saveEditDialog() {
  const task = tasks.find(t => t.id === editingTaskId);
  if (!task) return closeEditDialog();

  const text = $('edit-text').value.trim();
  const date = $('edit-date').value;
  const allDay = $('edit-allday').checked;
  const time = allDay ? '' : $('edit-time').value;
  const duration = Math.max(5, Math.min(1440, Number($('edit-duration').value) || task.duration));
  const bad = invalidEmails($('edit-invitees').value);

  if (!text) return $('edit-text').focus();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return $('edit-date').focus();
  if (!allDay && !time) return $('edit-time').focus();
  if (bad.length) {
    showToast(`These don't look like email addresses: ${bad.join(', ')}`, '⚠️', 'Guests');
    return $('edit-invitees').focus();
  }

  const attendees = parseEmails($('edit-invitees').value);
  const attendeesChanged = !sameList(attendees, task.attendees);
  const outlookChanged = attendeesChanged || text !== task.text || date !== task.date || time !== task.time ||
    duration !== task.duration || $('edit-reminder').checked !== task.reminder;

  Object.assign(task, {
    text, date, time, duration, attendees,
    reminder: $('edit-reminder').checked,
    category: task.source === 'outlook' ? task.category : $('edit-category').value,
    priority: task.source === 'outlook' ? task.priority : $('edit-priority').value
  });

  const shouldSync = (task.outlookEventId && outlookChanged) || (!task.outlookEventId && task.source === 'sunbeam' && attendees.length);
  closeEditDialog();
  selectedDate = date;
  render();

  if (!shouldSync) {
    sounds.playAdd();
    showToast('Changes saved.', '✎', 'Updated');
    return;
  }
  if (!Outlook.connected) {
    task.needsSync = true;
    task.needsAttendeeSync = task.needsAttendeeSync || attendeesChanged;
    saveState();
    render();
    showToast('Saved here. Connect Outlook and press "Push unsynced plans" to update your calendar.', '⏳', 'Updated');
    return;
  }

  const wasOnCalendar = !!task.outlookEventId;
  const ok = await pushTaskToOutlook(task, { quiet: true, attendeesChanged });
  if (!ok) {
    task.needsSync = true;
    task.needsAttendeeSync = task.needsAttendeeSync || attendeesChanged;
    saveState();
  }
  render();
  if (ok) {
    sounds.playComplete();
    showToast(wasOnCalendar
      ? `Outlook updated${attendees.length ? ' and your guests notified' : ''}.`
      : `Added to Outlook and invited ${attendees.length} ${attendees.length === 1 ? 'guest' : 'guests'}.`, '☁️', 'Updated');
  } else {
    showToast('Saved here, but Outlook didn\'t accept the change. See the Outlook tab for details.', '⚠️', 'Updated');
  }
}

// ==========================================
// 9. FOCUS TIMER
// Counts down against a fixed end time so it stays accurate even when the tab is in the background.
// ==========================================
function updateFocusTimerUI() {
  const mins = String(Math.floor(focusRemainingSeconds / 60)).padStart(2, '0');
  const secs = String(focusRemainingSeconds % 60).padStart(2, '0');
  $('focus-timer-display').textContent = `${mins}:${secs}`;
  const pct = focusTotalSeconds > 0 ? Math.min(100, ((focusTotalSeconds - focusRemainingSeconds) / focusTotalSeconds) * 100) : 0;
  $('focus-timer-bar').style.width = `${pct}%`;
  $('timer-start-btn').textContent = focusEndsAt ? 'Pause' : focusRemainingSeconds < focusTotalSeconds ? 'Resume' : 'Start';
  $('focus-sessions-badge').textContent = `${focusSessionsCompleted} ${focusSessionsCompleted === 1 ? 'session' : 'sessions'} today`;
  document.title = focusEndsAt ? `${mins}:${secs} · Sunbeam` : 'Sunbeam Planner';

  timerPresetBtns.forEach(btn => {
    const on = Number(btn.dataset.minutes) * 60 === focusTotalSeconds;
    btn.className = `timer-preset-btn py-1.5 rounded-xl transition-all ${on ? 'bg-amber-500 text-white font-bold shadow-xs' : 'bg-stone-100 text-stone-700 font-semibold hover:bg-amber-50'}`;
  });
}

function setFocusStatus(text) {
  $('focus-timer-status').textContent = text;
}

function clearFocusTask() {
  focusedTaskId = null;
  const lbl = $('focus-active-task-label');
  lbl.innerHTML = '';
  lbl.appendChild(icon('target', 'inline-block align-[-2px] mr-1 text-rose-500'));
  lbl.appendChild(el('span', 'font-semibold text-stone-800', 'Any task (or press ▶ on a plan)'));
}

function selectTaskForFocus(task) {
  focusedTaskId = task.id;
  const lbl = $('focus-active-task-label');
  lbl.innerHTML = '';
  lbl.appendChild(icon('target', 'inline-block align-[-2px] mr-1 text-rose-500'));
  lbl.appendChild(el('span', 'font-bold text-amber-900', task.text));
  if (!focusEndsAt) {
    toggleFocusTimer();
  } else {
    sounds.playAdd();
  }
  showToast(`Focusing on "${task.text}"`, '🍅', 'Focus');
  $('focus-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function stopFocusInterval() {
  if (focusIntervalId) clearInterval(focusIntervalId);
  focusIntervalId = null;
  focusEndsAt = null;
}

function setFocusPresetMinutes(mins) {
  stopFocusInterval();
  focusTotalSeconds = mins * 60;
  focusRemainingSeconds = mins * 60;
  setFocusStatus(mins === 5 ? 'Enjoy a calm 5-minute breather ☕' : `Set for a gentle ${mins}-minute block`);
  updateFocusTimerUI();
}

function completeFocusSession() {
  stopFocusInterval();
  focusSessionsCompleted += 1;
  focusRemainingSeconds = focusTotalSeconds;
  setFocusStatus('Session complete! Stretch and sip some water 🌻');
  sounds.playFanfare();
  triggerConfetti(true);

  const target = focusedTaskId && tasks.find(t => t.id === focusedTaskId);
  if (target && !target.completed) {
    showToast(`Session #${focusSessionsCompleted} done. Did you finish "${target.text}"? Tick it off when you're ready.`, '🍅', 'Focus');
  } else {
    showToast(`Focus session #${focusSessionsCompleted} complete. Wonderful concentration.`, '🍅', 'Focus');
  }
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification('Focus session complete 🍅', { body: 'Time for a short break.' });
  }
  updateFocusTimerUI();
  saveState();
}

function toggleFocusTimer() {
  if (focusEndsAt) {
    focusRemainingSeconds = Math.max(0, Math.round((focusEndsAt - Date.now()) / 1000));
    stopFocusInterval();
    setFocusStatus('Paused — take your time.');
    updateFocusTimerUI();
    return;
  }
  focusEndsAt = Date.now() + focusRemainingSeconds * 1000;
  sounds.playAdd();
  setFocusStatus('In gentle focus… you’ve got this ✨');
  focusIntervalId = setInterval(() => {
    focusRemainingSeconds = Math.max(0, Math.round((focusEndsAt - Date.now()) / 1000));
    if (focusRemainingSeconds <= 0) completeFocusSession();
    else updateFocusTimerUI();
  }, 250);
  updateFocusTimerUI();
}

function resetFocusTimer() {
  stopFocusInterval();
  focusRemainingSeconds = focusTotalSeconds;
  setFocusStatus('Reset — ready when you are');
  updateFocusTimerUI();
}

// ==========================================
// 10. REMINDER ENGINE
// Checks every 20 seconds and chimes 15 minutes before a flagged plan.
// ==========================================
function fireReminder(task) {
  sounds.playReminder();
  const start = taskStartDate(task);
  showToast(`"${task.text}" starts ${relativeFromNow(start)} (${formatTime12(task.time)}).`, '🔔', 'Gentle nudge');
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(`🔔 ${task.text}`, { body: `Starts at ${formatTime12(task.time)}`, tag: task.id });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) {}
  }
}

function reminderTick() {
  // Roll over to a new day if the tab stayed open past midnight
  const today = todayYMD();
  if (today !== lastKnownToday) {
    if (selectedDate === lastKnownToday) selectedDate = today;
    lastKnownToday = today;
    focusSessionsCompleted = 0;
    dailyIntention = '';
    $('daily-intention-input').value = '';
    updateFocusTimerUI();
    render();
  }

  const now = Date.now();
  let fired = false;
  tasks.forEach(task => {
    if (!task.reminder || task.completed || !task.time) return;
    const start = taskStartDate(task).getTime();
    const key = `${task.id}|${task.date}|${task.time}`;
    if (now >= start - REMINDER_LEAD_MIN * 60000 && now < start + 10 * 60000 && !firedReminderKeys.includes(key)) {
      firedReminderKeys.push(key);
      fireReminder(task);
      fired = true;
    }
  });
  if (fired) saveState();
  if (activeView === 'reminders') renderRemindersView();
}

// ==========================================
// 11. EXPORT / IMPORT
// ==========================================
function downloadBlob(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = el('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportTasksToCSV() {
  const cell = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const headers = ['Task', 'Date', 'Time', 'Minutes', 'Area', 'Priority', 'Done', 'Reminder', 'Steps', 'Source'];
  const rows = tasks.slice().sort(sortByTime).map(t => [
    t.text, t.date, t.time, t.duration, t.category, t.priority,
    t.completed ? 'Yes' : 'No', t.reminder ? 'Yes' : 'No',
    t.subtasks.map(s => (s.done ? '[x] ' : '[ ] ') + s.text).join('; '), t.source
  ].map(cell).join(','));
  // BOM so Excel opens emoji and accents correctly
  downloadBlob('\uFEFF' + [headers.join(','), ...rows].join('\r\n'), 'text/csv;charset=utf-8', `sunbeam_schedule_${todayYMD()}.csv`);
  sounds.playAdd();
  showToast('Exported your schedule to CSV.', '📥', 'Export');
}

function icsEscape(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function downloadICS() {
  const stamp = icsUtc(new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sunbeam Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  tasks.filter(t => t.source === 'sunbeam').forEach(t => {
    lines.push('BEGIN:VEVENT', `UID:${t.id}@sunbeam-planner`, `DTSTAMP:${stamp}`);
    if (t.time) {
      const start = taskStartDate(t);
      lines.push(`DTSTART:${icsUtc(start)}`, `DTEND:${icsUtc(new Date(start.getTime() + t.duration * 60000))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${t.date.replace(/-/g, '')}`);
    }
    lines.push(`SUMMARY:${icsEscape((t.completed ? '✓ ' : '') + t.text)}`, `DESCRIPTION:${icsEscape(`${t.category} · ${t.priority} priority`)}`, 'CATEGORIES:Sunbeam');
    if (t.reminder && t.time) {
      lines.push('BEGIN:VALARM', `TRIGGER:-PT${REMINDER_LEAD_MIN}M`, 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(t.text)}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  downloadBlob(lines.join('\r\n'), 'text/calendar;charset=utf-8', `sunbeam_${todayYMD()}.ics`);
  sounds.playAdd();
  showToast('Downloaded a calendar file you can open in Outlook.', '📅', 'Export');
}

function exportFullJSONBackup() {
  const payload = {
    app: 'Sunbeam Planner',
    version: 2,
    exportedAt: new Date().toISOString(),
    userName, userMood, dailyIntention, outlookEmail, isEveningMode, focusSessionsCompleted,
    tasks
  };
  downloadBlob(JSON.stringify(payload, null, 2), 'application/json;charset=utf-8', `sunbeam_backup_${todayYMD()}.json`);
  sounds.playComplete();
  showToast(`Backup saved (${tasks.length} plans).`, '💾', 'Backup');
}

function importFullJSONBackup(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      const list = Array.isArray(parsed) ? parsed : parsed.tasks;
      if (!Array.isArray(list)) throw new Error('no tasks');
      if (!confirm(`Replace your current ${tasks.length} plans with ${list.length} plans from "${file.name}"?`)) return;
      tasks = list.map(normalizeTask);
      if (typeof parsed.userName === 'string') userName = parsed.userName;
      if (typeof parsed.userMood === 'string') userMood = parsed.userMood;
      if (typeof parsed.outlookEmail === 'string') outlookEmail = parsed.outlookEmail;
      if (typeof parsed.isEveningMode === 'boolean') {
        isEveningMode = parsed.isEveningMode;
        applyEveningThemeUI();
      }
      applyMoodUI();
      render();
      sounds.playFanfare();
      triggerConfetti(true);
      showToast(`Restored ${tasks.length} plans from your backup.`, '🎉', 'Backup');
    } catch (err) {
      showToast('That file isn\'t a Sunbeam backup.', '⚠️', 'Backup');
    }
  };
  reader.readAsText(file);
}

// ==========================================
// 12. SMALL UI STATE HELPERS
// ==========================================
function applyEveningThemeUI() {
  document.body.classList.toggle('evening-mode', isEveningMode);
  setIcon($('theme-icon'), isEveningMode ? 'sun' : 'moon');
  $('theme-toggle-btn').title = isEveningMode ? 'Switch to Daylight Mode' : 'Switch to Evening Mode';
}

function applySoundUI() {
  setIcon($('sound-icon'), sounds.enabled ? 'volume-2' : 'volume-x');
  $('sound-toggle-btn').title = sounds.enabled ? 'Mute sounds' : 'Turn sounds on';
  $('sound-toggle-btn').setAttribute('aria-pressed', sounds.enabled ? 'true' : 'false');
  $('sound-toggle-btn').classList.toggle('opacity-60', !sounds.enabled);
}

function applyMoodUI() {
  moodBtns.forEach(btn => {
    const on = btn.dataset.mood === userMood;
    btn.className = `mood-btn px-2 py-1 rounded-lg transition-all inline-flex items-center gap-1 ${on ? 'bg-emerald-100 font-bold text-emerald-800' : 'text-stone-600 hover:bg-amber-50'}`;
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function applyPriorityUI() {
  priorityChips.forEach(chip => {
    const p = chip.dataset.priority;
    const on = p === selectedPriority;
    chip.className = `priority-chip h-8 rounded-lg border text-xs transition-all inline-flex items-center justify-center gap-1 ${on ? PRIORITIES[p].chipOn : PRIORITIES[p].chipOff}`;
    chip.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function applyFilterUI() {
  filterTabs.forEach(tab => {
    const on = tab.dataset.filter === currentFilter;
    tab.className = `filter-tab px-2.5 py-1 text-xs rounded-lg transition-all ${on ? 'bg-stone-800 text-white font-bold' : 'text-stone-600 font-semibold hover:bg-stone-200/60'}`;
  });
}

function toggleDataMenu(force) {
  const menu = $('data-menu');
  const open = force !== undefined ? force : menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !open);
  $('data-menu-btn').setAttribute('aria-expanded', open ? 'true' : 'false');
}

// ==========================================
// 13. EVENT LISTENERS
// ==========================================
taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const bad = invalidEmails($('task-invitees-input').value);
  if (bad.length) {
    showToast(`These don't look like email addresses: ${bad.join(', ')}`, '⚠️', 'Guests');
    $('task-invitees-input').focus();
    return;
  }
  addTask();
  taskInput.value = '';
  taskSubtasksInput.value = '';
  $('task-invitees-input').value = '';
  taskRecurSelect.value = 'none';
  taskInput.focus();
});

$('edit-form').addEventListener('submit', e => {
  e.preventDefault();
  saveEditDialog();
});
$('edit-cancel-btn').addEventListener('click', closeEditDialog);
$('edit-close-btn').addEventListener('click', closeEditDialog);
$('edit-dialog').addEventListener('close', () => { editingTaskId = null; });
// Clicking the dimmed backdrop closes the dialog
$('edit-dialog').addEventListener('click', e => {
  if (e.target === $('edit-dialog')) closeEditDialog();
});
['edit-invitees', 'edit-allday', 'edit-date', 'edit-time', 'edit-duration', 'edit-category'].forEach(id => $(id).addEventListener('input', updateEditDialogHints));
[taskDateInput, taskTimeInput, taskDurationSelect, taskCategorySelect, $('task-invitees-input')].forEach(input => input.addEventListener('input', updateFormHoursHint));

taskAutosyncCheck.addEventListener('change', () => {
  autoSyncDefault = taskAutosyncCheck.checked;
  saveState();
});

priorityChips.forEach(chip => chip.addEventListener('click', () => {
  selectedPriority = chip.dataset.priority;
  applyPriorityUI();
  sounds.playTick();
}));

filterTabs.forEach(tab => tab.addEventListener('click', () => {
  currentFilter = tab.dataset.filter;
  applyFilterUI();
  renderDayView();
}));

$('clear-completed-btn').addEventListener('click', clearCompleted);
navTabs.forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.view)));

$('day-prev-btn').addEventListener('click', () => {
  selectedDate = addDays(selectedDate, -1);
  taskDateInput.value = selectedDate;
  render();
});
$('day-next-btn').addEventListener('click', () => {
  selectedDate = addDays(selectedDate, 1);
  taskDateInput.value = selectedDate;
  render();
});
$('jump-today-btn').addEventListener('click', () => {
  selectedDate = todayYMD();
  taskDateInput.value = selectedDate;
  render();
});

$('week-prev-btn').addEventListener('click', () => { currentWeekOffset -= 1; renderWeekView(); });
$('week-today-btn').addEventListener('click', () => { currentWeekOffset = 0; renderWeekView(); });
$('week-next-btn').addEventListener('click', () => { currentWeekOffset += 1; renderWeekView(); });

function shiftMonth(delta) {
  const d = new Date(currentMonthYear.year, currentMonthYear.month + delta, 1);
  currentMonthYear = { year: d.getFullYear(), month: d.getMonth() };
  renderMonthView();
}
$('month-prev-btn').addEventListener('click', () => shiftMonth(-1));
$('month-next-btn').addEventListener('click', () => shiftMonth(1));
$('month-today-btn').addEventListener('click', () => {
  currentMonthYear = monthOf(todayYMD());
  renderMonthView();
});

// Name
$('edit-name-btn').addEventListener('click', () => {
  const row = $('name-editor-row');
  row.classList.toggle('hidden');
  row.classList.toggle('flex');
  $('user-name-input').value = userName === 'friend' ? '' : userName;
  $('user-name-input').focus();
});
$('name-editor-row').addEventListener('submit', e => {
  e.preventDefault();
  const val = $('user-name-input').value.trim();
  if (val) {
    userName = val;
    saveState();
    updateDashboard();
    showToast(`Lovely to meet you, ${userName}!`, '🌻', 'Hello');
  }
  $('name-editor-row').classList.add('hidden');
  $('name-editor-row').classList.remove('flex');
});

$('daily-intention-input').addEventListener('input', e => {
  dailyIntention = e.target.value;
  saveState();
});

moodBtns.forEach(btn => btn.addEventListener('click', () => {
  userMood = btn.dataset.mood;
  applyMoodUI();
  saveState();
  sounds.playTick();
}));

// Outlook
$('ms-graph-login-btn').addEventListener('click', connectOrDisconnectOutlook);
$('header-outlook-chip').addEventListener('click', () => switchView('outlook'));
$('ms-graph-sync-now-btn').addEventListener('click', pushUnsyncedTasks);
$('ms-graph-pull-btn').addEventListener('click', () => pullOutlookEvents());
$('graph-send-email-btn').addEventListener('click', sendDigestEmail);
$('outlook-web-compose-btn').addEventListener('click', openOutlookWebCompose);

$('quick-email-outlook-btn').addEventListener('click', () => {
  emailScope = 'day';
  if (Outlook.connected) sendDigestEmail();
  else switchView('outlook');
});
$('quick-pull-outlook-btn').addEventListener('click', () => {
  if (Outlook.connected) pullOutlookEvents();
  else switchView('outlook');
});


$('outlook-email-input').addEventListener('change', e => {
  outlookEmail = e.target.value.trim();
  saveState();
});

emailScopeBtns.forEach(btn => btn.addEventListener('click', () => {
  emailScope = btn.dataset.scope;
  renderOutlookView();
  saveState();
}));

$('copy-digest-btn').addEventListener('click', () => {
  navigator.clipboard && navigator.clipboard.writeText(buildDigestText(emailScope)).catch(() => {});
  showToast('Copied your plan to the clipboard.', '📋', 'Copied');
});

$('copy-redirect-uri-btn').addEventListener('click', () => {
  navigator.clipboard && navigator.clipboard.writeText($('detected-redirect-uri').value).catch(() => {});
  showToast('Copied the redirect URI.', '📋', 'Copied');
});

$('save-client-id-btn').addEventListener('click', async () => {
  const val = $('ms-client-id-input').value.trim();
  if (val && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
    showToast('That doesn\'t look like a client ID (it should be a GUID).', '⚠️', 'Setup');
    return;
  }
  const tenant = $('ms-tenant-input').value.trim().replace(/^https?:\/\/login\.microsoftonline\.com\//i, '').replace(/\/.*$/, '');
  if (tenant && !/^[a-z0-9.-]+$/i.test(tenant)) {
    showToast('The organisation should be a domain like cef-eg.org, or a tenant ID.', '⚠️', 'Setup');
    return;
  }
  // Only store overrides that differ from config.js, so updating config.js later still takes effect
  const configId = (window.SUNBEAM_CONFIG && window.SUNBEAM_CONFIG.clientId) || '';
  msClientIdOverride = val === configId ? '' : val;
  msTenantOverride = '';
  msTenantOverride = (tenant || 'common') === effectiveTenant() ? '' : (tenant || 'common');
  saveState();
  await initOutlook();
  appendSyncLog(`Setup saved: client ${val ? val.slice(0, 8) + '…' : '(none)'}, organisation ${effectiveTenant()}`);
  render();
  showToast(val ? 'Saved. Now press Connect Microsoft account.' : 'Client ID cleared.', '🔐', 'Setup');
});

// Reminders
$('test-reminder-alert-btn').addEventListener('click', () => {
  sounds.playReminder();
  showToast('This is how a reminder will sound and look.', '🔔', 'Gentle nudge');
});
$('enable-notifications-btn').addEventListener('click', async () => {
  if (!('Notification' in window)) return;
  const result = await Notification.requestPermission();
  renderRemindersView();
  if (result === 'granted') new Notification('☀️ Sunbeam alerts are on', { body: 'You\'ll get a nudge 15 minutes before flagged plans.' });
});

// Header controls
$('sound-toggle-btn').addEventListener('click', () => {
  sounds.setEnabled(!sounds.enabled);
  applySoundUI();
  if (sounds.enabled) sounds.playAdd();
});

$('theme-toggle-btn').addEventListener('click', () => {
  isEveningMode = !isEveningMode;
  applyEveningThemeUI();
  saveState();
  sounds.playTick();
});

$('data-menu-btn').addEventListener('click', e => {
  e.stopPropagation();
  toggleDataMenu();
});
document.addEventListener('click', e => {
  if (!e.target.closest('#data-menu')) toggleDataMenu(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') toggleDataMenu(false);
});
$('data-menu').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  toggleDataMenu(false);
  ({
    'export-json': exportFullJSONBackup,
    'import-json': () => $('import-json-input').click(),
    'export-csv': exportTasksToCSV,
    'export-ics': downloadICS,
    print: () => window.print()
  })[btn.dataset.action]();
});
$('import-json-input').addEventListener('change', e => {
  const file = e.target.files && e.target.files[0];
  if (file) importFullJSONBackup(file);
  e.target.value = '';
});

// Timer
$('timer-start-btn').addEventListener('click', toggleFocusTimer);
$('timer-reset-btn').addEventListener('click', resetFocusTimer);
$('timer-finish-btn').addEventListener('click', completeFocusSession);
timerPresetBtns.forEach(btn => btn.addEventListener('click', () => setFocusPresetMinutes(Number(btn.dataset.minutes))));

// Search
$('task-search-input').addEventListener('input', e => {
  searchQuery = e.target.value;
  renderDayView();
});
$('search-all-dates-check').addEventListener('change', e => {
  searchAllDates = e.target.checked;
  renderDayView();
});

// ==========================================
// 14. START
// ==========================================
(async function start() {
  loadSavedState();
  applyEveningThemeUI();
  applySoundUI();
  applyMoodUI();
  applyPriorityUI();
  applyFilterUI();
  updateFocusTimerUI();
  taskDateInput.value = selectedDate;
  taskAutosyncCheck.checked = autoSyncDefault;
  $('daily-intention-input').value = dailyIntention;
  switchView('day');

  // Ask the browser not to clear Sunbeam's storage when space runs low
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  await initOutlook();
  render();
  if (Outlook.connected) {
    appendSyncLog(`Signed in as ${Outlook.account.username}`);
    syncWithOutlook({ quiet: true });
  }

  // Keep in step with Outlook: every 15 minutes, and when you come back to the tab after 5+ minutes
  setInterval(() => syncWithOutlook({ quiet: true }), 15 * 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastFullSyncAt > 5 * 60000) syncWithOutlook({ quiet: true });
  });

  setInterval(reminderTick, 20000);
  reminderTick();
})();
