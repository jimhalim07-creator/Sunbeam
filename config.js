// Sunbeam configuration.
// The client ID is a public identifier (not a secret), so it is safe to commit to GitHub.
// You can also leave it empty and paste it in the app under Outlook → Setup instead.
window.SUNBEAM_CONFIG = {
  // Application (client) ID from your Microsoft Entra app registration.
  clientId: '',

  // 'common' lets any work/school or personal Microsoft account sign in.
  // If your app registration is "this organizational directory only", you MUST replace 'common'
  // with your tenant ID or domain (e.g. 'cef-eg.org'), or sign-in fails with AADSTS50194.
  authority: 'https://login.microsoftonline.com/common'
};
