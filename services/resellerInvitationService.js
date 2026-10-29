'use strict';

const crypto = require('crypto');
const emailOutboxService = require('./emailOutboxService');

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

function createInvitationToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: crypto.createHash('sha256').update(token).digest('hex') };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function invitationUrl(token) {
  const baseUrl = String(process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(baseUrl)) {
    throw new Error('APP_BASE_URL or PUBLIC_APP_URL must be configured with the HTTPS application origin.');
  }
  return baseUrl + '/reseller/accept-invite?token=' + encodeURIComponent(token);
}

async function queueInvitation({ reseller, token, client, expiresAt }) {
  const url = invitationUrl(token);
  const safeName = escapeHtml(reseller.name);
  const expiry = new Date(expiresAt).toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short'
  });
  const subject = 'FAZ NETWORK reseller account invitation';
  const text = [
    'Hello ' + reseller.name + ',',
    '',
    'You have been invited to access the FAZ NETWORK reseller portal.',
    'Accept your invitation using this link: ' + url,
    'This link expires on ' + expiry + ' (Asia/Dhaka).',
    'If you were not expecting this invitation, you can ignore this email.'
  ].join('\n');
  const html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">' +
    '<h2>FAZ NETWORK</h2><p>Hello ' + safeName + ',</p>' +
    '<p>You have been invited to access the reseller portal.</p>' +
    '<p><a href="' + escapeHtml(url) + '">Accept invitation</a></p>' +
    '<p>This link expires on ' + escapeHtml(expiry) + ' (Asia/Dhaka).</p>' +
    '<p>If you were not expecting this invitation, you can ignore this email.</p></div>';
  return emailOutboxService.enqueueEmail({
    event: 'reseller_invitation',
    to: reseller.email,
    subject,
    text,
    html,
    sensitive: true,
    expiresAt,
    client
  });
}

module.exports = {
  INVITATION_TTL_MS,
  createInvitationToken,
  queueInvitation
};
