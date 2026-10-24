// Sunbeam configuration.
// The client ID is a public identifier (not a secret), so it is safe to commit to GitHub.
// Both values can also be overridden per-browser in the app under Outlook → One-time setup.
window.SUNBEAM_CONFIG = {
  // Application (client) ID from your Microsoft Entra app registration.
  clientId: 'c26ba51e-709e-40fc-bc92-6c52fa5f814f',

  // The app is registered as "this organizational directory only", so sign-in must go to
  // your organisation's endpoint. Using '/common' here fails with AADSTS50194.
  authority: 'https://login.microsoftonline.com/cef-eg.org',

  // Your first name, used in greetings (you can still change it in the app with "Personalize")
  ownerName: 'Jimmy',

  // All plan times are read in this time zone, whatever your computer's clock is set to.
  // Uses the IANA name, so Egypt's daylight-saving changes are handled automatically.
  timeZone: 'Africa/Cairo',

  // Days of the week: 0 = Sunday, 1 = Monday … 6 = Saturday
  weekStartsOn: 0,
  workDays: [0, 1, 2, 3, 4], // Sunday to Thursday
  workHours: { start: '09:00', end: '17:00' }
};
