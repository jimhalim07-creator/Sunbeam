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

function todayYMD() {
  return formatYMD(new Date());
}

function taskStartDate(task) {
  const d = parseYMD(task.date);
  const [h, m] = (task.time || '09:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
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
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
const CATEGORIES = {
  Work: { label: '💼 Work', bar: 'bg-amber-500', tag: 'bg-amber-50 text-amber-900 border-amber-200/70' },
  Personal: { label: '🏠 Personal', bar: 'bg-rose-400', tag: 'bg-rose-50 text-rose-900 border-rose-200/70' },
  Health: { label: '🥗 Health', bar: 'bg-emerald-500', tag: 'bg-emerald-50 text-emerald-900 border-emerald-200/70' },
  Learning: { label: '📚 Learning', bar: 'bg-purple-500', tag: 'bg-purple-50 text-purple-900 border-purple-200/70' }
};

const PRIORITIES = {
  high: { label: '🔥 High', tag: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', chipOn: 'bg-rose-50 border-rose-300 text-rose-700 font-bold shadow-xs', chipOff: 'bg-white border-rose-200 text-rose-700 font-medium' },
  medium: { label: '⚡ Medium', tag: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500', chipOn: 'bg-amber-50 border-amber-300 text-amber-800 font-bold shadow-xs', chipOff: 'bg-white border-amber-200 text-amber-800 font-medium' },
  low: { label: '☕ Chill', tag: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', chipOn: 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold shadow-xs', chipOff: 'bg-white border-emerald-200 text-emerald-700 font-medium' }
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
  { threshold: 0, title: 'Cozy Start', emoji: '🌱', desc: "Every good day begins gently. Pick one small thing whenever you're ready." },
  { threshold: 1, title: 'Warming Up', emoji: '☕', desc: "You've set your rhythm in motion! Keep going at your own comfortable pace." },
  { threshold: 50, title: 'Steady Flow', emoji: '🌻', desc: "Halfway through today's list! You're balancing things wonderfully." },
  { threshold: 80, title: 'Radiant Momentum', emoji: '✨', desc: 'Almost everything wrapped up — what a thoughtful, productive day.' },
  { threshold: 100, title: 'Day Complete', emoji: '👑', desc: 'All done! Relax your shoulders and enjoy your evening.' }
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
let currentMonthYear = { year: new Date().getFullYear(), month: new Date().getMonth() };
let lastKnownToday = todayYMD();

let userName = 'friend';
let userMood = 'steady';
let dailyIntention = '';
let outlookEmail = '';
let msClientIdOverride = '';
let autoSyncDefault = true;
let autoPullOnStart = false;
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
    seriesId: t.seriesId || null
  };
}

function seedTasks() {
  const today = todayYMD();
  return [
    { text: 'Morning stretch & a glass of water', date: today, time: '08:00', category: 'Health', priority: 'medium', completed: true },
    {
      text: 'Focus block: wrap up main project priorities', date: today, time: '10:00', category: 'Work', priority: 'high', reminder: true,
      subtasks: [
        { text: 'Review key milestones', done: true },
        { text: 'Draft summary update for team' },
        { text: 'Send final check-in note' }
      ]
    },
    { text: 'Reply to key emails & clear inbox', date: today, time: '14:00', category: 'Work', priority: 'medium', reminder: true },
    { text: 'Pick up groceries & unwind for dinner', date: today, time: '18:00', category: 'Personal', priority: 'low' },
    { text: 'Prepare weekly team notes', date: addDays(today, 1), time: '11:00', category: 'Work', priority: 'high', reminder: true },
    { text: 'Read 20 pages of a favourite book', date: addDays(today, 2), time: '20:00', category: 'Learning', priority: 'low' },
    { text: 'Catch-up call with family', date: addDays(today, 3), time: '17:30', category: 'Personal', priority: 'medium', reminder: true },
    { text: 'Nature walk & coffee break', date: addDays(today, 4), time: '09:30', category: 'Health', priority: 'low' }
  ].map(normalizeTask);
}

function loadSavedState() {
  try {
    const savedTasks = localStorage.getItem('sunbeam_tasks_v1');
    if (savedTasks) {
      tasks = JSON.parse(savedTasks)
        // Drop placeholder events the old "simulation mode" inserted
        .filter(t => !String(t.id).startsWith('outlook-demo-') && !(String(t.id).startsWith('graph-') && !t.outlookEventId))
        .map(normalizeTask);
    } else {
      tasks = seedTasks();
    }

    userName = localStorage.getItem('sunbeam_user_name') || 'friend';
    userMood = localStorage.getItem('sunbeam_user_mood') || 'steady';
    outlookEmail = localStorage.getItem('sunbeam_outlook_email') || '';
    msClientIdOverride = localStorage.getItem('sunbeam_ms_client_id') || '';
    autoSyncDefault = localStorage.getItem('sunbeam_autosync') !== 'false';
    autoPullOnStart = localStorage.getItem('sunbeam_autopull') === 'true';
    emailScope = localStorage.getItem('sunbeam_email_scope') || 'day';
    hiddenOutlookIds = JSON.parse(localStorage.getItem('sunbeam_hidden_outlook_ids') || '[]');
    firedReminderKeys = JSON.parse(localStorage.getItem('sunbeam_fired_reminders') || '[]');

    const savedTheme = localStorage.getItem('sunbeam_evening_mode');
    isEveningMode = savedTheme === null
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : savedTheme === 'true';

    // Intention and focus count are per day
    const stamp = localStorage.getItem('sunbeam_day_stamp');
    if (stamp === todayYMD()) {
      dailyIntention = localStorage.getItem('sunbeam_daily_intention') || '';
      focusSessionsCompleted = parseInt(localStorage.getItem('sunbeam_focus_sessions') || '0', 10) || 0;
    }
  } catch (e) {
    tasks = seedTasks();
  }
}

function saveState() {
  try {
    localStorage.setItem('sunbeam_tasks_v1', JSON.stringify(tasks));
    localStorage.setItem('sunbeam_user_name', userName);
    localStorage.setItem('sunbeam_user_mood', userMood);
    localStorage.setItem('sunbeam_daily_intention', dailyIntention);
    localStorage.setItem('sunbeam_outlook_email', outlookEmail);
    localStorage.setItem('sunbeam_ms_client_id', msClientIdOverride);
    localStorage.setItem('sunbeam_autosync', autoSyncDefault ? 'true' : 'false');
    localStorage.setItem('sunbeam_autopull', autoPullOnStart ? 'true' : 'false');
    localStorage.setItem('sunbeam_email_scope', emailScope);
    localStorage.setItem('sunbeam_evening_mode', isEveningMode ? 'true' : 'false');
    localStorage.setItem('sunbeam_focus_sessions', String(focusSessionsCompleted));
    localStorage.setItem('sunbeam_day_stamp', todayYMD());
    localStorage.setItem('sunbeam_hidden_outlook_ids', JSON.stringify(hiddenOutlookIds.slice(-500)));
    localStorage.setItem('sunbeam_fired_reminders', JSON.stringify(firedReminderKeys.slice(-300)));
  } catch (e) {}
}

function effectiveClientId() {
  return msClientIdOverride || (window.SUNBEAM_CONFIG && window.SUNBEAM_CONFIG.clientId) || '';
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
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const line = el('div', isError ? 'text-rose-600' : '', `[${nowStr}] ${msg}`);
  logBox.prepend(line);
}

function outlookStatus() {
  if (!Outlook.canSignIn) return 'file';
  if (!effectiveClientId()) return 'unconfigured';
  if (Outlook.initError) return 'error';
  if (!Outlook.connected) return 'ready';
  return 'connected';
}

function refreshOutlookUI() {
  const status = outlookStatus();
  const connected = status === 'connected';
  const user = connected ? Outlook.account.username : '';

  const pillStyles = {
    connected: ['bg-emerald-100 text-emerald-900 border-emerald-300', `Connected · ${user}`],
    ready: ['bg-sky-100 text-sky-900 border-sky-200', 'Ready to connect'],
    unconfigured: ['bg-amber-100 text-amber-900 border-amber-200', 'Setup needed'],
    file: ['bg-rose-100 text-rose-900 border-rose-200', 'Needs a web address'],
    error: ['bg-rose-100 text-rose-900 border-rose-200', 'Sign-in unavailable']
  };
  const descs = {
    connected: 'New plans go straight onto your Outlook calendar, checking one off updates the event, and deleting it removes the event.',
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
  loginBtn.textContent = connected ? 'Sign out' : status === 'ready' ? 'Connect Microsoft account' : 'Open setup';
  loginBtn.className = connected
    ? 'h-10 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-bold rounded-xl transition-all'
    : 'h-10 px-4 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm';

  $('ms-graph-sync-now-btn').disabled = !connected || outlookBusy;
  $('ms-graph-pull-btn').disabled = !connected || outlookBusy;
  $('graph-send-email-btn').disabled = !connected || outlookBusy;

  const unsynced = tasks.filter(t => t.source === 'sunbeam' && !t.outlookEventId && !t.completed).length;
  $('sync-now-desc').textContent = unsynced
    ? `${unsynced} open ${unsynced === 1 ? 'plan isn\'t' : 'plans aren\'t'} on your calendar yet`
    : 'Everything open is already on your calendar';

  const onCalendar = tasks.filter(t => t.outlookEventId).length;
  $('synced-count-badge').textContent = `${onCalendar} on calendar`;

  $('file-protocol-warning').classList.toggle('hidden', status !== 'file');
  if (status === 'unconfigured' || status === 'file') $('outlook-setup-details').open = true;

  // Header chip
  $('header-outlook-dot').className = `w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : status === 'ready' ? 'bg-sky-500' : 'bg-stone-400'}`;
  $('header-outlook-label').textContent = connected ? 'Outlook on' : 'Outlook off';

  // Quick card on day view
  const quick = $('quick-outlook-status');
  quick.textContent = connected ? user : pillStyles[status][1];
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
  if (status !== 'ready') {
    switchView('outlook');
    $('outlook-setup-details').open = true;
    $('ms-client-id-input').focus();
    return;
  }
  try {
    const account = await Outlook.signIn();
    appendSyncLog(`Signed in as ${account.username}`);
    sounds.playComplete();
    showToast(`Connected to Outlook as ${account.username}`, '🔐', 'Outlook');
    refreshOutlookUI();
    render();
  } catch (err) {
    appendSyncLog(`Sign-in failed: ${describeGraphError(err)}`, true);
    showToast(describeGraphError(err), '⚠️', 'Outlook');
  }
}

async function pushTaskToOutlook(task, { quiet = false } = {}) {
  if (!Outlook.connected || task.source !== 'sunbeam') return false;
  try {
    if (task.outlookEventId) {
      await Outlook.updateEvent(task);
    } else {
      const ev = await Outlook.createEvent(task);
      task.outlookEventId = ev.id;
      task.webLink = ev.webLink;
      appendSyncLog(`Added "${task.text}" to Outlook (${task.date} ${task.time || ''})`);
    }
    saveState();
    if (!quiet) render();
    return true;
  } catch (err) {
    if (err.status === 404 && task.outlookEventId) {
      // The event was deleted in Outlook; forget the link so it can be re-added.
      task.outlookEventId = null;
      task.webLink = null;
      saveState();
    }
    appendSyncLog(`Couldn't sync "${task.text}": ${describeGraphError(err)}`, true);
    return false;
  }
}

async function pushUnsyncedTasks() {
  const pending = tasks.filter(t => t.source === 'sunbeam' && !t.outlookEventId && !t.completed);
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
    showToast(`Added ${ok} of ${pending.length} plans to your Outlook calendar.`, '🔄', 'Outlook');
  });
}

async function pullOutlookEvents({ quiet = false } = {}) {
  if (!Outlook.connected) return;
  await withOutlookBusy(async () => {
    const start = parseYMD(todayYMD());
    start.setDate(start.getDate() - 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 31);

    try {
      const events = await Outlook.listEvents(start, end);
      const ownEventIds = new Set(tasks.filter(t => t.source === 'sunbeam' && t.outlookEventId).map(t => t.outlookEventId));
      const seen = new Set();
      let added = 0;
      let updated = 0;

      events.forEach(ev => {
        if (ev.isCancelled || ownEventIds.has(ev.id) || hiddenOutlookIds.includes(ev.id)) return;
        if (Array.isArray(ev.categories) && ev.categories.includes('Sunbeam')) return;
        seen.add(ev.id);

        const startDt = fromGraphUtc(ev.start.dateTime);
        const endDt = fromGraphUtc(ev.end.dateTime);
        const fields = {
          text: ev.subject || '(No title)',
          date: ev.isAllDay ? ev.start.dateTime.slice(0, 10) : formatYMD(startDt),
          time: ev.isAllDay ? '' : `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`,
          duration: Math.max(15, Math.round((endDt - startDt) / 60000)),
          webLink: ev.webLink || null
        };

        const existing = tasks.find(t => t.source === 'outlook' && t.outlookEventId === ev.id);
        if (existing) {
          if (existing.text !== fields.text || existing.date !== fields.date || existing.time !== fields.time) updated++;
          Object.assign(existing, fields);
        } else {
          tasks.push(normalizeTask({
            ...fields,
            id: uid(),
            source: 'outlook',
            outlookEventId: ev.id,
            category: 'Work',
            priority: 'medium',
            reminder: !!ev.isReminderOn
          }));
          added++;
        }
      });

      // Meetings removed from Outlook disappear here too (unless you already checked them off)
      const startYmd = formatYMD(start);
      const endYmd = formatYMD(end);
      const before = tasks.length;
      tasks = tasks.filter(t => !(t.source === 'outlook' && !t.completed && t.date >= startYmd && t.date < endYmd && !seen.has(t.outlookEventId)));
      const removed = before - tasks.length;

      saveState();
      render();
      appendSyncLog(`Imported from Outlook: ${added} new, ${updated} updated, ${removed} removed.`);
      if (!quiet) {
        sounds.playAdd();
        showToast(`Outlook events refreshed: ${added} new, ${updated} updated.`, '📥', 'Outlook');
      }
    } catch (err) {
      appendSyncLog(`Import failed: ${describeGraphError(err)}`, true);
      if (!quiet) showToast(describeGraphError(err), '⚠️', 'Outlook');
    }
  });
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
  const hr = new Date().getHours();
  let greeting = 'Good morning';
  let icon = '☀️';
  if (hr >= 12 && hr < 17) { greeting = 'Good afternoon'; icon = '🌤️'; }
  else if (hr >= 17 || hr < 4) { greeting = 'Good evening'; icon = '🌙'; }
  $('view-greeting').textContent = `${greeting}, ${userName} ${icon}`;
  $('header-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

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
  $('rank-emoji').textContent = currentRank.emoji;
  $('rank-text').textContent = currentRank.title;
  $('rank-desc').textContent = currentRank.desc;
}

function tag(text, classes) {
  return el('span', `inline-flex items-center px-2 py-0.5 rounded-lg border font-semibold ${classes}`, text);
}

function iconButton(label, title, classes, onClick) {
  const btn = el('button', `h-8 min-w-8 px-2 rounded-lg text-xs font-semibold border transition-colors flex items-center justify-center ${classes}`, label);
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
    const li = el('li', 'rise-in group flex flex-wrap sm:flex-nowrap items-start gap-3 p-4 bg-[#FAF8F5] hover:bg-[#F5EFE6] rounded-2xl border border-[#EFE8DC] transition-colors');
    if (task.source === 'outlook') li.classList.add('border-l-4', 'border-l-sky-400');

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
    meta.appendChild(tag(`⏰ ${formatTime12(task.time)}`, 'bg-white text-stone-600 border-stone-200/80 font-medium'));
    if (task.source === 'outlook') {
      meta.appendChild(tag('📧 Outlook event', 'bg-sky-50 text-sky-800 border-sky-200'));
    } else {
      meta.appendChild(tag(CATEGORIES[task.category].label, CATEGORIES[task.category].tag));
      meta.appendChild(tag(PRIORITIES[task.priority].label, PRIORITIES[task.priority].tag));
      if (task.outlookEventId) meta.appendChild(tag('☁️ On calendar', 'bg-sky-50 text-sky-800 border-sky-200'));
    }
    if (task.reminder) meta.appendChild(tag('🔔', 'bg-purple-50 text-purple-700 border-purple-200'));
    if (task.seriesId) meta.appendChild(tag('🔁', 'bg-stone-100 text-stone-600 border-stone-200'));
    if (task.subtasks.length) {
      meta.appendChild(tag(`☑️ ${task.subtasks.filter(st => st.done).length}/${task.subtasks.length}`, 'bg-emerald-50 text-emerald-800 border-emerald-200'));
    }
    if (task.date !== selectedDate) {
      meta.appendChild(tag(`📅 ${parseYMD(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, 'bg-stone-200 text-stone-700 border-stone-300'));
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
    actions.appendChild(iconButton('＋ Step', 'Break into smaller steps', 'bg-white text-stone-600 border-stone-200 hover:bg-amber-50 hover:text-amber-900', () => {
      openSubtaskInputTaskId = openSubtaskInputTaskId === task.id ? null : task.id;
      renderDayView();
    }));
    if (!task.completed) {
      actions.appendChild(iconButton('▶', 'Start a focus session on this', 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100', () => selectTaskForFocus(task)));
    }
    if (task.webLink) {
      actions.appendChild(iconButton('↗', 'Open in Outlook', 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100', () => window.open(task.webLink, '_blank', 'noopener')));
    } else if (task.source === 'sunbeam') {
      actions.appendChild(iconButton('📅', Outlook.connected ? 'Add to Outlook calendar' : 'Open in Outlook calendar', 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50', async () => {
        if (Outlook.connected) {
          if (await pushTaskToOutlook(task)) showToast(`"${task.text}" is on your Outlook calendar.`, '☁️', 'Outlook');
        } else {
          window.open(Outlook.composeEventUrl(task), '_blank', 'noopener');
        }
      }));
    }
    actions.appendChild(iconButton('✕', 'Delete plan', 'bg-white text-stone-400 border-stone-200 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200', () => deleteTask(task.id)));

    li.appendChild(checkBtn);
    li.appendChild(body);
    li.appendChild(actions);
    taskList.appendChild(li);
  });
}

function getWeekDaysArray(offsetWeeks = 0) {
  const anchor = parseYMD(todayYMD());
  anchor.setDate(anchor.getDate() + offsetWeeks * 7);
  const diffToMonday = (anchor.getDay() + 6) % 7;
  anchor.setDate(anchor.getDate() - diffToMonday);
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return names.map((name, i) => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i);
    return { name, date: formatYMD(d), label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
  });
}

function renderWeekView() {
  const grid = $('week-columns-grid');
  grid.innerHTML = '';
  const weekDays = getWeekDaysArray(currentWeekOffset);
  const today = todayYMD();
  $('week-range-subtitle').textContent = `${weekDays[0].label} – ${weekDays[6].label}`;

  weekDays.forEach(day => {
    const isToday = day.date === today;
    const col = el('div', `warm-card rounded-2xl p-3 flex flex-col min-h-[200px] lg:min-h-[360px] ${isToday ? 'ring-2 ring-amber-400' : ''}`);

    const header = el('div', 'border-b border-stone-100 pb-2 mb-2 flex items-center justify-between gap-1');
    const titleDiv = el('div', 'min-w-0');
    titleDiv.appendChild(el('span', `block text-xs font-bold ${isToday ? 'text-amber-700' : 'text-stone-800'}`, isToday ? `${day.name} · Today` : day.name));
    titleDiv.appendChild(el('span', 'block text-[11px] text-stone-400 font-medium', day.label));

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
      const card = el('button', `week-task-card w-full text-left p-2 rounded-xl border text-xs transition-colors ${
        task.completed ? 'bg-stone-50 border-stone-200 opacity-60' : 'bg-[#FAF8F5] hover:border-amber-300 border-[#EFE8DC]'
      } ${task.source === 'outlook' ? 'border-l-4 border-l-sky-400' : ''}`);
      card.type = 'button';
      card.title = task.completed ? 'Mark as not done' : 'Mark as done';
      card.addEventListener('click', () => toggleTask(task.id));

      const top = el('div', 'flex items-center justify-between gap-1 mb-0.5');
      const time = el('span', 'flex items-center gap-1 text-[10px] font-bold text-stone-500 tabular-nums');
      time.appendChild(el('span', `w-1.5 h-1.5 rounded-full ${PRIORITIES[task.priority].dot}`));
      time.appendChild(document.createTextNode(formatTime12(task.time)));
      top.appendChild(time);
      top.appendChild(el('span', `text-[10px] font-bold ${task.completed ? 'text-emerald-600' : 'text-stone-300'}`, task.completed ? '✓' : '○'));

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
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
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

    const cell = el('button', `${cellBase} text-left bg-white transition-colors ${
      isToday ? 'border-amber-500 ring-2 ring-amber-200' : 'border-[#EFE8DC] hover:border-amber-300 hover:bg-amber-50/30'
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
      icon: '🌻', title: 'Your rhythm', bg: 'bg-amber-50/90 text-amber-950 border-amber-200',
      desc: velocity >= 60
        ? `You've wrapped up ${velocity}% of your plans. Pause and notice how far you've come.`
        : `You're at ${velocity}% overall. Pick one gentle priority to build momentum.`
    },
    {
      icon: '💛', title: 'Life balance', bg: 'bg-rose-50/80 text-rose-950 border-rose-200',
      desc: topCat
        ? `Most plans are in ${topCat} (${counts[topCat]}). Leave a little room for rest and self-care.`
        : 'Add a few plans to see how your time is spread.'
    },
    {
      icon: '📧', title: 'Outlook', bg: 'bg-sky-50/80 text-sky-950 border-sky-200',
      desc: Outlook.connected
        ? `Linked to ${Outlook.account.username}. ${meetings} Outlook ${meetings === 1 ? 'meeting' : 'meetings'} in the shown week.`
        : 'Connect Outlook to see your meetings next to your plans.'
    }
  ];
  const container = $('insights-container');
  container.innerHTML = '';
  insights.forEach(item => {
    const card = el('div', `p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${item.bg}`);
    card.appendChild(el('span', 'text-xl leading-none', item.icon));
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
    left.appendChild(el('div', `w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${soon ? 'bg-amber-100' : 'bg-stone-100'}`, '🔔'));
    const details = el('div', 'min-w-0 flex-1');
    details.appendChild(el('p', 'text-sm font-bold text-stone-800 break-words', task.text));
    details.appendChild(el('p', 'text-xs text-stone-500 mt-0.5', `${start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${formatTime12(task.time)} · ${relativeFromNow(start)}`));
    left.appendChild(details);

    const btns = el('div', 'flex items-center gap-2');
    const snooze = el('button', 'h-8 px-3 rounded-xl text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors', '+15 min');
    snooze.type = 'button';
    snooze.addEventListener('click', () => snoozeTask(task.id));
    const done = el('button', 'h-8 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors', 'Check off');
    done.type = 'button';
    done.addEventListener('click', () => toggleTask(task.id));
    btns.appendChild(snooze);
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
  $('auto-pull-check').checked = autoPullOnStart;
  $('detected-redirect-uri').value = Outlook.redirectUri();
  const clientInput = $('ms-client-id-input');
  if (document.activeElement !== clientInput) clientInput.value = effectiveClientId();
}

function render() {
  updateDashboard();
  refreshOutlookUI();
  ({ day: renderDayView, week: renderWeekView, month: renderMonthView, analysis: renderAnalysisView, reminders: renderRemindersView, outlook: renderOutlookView })[activeView]();
  saveState();
}

function switchView(viewName) {
  activeView = viewName;
  Object.entries(views).forEach(([name, section]) => section.classList.toggle('hidden', name !== viewName));
  navTabs.forEach(tab => {
    const on = tab.dataset.view === viewName;
    tab.classList.toggle('bg-white', on);
    tab.classList.toggle('text-amber-900', on);
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
  const created = dates.map(date => normalizeTask({
    id: uid(),
    text,
    date,
    time: taskTimeInput.value || '10:00',
    duration: Number(taskDurationSelect.value),
    category: taskCategorySelect.value,
    priority: selectedPriority,
    reminder: taskReminderCheck.checked,
    subtasks: subtasks.map(st => ({ ...st, id: uid() })),
    seriesId
  }));
  tasks.push(...created);

  // Keep the day view on the date you just planned for
  selectedDate = baseDate;
  sounds.playAdd();
  render();

  const when = parseYMD(baseDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (taskAutosyncCheck.checked && Outlook.connected) {
    let ok = 0;
    for (const t of created) {
      if (await pushTaskToOutlook(t, { quiet: true })) ok++;
    }
    render();
    showToast(ok === created.length
      ? `Added for ${when} and put on your Outlook calendar.`
      : `Added for ${when}. ${created.length - ok} couldn't reach Outlook — see the Outlook tab.`, ok === created.length ? '☁️' : '⚠️', 'Plan added');
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
  // Mirror the ✓ onto the Outlook event title (only for events Sunbeam created)
  if (task.outlookEventId && task.source === 'sunbeam') pushTaskToOutlook(task, { quiet: true });
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

function addSubtaskToTask(taskId, stepText) {
  const text = (stepText || '').trim();
  const task = tasks.find(t => t.id === taskId);
  if (!text || !task) return;
  task.subtasks.push({ id: uid(), text, done: false });
  sounds.playAdd();
  render();
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
}

function deleteSubtask(taskId, subId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  task.subtasks = task.subtasks.filter(s => s.id !== subId);
  sounds.playDelete();
  render();
}

function snoozeTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const next = new Date(Math.max(taskStartDate(task).getTime(), Date.now()) + 15 * 60000);
  task.date = formatYMD(next);
  task.time = `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
  sounds.playAdd();
  showToast(`Snoozed to ${formatTime12(task.time)}`, '⏰', 'Reminder');
  render();
  if (task.outlookEventId && task.source === 'sunbeam') pushTaskToOutlook(task, { quiet: true });
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
  lbl.appendChild(document.createTextNode('🎯 '));
  lbl.appendChild(el('span', 'font-semibold text-stone-800', 'Any task (or press ▶ on a plan)'));
}

function selectTaskForFocus(task) {
  focusedTaskId = task.id;
  const lbl = $('focus-active-task-label');
  lbl.innerHTML = '';
  lbl.appendChild(document.createTextNode('🎯 '));
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
  $('theme-icon').textContent = isEveningMode ? '☀️' : '🌙';
  $('theme-toggle-btn').title = isEveningMode ? 'Switch to Daylight Mode' : 'Switch to Evening Mode';
}

function applySoundUI() {
  $('sound-icon').textContent = sounds.enabled ? '🔊' : '🔇';
  $('sound-toggle-btn').title = sounds.enabled ? 'Mute sounds' : 'Turn sounds on';
  $('sound-toggle-btn').setAttribute('aria-pressed', sounds.enabled ? 'true' : 'false');
  $('sound-toggle-btn').classList.toggle('opacity-60', !sounds.enabled);
}

function applyMoodUI() {
  moodBtns.forEach(btn => {
    const on = btn.dataset.mood === userMood;
    btn.className = `mood-btn px-2 py-1 rounded-lg transition-all ${on ? 'bg-amber-100 font-bold text-amber-900' : 'text-stone-600 hover:bg-amber-50'}`;
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function applyPriorityUI() {
  priorityChips.forEach(chip => {
    const p = chip.dataset.priority;
    const on = p === selectedPriority;
    chip.className = `priority-chip h-8 rounded-lg border text-xs transition-all ${on ? PRIORITIES[p].chipOn : PRIORITIES[p].chipOff}`;
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
  addTask();
  taskInput.value = '';
  taskSubtasksInput.value = '';
  taskRecurSelect.value = 'none';
  taskInput.focus();
});

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
  currentMonthYear = { year: new Date().getFullYear(), month: new Date().getMonth() };
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

$('auto-pull-check').addEventListener('change', e => {
  autoPullOnStart = e.target.checked;
  saveState();
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
  msClientIdOverride = val;
  saveState();
  await Outlook.init(effectiveClientId());
  appendSyncLog(val ? `Saved client ID ${val.slice(0, 8)}…` : 'Cleared client ID override');
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

  await Outlook.init(effectiveClientId());
  render();
  if (Outlook.connected) {
    appendSyncLog(`Signed in as ${Outlook.account.username}`);
    if (autoPullOnStart) pullOutlookEvents({ quiet: true });
  }

  setInterval(reminderTick, 20000);
  reminderTick();
})();
