'use strict';

const catalogService = require('../services/resellerHotspotCatalogService');
const issuanceService = require('../services/resellerVoucherIssuanceService');

function sendError(res, error, operation, resellerId) {
  const databaseCode = /^[0-9A-Z]{5}$/.test(String(error.code || '')) ? String(error.code) : null;
  console.error('[Reseller Hotspot] ' + operation + ' failed:', {
    resellerId: resellerId || null, code: error.code || 'UNEXPECTED_ERROR',
    databaseCode, constraint: error.constraint || null, detail: error.detail || null,
    message: error.message, stack: error.stack
  });
  const status = Number.isInteger(error.statusCode) ? error.statusCode : 503;
  let publicCode = error.code || 'RESELLER_HOTSPOT_UNAVAILABLE';
  let message = error.message || 'The reseller hotspot request failed.';
  if (status >= 500 && operation === 'Catalog') {
    if (databaseCode === '42P01') {
      publicCode = 'HOTSPOT_CATALOG_SCHEMA_MISSING';
      message = 'Hotspot catalog storage is not initialized on this server. Contact FAZ NETWORK support and provide code HOTSPOT_CATALOG_SCHEMA_MISSING.';
    } else if (databaseCode === '42703') {
      publicCode = 'HOTSPOT_CATALOG_SCHEMA_MISMATCH';
      message = 'Hotspot catalog configuration does not match the active server version. Contact FAZ NETWORK support and provide code HOTSPOT_CATALOG_SCHEMA_MISMATCH.';
    } else if (!error.code) {
      publicCode = 'HOTSPOT_CATALOG_QUERY_FAILED';
      message = 'The server could not read the hotspot catalog. Please retry or contact support with code HOTSPOT_CATALOG_QUERY_FAILED.';
    }
  } else if (status >= 500 && !error.code) {
    publicCode = 'RESELLER_HOTSPOT_UNAVAILABLE';
    message = 'The reseller hotspot request could not be completed. Please retry or contact support with code RESELLER_HOTSPOT_UNAVAILABLE.';
  }
  return res.status(status).json({ success: false, code: publicCode, message });
}

function resellerId(req) {
  return Number(req.auth?.resellerId);
}

async function catalog(req, res) {
  const id = resellerId(req);
  try {
    const data = await catalogService.getCatalog(id);
    return res.json(data);
  } catch (error) {
    return sendError(res, error, 'Catalog', id);
  }
}

async function issueBatch(req, res) {
  const id = resellerId(req);
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  try {
    const result = await issuanceService.issueBatch({
      resellerId: id,
      popId: body.popId,
      packageId: body.packageId,
      quantity: body.quantity,
      idempotencyKey: req.get('Idempotency-Key'),
      actorUserId: req.auth?.userId || id
    });
    return res.status(result.replayed ? 200 : 201).json({
      success: true,
      replayed: result.replayed,
      message: result.replayed ? 'This voucher batch was already issued; the original batch is shown.' : 'Voucher batch issued successfully.',
      batch: result.batch,
      vouchers: result.vouchers.map(voucher => ({
        id: voucher.id,
        username: voucher.username,
        password: voucher.password,
        pin: voucher.username,
        validity: voucher.validity,
        package_name: voucher.packageName || result.batch.packageName || result.batch.profileKey
      })),
      account: result.account || null
    });
  } catch (error) {
    return sendError(res, error, 'Voucher issuance', id);
  }
}

async function listBatches(req, res) {
  const id = resellerId(req);
  try {
    const batches = await issuanceService.listBatches(id, req.query.limit);
    return res.json({ success: true, batches });
  } catch (error) {
    return sendError(res, error, 'Voucher batch history', id);
  }
}

async function getBatch(req, res) {
  const id = resellerId(req);
  try {
    const result = await issuanceService.getBatch(id, req.params.batchKey);
    if (!result) return res.status(404).json({ success: false, code: 'BATCH_NOT_FOUND', message: 'Voucher batch not found.' });
    return res.json({ success: true, batch: result.batch, vouchers: result.vouchers });
  } catch (error) {
    return sendError(res, error, 'Voucher batch detail', id);
  }
}

async function printBatchPage(req, res) {
  const id = resellerId(req);
  try {
    const result = await issuanceService.getBatch(id, req.params.batchKey);
    if (!result) return res.status(404).send('Voucher batch not found.');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.render('reseller-voucher-print', {
      title: 'FAZ NETWORK Reseller Voucher Batch',
      resellerName: req.session.auth?.name || req.session.resellerName || 'Reseller',
      batch: result.batch,
      vouchers: result.vouchers
    });
  } catch (error) {
    console.error('[Reseller Hotspot] Printable batch view failed:', {
      resellerId: id,
      batchKey: String(req.params.batchKey || ''),
      code: error.code || 'UNEXPECTED_ERROR',
      message: error.message,
      stack: error.stack
    });
    if (Number.isInteger(error.statusCode) && error.statusCode < 500) return res.status(error.statusCode).send(error.message);
    return res.status(503).send('Voucher print view is temporarily unavailable. Please retry or contact support.');
  }
}

module.exports = { catalog, issueBatch, listBatches, getBatch, printBatchPage };
