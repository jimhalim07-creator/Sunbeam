// ==========================================
// MICROSOFT OUTLOOK (MSAL.js + Microsoft Graph)
// Sign-in happens in a popup that returns to auth-redirect.html.
// All times are sent to Graph in UTC so there is no time-zone guessing.
// ==========================================
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_SCOPES = ['User.Read', 'Calendars.ReadWrite', 'Mail.Send'];

const Outlook = {
  msal: null,
  account: null,
  clientId: '',
  initError: '',

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
    const res = await this.msal.loginPopup({ scopes: GRAPH_SCOPES, prompt: 'select_account' });
    this.account = res.account;
    this.msal.setActiveAccount(this.account);
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
      return res.accessToken;
    } catch (err) {
      if (err instanceof window.msal.InteractionRequiredAuthError) {
        const res = await this.msal.acquireTokenPopup({ scopes: GRAPH_SCOPES, account: this.account });
        return res.accessToken;
      }
      throw err;
    }
  },

  async graph(path, { method = 'GET', body, headers = {} } = {}) {
    const token = await this.token();
    const res = await fetch(path.startsWith('http') ? path : GRAPH_BASE + path, {
      method,
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

  eventPayload(task) {
    const start = taskStartDate(task);
    const end = new Date(start.getTime() + (task.duration || 60) * 60000);
    const steps = Array.isArray(task.subtasks) && task.subtasks.length
      ? '<ul>' + task.subtasks.map(st => `<li>${st.done ? '✓ ' : ''}${escapeHtml(st.text)}</li>`).join('') + '</ul>'
      : '';
    return {
      subject: `${task.completed ? '✓ ' : ''}${task.text}`,
      body: {
        contentType: 'HTML',
        content: `<p><b>Area:</b> ${escapeHtml(task.category)} &nbsp;|&nbsp; <b>Priority:</b> ${escapeHtml(task.priority)}</p>${steps}<p style="color:#888">Added from Sunbeam Planner</p>`
      },
      start: { dateTime: toGraphUtc(start), timeZone: 'UTC' },
      end: { dateTime: toGraphUtc(end), timeZone: 'UTC' },
      isReminderOn: !!task.reminder,
      reminderMinutesBeforeStart: 15,
      showAs: 'busy',
      categories: ['Sunbeam']
    };
  },

  async createEvent(task) {
    const ev = await this.graph('/me/events', { method: 'POST', body: this.eventPayload(task) });
    return { id: ev.id, webLink: ev.webLink };
  },

  async updateEvent(task) {
    await this.graph(`/me/events/${encodeURIComponent(task.outlookEventId)}`, { method: 'PATCH', body: this.eventPayload(task) });
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
      $select: 'id,subject,start,end,isAllDay,isCancelled,webLink,categories,reminderMinutesBeforeStart,isReminderOn',
      $orderby: 'start/dateTime',
      $top: '100'
    });
    let url = `/me/calendarView?${params}`;
    const all = [];
    while (url && all.length < 500) {
      const page = await this.graph(url, { headers: { Prefer: 'outlook.timezone="UTC"' } });
      all.push(...(page.value || []));
      url = page['@odata.nextLink'] || null;
    }
    return all;
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

// Graph wants "YYYY-MM-DDTHH:mm:ss" without the trailing Z when timeZone is given.
function toGraphUtc(date) {
  return date.toISOString().slice(0, 19);
}

function fromGraphUtc(dateTime) {
  // Graph returns e.g. "2026-10-21T09:30:00.0000000" in the requested (UTC) zone
  return new Date(dateTime.replace(/(\.\d{3})\d*$/, '$1') + 'Z');
}
