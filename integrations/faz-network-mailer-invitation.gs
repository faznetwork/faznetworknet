/** FAZ NETWORK Apps Script mailer invitation handler patch. Keep existing handlers unchanged.\n * Store MAILER_API_TOKEN in Script Properties. In doPost, immediately after JSON.parse,\n * reject requests unless authorizeMailerRequest(data) returns true. */\nfunction authorizeMailerRequest(data) {\n  var expected = PropertiesService.getScriptProperties().getProperty('MAILER_API_TOKEN') || '';\n  var supplied = String(data && data.token || '');\n  return expected.length >= 32 && supplied.length === expected.length && supplied === expected;\n}
function sendInvitation(data, to) {
  var username = String(data.username || 'Tenant Admin').trim().slice(0, 60);
  var role = String(data.role || '').trim();
  var link = String(data.link || '').trim();
  var tenantOnboarding = role === 'Tenant Admin';
  var validLink = tenantOnboarding
    ? /^https:\/\/isp\\.faznetwork\\.com\/onboard\\?token=[A-Za-z0-9_-]{40,100}$/.test(link)
    : /^https:\/\/faznetwork\\.com\/invite\/[A-Za-z0-9_-]+$/.test(link);
  if ((!tenantOnboarding && ['Admin', 'Staff', 'Super Admin'].indexOf(role) === -1) || !validLink) {
    return jsonResponse({ success: false, error: 'Invalid invitation context or link' });
  }
  var expiration = tenantOnboarding ? '48 hours' : '24 hours';
  var subject = tenantOnboarding ? 'FAZ NETWORK - ISP Tenant Onboarding' : 'FAZ NETWORK - Account Invitation';
  var body = 'Hello ' + username + ',\\n\\nYou have been invited to join FAZ NETWORK as ' + role + '.\\n\\nSet up your account using this secure link:\\n\\n' + link + '\\n\\nThis invitation expires in ' + expiration + ' and can be used once. If you were not expecting it, ignore this email.';
  var html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#0f172a"><h2>FAZ <span style="color:#059669">NETWORK</span></h2><p>Hello ' + escapeHtml(username) + ',</p><p>You have been invited to join FAZ NETWORK as <b>' + escapeHtml(role) + '</b>.</p><p>Use this secure link to set up your account:</p><p style="margin:28px 0"><a href="' + escapeHtml(link) + '" style="background:#047857;color:white;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">Set Up Account</a></p><p>If the button does not work, copy this link into your browser:</p><p style="word-break:break-all">' + escapeHtml(link) + '</p><p>This invitation expires in <b>' + expiration + '</b> and can be used once.</p></div>';
  MailApp.sendEmail({ to: to, subject: subject, body: body, htmlBody: html, name: 'FAZ NETWORK' });
  return jsonResponse({ success: true });
}
