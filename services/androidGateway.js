'use strict';

const crypto = require('crypto');
const { normalizeRole } = require('../middleware/rbac');
const db = require('../db');

const DEVICE_NAMESPACE = '/android-gateway';
const ADMIN_NAMESPACE = '/admin-gateway';
const ACK_TIMEOUT_MS = 12_000;
const devices = new Map();
let adminNamespace = null;

function constantTimeEqual(candidate, expected) {
  const left = Buffer.from(String(candidate || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function status() {
  const configured = Boolean(String(process.env.ANDROID_GATEWAY_TOKEN || '').trim());
  const expectedDeviceId = String(process.env.ANDROID_GATEWAY_DEVICE_ID || '').trim();
  const device = expectedDeviceId
    ? devices.get(expectedDeviceId)
    : devices.values().next().value;
  return {
    configured,
    connected: Boolean(configured && device?.registered),
    device: device?.registered ? { id: device.id, name: device.name, connectedAt: device.connectedAt } : null,
    checkedAt: new Date().toISOString()
  };
}

function publishStatus() {
  if (adminNamespace) adminNamespace.emit('gateway_status', status());
}

function attach(io, sessionMiddleware) {
  io.engine.use(sessionMiddleware);

  const deviceNamespace = io.of(DEVICE_NAMESPACE);
  adminNamespace = io.of(ADMIN_NAMESPACE);

  deviceNamespace.use((socket, next) => {
    const expected = String(process.env.ANDROID_GATEWAY_TOKEN || '').trim();
    const candidate = socket.handshake.auth?.deviceToken;
    if (!expected) return next(new Error('Android gateway is not configured.'));
    if (!constantTimeEqual(candidate, expected)) return next(new Error('Invalid device credentials.'));
    next();
  });

  deviceNamespace.on('connection', socket => {
    let registeredId = null;

    socket.on('register_device', (payload, acknowledge) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      const id = String(payload?.deviceId || '').trim().slice(0, 100);
      const name = String(payload?.deviceName || 'Android SIM Gateway').trim().slice(0, 100);
      const expectedId = String(process.env.ANDROID_GATEWAY_DEVICE_ID || '').trim();
      const alreadyRegistered = !expectedId && devices.size > 0 && !devices.has(id);
      if (!id || (expectedId && id !== expectedId) || alreadyRegistered) {
        reply({ success: false, message: 'This device is not the configured gateway.' });
        return socket.disconnect(true);
      }

      const previous = devices.get(id);
      if (previous && previous.socket.id !== socket.id) previous.socket.disconnect(true);
      registeredId = id;
      devices.set(id, { id, name, socket, registered: true, connectedAt: new Date().toISOString() });
      reply({ success: true, message: 'Device registered.' });
      publishStatus();
    });

    socket.on('call_state', async (payload, acknowledge) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      if (!registeredId) return reply({ success: false, message: 'Register the gateway device before reporting call state.' });
      const requestId = String(payload?.requestId || '').trim();
      const state = String(payload?.state || '').trim().toLowerCase();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) || !['active','ended'].includes(state)) {
        return reply({ success: false, message: 'Invalid call state payload.' });
      }
      try {
        if (state === 'active') {
          const updated = await db.query(
            `UPDATE automation_call_requests
                SET status=CASE WHEN status IN ('queued','calling') THEN 'active' ELSE status END,
                    call_active_at=COALESCE(call_active_at,NOW()),device_id=$2,updated_at=NOW()
              WHERE request_id=$1 AND status IN ('queued','calling','active','confirmed','cancelled')
              RETURNING status`,
            [requestId, registeredId]
          );
          if (!updated.rows.length) return reply({ success: false, message: 'Call request was not found or is no longer eligible.' });
          return reply({ success: true, message: 'Call active state recorded.' });
        }

        await db.query(
          `UPDATE automation_call_requests
              SET status=CASE WHEN status IN ('queued','calling','active') AND dtmf_result IS NULL THEN 'no_response' ELSE status END,
                  ended_at=COALESCE(ended_at,NOW()),updated_at=NOW()
            WHERE request_id=$1 AND status <> 'failed'`,
          [requestId]
        );
        return reply({ success: true, message: 'Call end recorded.' });
      } catch (error) {
        console.error('[Android Gateway] Call-state processing failed:', error.message);
        return reply({ success: false, message: 'Could not persist call state.' });
      }
    });

    socket.on('dtmf_result', async (payload, acknowledge) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      if (!registeredId) return reply({ success: false, message: 'Register the gateway device before reporting DTMF results.' });
      const requestId = String(payload?.requestId || '').trim();
      const resultStatus = String(payload?.status || '').trim().toLowerCase();
      const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId);
      if (!validId || !['confirmed','cancelled','no_input'].includes(resultStatus)) {
        return reply({ success: false, message: 'Invalid DTMF result payload.' });
      }
      const digit = resultStatus === 'confirmed' ? '1' : resultStatus === 'cancelled' ? '2' : null;
      try {
        const result = await db.query(
          `UPDATE automation_call_requests
              SET status=CASE WHEN $2='no_input' THEN 'no_response' ELSE $2 END,
                  dtmf_result=$2,dtmf_digit=$3,responded_at=NOW(),ended_at=COALESCE(ended_at,NOW()),
                  device_id=COALESCE(device_id,$4),updated_at=NOW()
            WHERE request_id=$1 AND dtmf_result IS NULL AND status IN ('queued','calling','active','no_response')
            RETURNING request_id,phone,reference_type,reference_id`,
          [requestId, resultStatus, digit, registeredId]
        );
        if (!result.rows.length) return reply({ success: false, message: 'DTMF result was already recorded or the call request was not found.' });
        const call = result.rows[0];
        const logMessage = resultStatus === 'confirmed' ? 'Order Confirmed' : resultStatus === 'cancelled' ? 'Order Cancelled' : 'Call ended with no DTMF input';
        console.info(`[DTMF] ${logMessage}`, JSON.stringify({ requestId, phone: call.phone, referenceType: call.reference_type, referenceId: call.reference_id, deviceId: registeredId }));
        if (adminNamespace) adminNamespace.emit('call_confirmation', { requestId, status: resultStatus, digit, referenceType: call.reference_type, referenceId: call.reference_id, respondedAt: new Date().toISOString() });
        return reply({ success: true, message: 'DTMF result recorded.' });
      } catch (error) {
        console.error('[Android Gateway] DTMF result persistence failed:', error.message);
        return reply({ success: false, message: 'Could not persist DTMF result.' });
      }
    });

    socket.on('disconnect', () => {
      if (registeredId && devices.get(registeredId)?.socket.id === socket.id) {
        devices.delete(registeredId);
        publishStatus();
      }
    });
  });

  adminNamespace.use((socket, next) => {
    const session = socket.request.session;
    const role = normalizeRole(session?.role);
    const userId = Number(session?.userId);
    if (session?.isAdmin !== true || role !== 'super_admin' || !Number.isSafeInteger(userId) || userId < 1) {
      return next(new Error('An authenticated super-admin session is required.'));
    }
    next();
  });

  adminNamespace.on('connection', socket => {
    socket.emit('gateway_status', status());
  });

  return { status, sendSms, initiateCall };
}

function selectedDevice() {
  const expectedId = String(process.env.ANDROID_GATEWAY_DEVICE_ID || '').trim();
  const device = expectedId ? devices.get(expectedId) : devices.values().next().value;
  return device?.registered ? device : null;
}

function emitWithAck(eventName, payload) {
  const device = selectedDevice();
  if (!device) {
    const error = new Error('Android gateway device is disconnected.');
    error.code = 'GATEWAY_DISCONNECTED';
    throw error;
  }
  return new Promise((resolve, reject) => {
    device.socket.timeout(ACK_TIMEOUT_MS).emit(eventName, payload, (error, response) => {
      if (error) {
        const timeout = new Error('Android gateway did not acknowledge the request in time.');
        timeout.code = 'GATEWAY_ACK_TIMEOUT';
        return reject(timeout);
      }
      if (!response || response.success !== true) {
        const failure = new Error(String(response?.message || 'Android gateway rejected the request.'));
        failure.code = 'GATEWAY_REJECTED';
        return reject(failure);
      }
      resolve(response);
    });
  });
}

function sendSms({ phone, message }) {
  return emitWithAck('send_sms', { requestId: crypto.randomUUID(), phone, message });
}

async function initiateCall({ phone, message, voiceId, referenceType, referenceId }) {
  const requestId = crypto.randomUUID();
  await db.query(
    `INSERT INTO automation_call_requests(request_id,phone,voice_text,reference_type,reference_id,status)
     VALUES($1,$2,$3,$4,$5,'queued')`,
    [requestId, phone, message, referenceType || null, referenceId ? String(referenceId).slice(0, 120) : null]
  );
  try {
    const response = await emitWithAck('initiate_call', { requestId, phone, message, voiceId: voiceId || null });
    await db.query("UPDATE automation_call_requests SET status='calling',updated_at=NOW() WHERE request_id=$1 AND status='queued'", [requestId]);
    return { ...response, requestId };
  } catch (error) {
    await db.query("UPDATE automation_call_requests SET status='failed',last_error=$2,updated_at=NOW() WHERE request_id=$1", [requestId, String(error.message || error).slice(0, 1000)]).catch(() => {});
    throw error;
  }
}

module.exports = { attach, status, sendSms, initiateCall, DEVICE_NAMESPACE, ADMIN_NAMESPACE };
