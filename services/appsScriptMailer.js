'use strict';

const crypto = require('crypto');

function getMailerConfig() {
  const url = String(process.env.OTP_MAILER_URL || '').trim();
  const token = String(process.env.OTP_MAILER_TOKEN || '');
  if (!url || token.length < 32) throw new Error('Apps Script mailer is not configured. Set OTP_MAILER_URL and a 32+ character OTP_MAILER_TOKEN.');
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'script.google.com' || !/^\\/macros\\/s\\/[^/]+\\/exec\\/?$/.test(endpoint.pathname)) throw new Error('OTP_MAILER_URL must be a Google Apps Script Web App /exec URL.');
  return { endpoint: endpoint.toString(), token };
}

async function sendTenantInvitation({ email, tenantName, link }) {
  const { endpoint, token } = getMailerConfig();
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'invitation', token, to: email, username: String(tenantName || 'Tenant Admin').slice(0, 60), role: 'Tenant Admin', link }),
    signal: AbortSignal.timeout(20000), redirect: 'follow'
  });
  const body = await response.text();
  let result;
  try { result = JSON.parse(body); } catch { throw new Error('Apps Script invitation mailer returned an invalid response.'); }
  if (!response.ok || result.success !== true) throw new Error('Apps Script invitation mailer failed: ' + String(result.error || 'request rejected').slice(0, 120));
  return result;
}

module.exports = { sendTenantInvitation };
