// ==========================================
// MICROSOFT OUTLOOK (MSAL.js + Microsoft Graph)
// Sign-in happens in a popup that returns to auth-redirect.html.
// All times are sent to Graph in UTC so there is no time-zone guessing.
// ==========================================
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_SCOPES = ['User.Read', 'Calendars.ReadWrite', 'Mail.Send'];

// Sunbeam's own details (area, priority, steps, done…) are stored inside Outlook as hidden
// "extended properties", so signing in on a fresh browser rebuilds everything. Only this app
// reads them; guests and Outlook itself never show them.
const SUNBEAM_PROP_GUID = '{6b1f3c2e-8a4d-4e7b-9c51-2f0d7e9a1b34}';
const SUNBEAM_EVENT_PROP = `String ${SUNBEAM_PROP_GUID} Name SunbeamPlan`;
const SUNBEAM_SETTINGS_PROP = `String ${SUNBEAM_PROP_GUID} Name SunbeamSettings`;

const Outlook = {
  msal: null,
  account: null,
  clientId: '',
  initError: '',
  // Set when Microsoft wants you to sign in again (sessions for browser apps last about a day)
  needsReconnect: false,

  get canSignIn() {
    return location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  },

  get connected() {
    return !!(this.msal && this.account);
  },

  // Work/school accounts use outlook.office.com; personal accounts use outlook.live.com.
  get webBase() {
    const user = (this.account && this.account.username) || '';
    return /@(outlook|hotmail|live|msn)\./i.test(user) ? 'https://outlook.live.com' : 'https://outlook.office.com';
  },

  redirectUri() {
    return new URL('auth-redirect.html', location.href).href;
  },

  async init(clientId, authority) {
    this.clientId = (clientId || '').trim();
    this.msal = null;
    this.account = null;
    this.initError = '';
    if (!this.clientId || !this.canSignIn) return;
    if (!window.msal || !window.msal.PublicClientApplication) {
      this.initError = 'The Microsoft sign-in library did not load. Check your internet connection.';
      return;
    }
    try {
      this.msal = new window.msal.PublicClientApplication({
        auth: { clientId: this.clientId, authority, redirectUri: this.redirectUri() },
        cache: { cacheLocation: 'localStorage' }
      });
      await this.msal.initialize();
      this.account = this.msal.getActiveAccount() || this.msal.getAllAccounts()[0] || null;
      if (this.account) this.msal.setActiveAccount(this.account);
    } catch (err) {
      this.msal = null;
      this.initError = err.message || String(err);
    }
  },

  async signIn() {
    if (!this.msal) throw new Error(this.initError || 'Add your Application (client) ID in Setup first.');
    // Pre-fill the last account so signing in again is one click
    let loginHint = (this.account && this.account.username) || '';
    try { loginHint = loginHint || localStorage.getItem('sunbeam_last_account') || ''; } catch (e) {}
    const res = await this.msal.loginPopup({
      scopes: GRAPH_SCOPES,
      ...(loginHint ? { loginHint } : { prompt: 'select_account' })
    });
    this.account = res.account;
    this.needsReconnect = false;
    this.msal.setActiveAccount(this.account);
    try { localStorage.setItem('sunbeam_last_account', this.account.username); } catch (e) {}
    return this.account;
  },

  async signOut() {
    if (!this.msal || !this.account) return;
    const account = this.account;
    this.account = null;
    // Only forget the account in this app; don't sign the browser out of Microsoft 365 everywhere.
    if (this.msal.clearCache) {
      await this.msal.clearCache({ account });
    } else {
      await this.msal.logoutPopup({ account, postLogoutRedirectUri: this.redirectUri() }).catch(() => {});
    }
  },

  async token() {
    if (!this.connected) throw new Error('Not signed in to Outlook.');
    try {
      const res = await this.msal.acquireTokenSilent({ scopes: GRAPH_SCOPES, account: this.account });
      this.needsReconnect = false;
      return res.accessToken;
    } catch (err) {
      if (!(err instanceof window.msal.InteractionRequiredAuthError)) throw err;
      // Browsers only allow a popup right after a click; in the background, ask the user instead
      const clicked = navigator.userActivation ? navigator.userActivation.isActive : false;
      if (!clicked) {
        this.needsReconnect = true;
        const e = new Error('Your Microsoft sign-in has expired. Press "Sign in again".');
        e.reconnect = true;
        throw e;
      }
      const res = await this.msal.acquireTokenPopup({ scopes: GRAPH_SCOPES, account: this.account });
      this.needsReconnect = false;
      return res.accessToken;
    }
  },

  // keepalive lets a last save finish while the tab is closing (uses the most recent token)
  async graph(path, { method = 'GET', body, headers = {}, keepalive = false } = {}) {
    const token = keepalive && this.lastToken ? this.lastToken : await this.token();
    this.lastToken = token;
    const res = await fetch(path.startsWith('http') ? path : GRAPH_BASE + path, {
      method,
      keepalive,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 204 || res.status === 202) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error((data && data.error && data.error.message) || `Graph request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  // ---------- Calendar ----------

  eventTiming(task) {
    if (!task.time) {
      // All-day: midnight to midnight on the plan's date
      return {
        isAllDay: true,
        start: { dateTime: `${task.date}T00:00:00`, timeZone: 'UTC' },
        end: { dateTime: `${addDays(task.date, 1)}T00:00:00`, timeZone: 'UTC' }
      };
    }
    const start = taskStartDate(task);
    const end = new Date(start.getTime() + (task.duration || 60) * 60000);
    return {
      isAllDay: false,
      start: { dateTime: toGraphUtc(start), timeZone: 'UTC' },
      end: { dateTime: toGraphUtc(end), timeZone: 'UTC' }
    };
  },

  // Graph emails every attendee whenever an event with attendees is changed, so callers only
  // include the attendee list when it actually changed, and the ✓ "done" marker never goes in
  // the subject of an event that has guests.
  eventPayload(task, { includeAttendees = true } = {}) {
    const guests = includeAttendees ? { attendees: toGraphAttendees(task.attendees) } : {};
    if (task.source === 'outlook') {
      // A meeting imported from Outlook: only touch what Sunbeam lets you edit, never its body
      return { subject: task.text, ...this.eventTiming(task), isReminderOn: !!task.reminder, ...guests };
    }
    const hasGuests = task.attendees.length > 0;
    const steps = task.subtasks.length
      ? '<ul>' + task.subtasks.map(st => `<li>${st.done && !hasGuests ? '✓ ' : ''}${escapeHtml(st.text)}</li>`).join('') + '</ul>'
      : '';
    const details = hasGuests ? '' : `<p><b>Area:</b> ${escapeHtml(task.category)} &nbsp;|&nbsp; <b>Priority:</b> ${escapeHtml(task.priority)}</p>`;
    return {
      subject: `${task.completed && !hasGuests ? '✓ ' : ''}${task.text}`,
      body: { contentType: 'HTML', content: `${details}${steps}<p style="color:#888">Added from Sunbeam Planner</p>` },
      ...this.eventTiming(task),
      isReminderOn: !!task.reminder,
      reminderMinutesBeforeStart: 15,
      showAs: 'busy',
      categories: ['Sunbeam'],
      singleValueExtendedProperties: [{ id: SUNBEAM_EVENT_PROP, value: JSON.stringify(planMeta(task)) }],
      ...guests
    };
  },

  // If Outlook ever refuses Sunbeam's hidden details on an event, send the event without them
  // (its details are then kept in the settings backup) rather than failing the whole save
  extPropsRefused: false,
  withoutHiddenDetails(payload) {
    const { singleValueExtendedProperties, ...rest } = payload;
    return rest;
  },
  isHiddenDetailsError(err) {
    return err.status === 400 && /extended|propert/i.test(err.message || '');
  },

  async createEvent(task) {
    // transactionId = the plan's id: Outlook ignores a repeated create, and a wiped browser can
    // re-link its plans to their events
    let payload = { ...this.eventPayload(task), transactionId: task.id };
    if (this.extPropsRefused) payload = this.withoutHiddenDetails(payload);
    let ev;
    try {
      ev = await this.graph('/me/events', { method: 'POST', body: payload });
    } catch (err) {
      if (!this.isHiddenDetailsError(err) || this.extPropsRefused) throw err;
      this.extPropsRefused = true;
      ev = await this.graph('/me/events', { method: 'POST', body: this.withoutHiddenDetails(payload) });
    }
    return { id: ev.id, webLink: ev.webLink };
  },

  async updateEvent(task, { attendeesChanged = false } = {}) {
    const path = `/me/events/${encodeURIComponent(task.outlookEventId)}`;
    let payload = this.eventPayload(task, { includeAttendees: attendeesChanged });
    if (this.extPropsRefused) payload = this.withoutHiddenDetails(payload);
    try {
      await this.graph(path, { method: 'PATCH', body: payload });
    } catch (err) {
      if (!this.isHiddenDetailsError(err) || this.extPropsRefused) throw err;
      this.extPropsRefused = true;
      await this.graph(path, { method: 'PATCH', body: this.withoutHiddenDetails(payload) });
    }
  },

  async deleteEvent(eventId) {
    try {
      await this.graph(`/me/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
    } catch (err) {
      if (err.status !== 404) throw err; // already gone from Outlook is fine
    }
  },

  async listEvents(startDate, endDate) {
    const params = new URLSearchParams({
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
      $select: 'id,subject,start,end,isAllDay,isCancelled,webLink,categories,reminderMinutesBeforeStart,isReminderOn,isOrganizer,attendees,transactionId',
      $expand: `singleValueExtendedProperties($filter=id eq '${SUNBEAM_EVENT_PROP}')`,
      $orderby: 'start/dateTime',
      $top: '200'
    });
    let url = `/me/calendarView?${params}`;
    const all = [];
    while (url && all.length < 1500) {
      const page = await this.graph(url, { headers: { Prefer: 'outlook.timezone="UTC"' } });
      all.push(...(page.value || []));
      url = page['@odata.nextLink'] || null;
    }
    // Attach Sunbeam's stored details (if any) as ev.sunbeam
    all.forEach(ev => {
      const prop = (ev.singleValueExtendedProperties || []).find(p => p.id.toLowerCase() === SUNBEAM_EVENT_PROP.toLowerCase());
      try { ev.sunbeam = prop ? JSON.parse(prop.value) : null; } catch (e) { ev.sunbeam = null; }
    });
    return all;
  },

  // ---------- Settings backup (stored on your default calendar, invisible in Outlook) ----------

  async loadSettings() {
    const params = new URLSearchParams({
      $select: 'id',
      $expand: `singleValueExtendedProperties($filter=id eq '${SUNBEAM_SETTINGS_PROP}')`
    });
    const cal = await this.graph(`/me/calendar?${params}`);
    const prop = (cal.singleValueExtendedProperties || [])[0];
    if (!prop) return null;
    try { return JSON.parse(prop.value); } catch (e) { return null; }
  },

  async saveSettings(data, { keepalive = false } = {}) {
    await this.graph('/me/calendar', {
      method: 'PATCH',
      keepalive,
      body: { singleValueExtendedProperties: [{ id: SUNBEAM_SETTINGS_PROP, value: JSON.stringify(data) }] }
    });
  },

  // ---------- Mail ----------

  async sendMail({ to, subject, html }) {
    await this.graph('/me/sendMail', {
      method: 'POST',
      body: {
        message: {
          subject,
          body: { contentType: 'HTML', content: html },
          toRecipients: [{ emailAddress: { address: to } }]
        },
        saveToSentItems: true
      }
    });
  },

  composeMailUrl({ to, subject, body }) {
    return `${this.webBase}/mail/deeplink/compose?${queryString({ to: to || '', subject, body })}`;
  },

  composeEventUrl(task) {
    const start = taskStartDate(task);
    const end = new Date(start.getTime() + (task.duration || 60) * 60000);
    return `${this.webBase}/calendar/deeplink/compose?${queryString({
      subject: task.text,
      startdt: start.toISOString(),
      enddt: end.toISOString(),
      body: `${task.category} · ${task.priority} priority — from Sunbeam Planner`
    })}`;
  }
};

// Outlook deep links show "+" literally, so encode spaces as %20 rather than using URLSearchParams.
function queryString(obj) {
  return Object.entries(obj).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

// The Sunbeam-only details kept inside a calendar event
function planMeta(task) {
  return {
    v: 1,
    category: task.category,
    priority: task.priority,
    completed: task.completed,
    reminder: task.reminder,
    subtasks: task.subtasks.map(st => ({ text: st.text, done: st.done })),
    seriesId: task.seriesId || null
  };
}

function toGraphAttendees(emails) {
  return (emails || []).map(address => ({ emailAddress: { address }, type: 'required' }));
}

// Graph wants "YYYY-MM-DDTHH:mm:ss" without the trailing Z when timeZone is given.
function toGraphUtc(date) {
  return date.toISOString().slice(0, 19);
}

function fromGraphUtc(dateTime) {
  // Graph returns e.g. "2026-10-21T09:30:00.0000000" in the requested (UTC) zone
  return new Date(dateTime.replace(/(\.\d{3})\d*$/, '$1') + 'Z');
}
