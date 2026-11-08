'use strict';

const gateway = require('../services/androidGateway');

function renderPage(req, res) {
  return res.set('Cache-Control', 'no-store').render('admin', {
    title: 'FAZ NETWORK Enterprise Admin',
    dbConnected: require('../db').getStatus().connected,
    currentRole: req.session.role || 'super_admin',
    currentAdminUser: req.session.adminUser || 'admin',
    currentAdminId: Number(req.session.userId) || 0
  });
}

function getStatus(_req, res) {
  return res.set('Cache-Control', 'no-store').json({ success: true, gateway: gateway.status() });
}

function normalizeBangladeshPhone(value) {
  let phone = String(value || '').replace(/[\s()-]/g, '');
  if (/^01\d{9}$/.test(phone)) phone = '+88' + phone;
  else if (/^8801\d{9}$/.test(phone)) phone = '+' + phone;
  if (!/^\+8801\d{9}$/.test(phone)) return null;
  return phone;
}

async function sendTestSms(req, res) {
  const phone = normalizeBangladeshPhone(req.body?.phone);
  const message = String(req.body?.message || '').trim();
  if (!phone) return res.status(400).json({ success: false, message: 'Enter a valid Bangladesh mobile number.' });
  if (!message || message.length > 500) {
    return res.status(400).json({ success: false, message: 'Message must contain 1 to 500 characters.' });
  }
  try {
    const result = await gateway.sendSms({ phone, message });
    return res.json({ success: true, message: 'Android gateway acknowledged the SMS request.', result });
  } catch (error) {
    const status = error.code === 'GATEWAY_DISCONNECTED' ? 409 : error.code === 'GATEWAY_ACK_TIMEOUT' ? 504 : 502;
    return res.status(status).json({ success: false, code: error.code || 'GATEWAY_ERROR', message: error.message });
  }
}

async function initiateTestCall(req, res) {
  const phone = normalizeBangladeshPhone(req.body?.phone);
  const message = String(req.body?.message || '').trim();
  if (!phone) return res.status(400).json({ success: false, message: 'Enter a valid Bangladesh mobile number.' });
  if (!message || message.length > 1000) {
    return res.status(400).json({ success: false, message: 'Voice script must contain 1 to 1000 characters.' });
  }
  try {
    const referenceType = String(req.body?.referenceType || '').trim().slice(0, 40) || null;
    const referenceId = String(req.body?.referenceId || '').trim().slice(0, 120) || null;
    const result = await gateway.initiateCall({ phone, message, referenceType, referenceId });
    return res.json({ success: true, message: 'Android gateway acknowledged the test call request.', result });
  } catch (error) {
    const status = error.code === 'GATEWAY_DISCONNECTED' ? 409 : error.code === 'GATEWAY_ACK_TIMEOUT' ? 504 : 502;
    return res.status(status).json({ success: false, code: error.code || 'GATEWAY_ERROR', message: error.message });
  }
}

module.exports = { renderPage, getStatus, sendTestSms, initiateTestCall, normalizeBangladeshPhone };
