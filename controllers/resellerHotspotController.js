'use strict';

const catalogService = require('../services/resellerHotspotCatalogService');
const issuanceService = require('../services/resellerVoucherIssuanceService');
const lifecycleService = require('../services/resellerVoucherLifecycleService');
const appSettingsService = require('../services/appSettings');
const QRCode = require('qrcode');

function sendError(res, error, operation, resellerId) {
  const databaseCode = /^[0-9A-Z]{5}$/.test(String(error.code || '')) ? String(error.code) : null;
  console.error('[Reseller Hotspot] ' + operation + ' failed:', {
    resellerId: resellerId || null, code: error.code || 'UNEXPECTED_ERROR',
    databaseCode, constraint: error.constraint || null, detail: error.detail || null,
    message: error.message, stack: error.stack
  });
  const status = Number.isInteger(error.statusCode) ? error.statusCode : 503;
  if (status >= 500) {
    const publicCode = operation === 'Catalog' && databaseCode === '42P01'
      ? 'HOTSPOT_CATALOG_SCHEMA_MISSING'
      : operation === 'Catalog' && databaseCode === '42703'
        ? 'HOTSPOT_CATALOG_SCHEMA_MISMATCH'
        : operation === 'Catalog'
          ? 'HOTSPOT_CATALOG_QUERY_FAILED'
          : 'RESELLER_HOTSPOT_UNAVAILABLE';
    const message = publicCode === 'HOTSPOT_CATALOG_SCHEMA_MISSING'
      ? 'Hotspot catalog storage is not initialized. Contact FAZ NETWORK support with code HOTSPOT_CATALOG_SCHEMA_MISSING.'
      : publicCode === 'HOTSPOT_CATALOG_SCHEMA_MISMATCH'
        ? 'Hotspot catalog configuration is unavailable. Contact support with code HOTSPOT_CATALOG_SCHEMA_MISMATCH.'
        : publicCode === 'HOTSPOT_CATALOG_QUERY_FAILED'
          ? 'The server could not read the hotspot catalog. Please retry or contact support with code HOTSPOT_CATALOG_QUERY_FAILED.'
          : 'The reseller hotspot request could not be completed. Please retry or contact support with code RESELLER_HOTSPOT_UNAVAILABLE.';
    return res.status(status).json({ success: false, code: publicCode, message });
  }
  return res.status(status).json({
    success: false,
    code: error.code || 'RESELLER_HOTSPOT_REQUEST_FAILED',
    message: error.message || 'The reseller hotspot request failed.'
  });
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

async function lifecycle(req,res){
  const id=resellerId(req);
  try{
    const result=await lifecycleService.listForReseller(id,req.query.limit);
    return res.set('Cache-Control','no-store, no-cache, must-revalidate, private').json({success:true,...result});
  }catch(error){return sendError(res,error,'Voucher lifecycle',id);}
}

async function printBatchPage(req, res) {
  const id = resellerId(req);
  try {
    const result = await issuanceService.getBatch(id, req.params.batchKey);
    if (!result) return res.status(404).send('Voucher batch not found.');
    const brandSettings = await appSettingsService.getBrandSettings();
    const loginHost = String(result.batch.dnsName || 'login.hotspot').trim();
    const loginOrigin = /^https?:\/\//i.test(loginHost) ? loginHost : 'http://' + loginHost;
    const vouchers = await Promise.all(result.vouchers.map(async voucher => {
      const loginUrl = new URL('/login', loginOrigin);
      loginUrl.searchParams.set('username', String(voucher.username || ''));
      loginUrl.searchParams.set('password', String(voucher.password || ''));
      try {
        return { ...voucher, qrDataUrl: await QRCode.toDataURL(loginUrl.toString(), { width: 128, margin: 1, errorCorrectionLevel: 'M' }) };
      } catch (error) {
        console.error('[Reseller Hotspot] Voucher QR generation failed:', error.message || error);
        return { ...voucher, qrDataUrl: null };
      }
    }));
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.render('reseller-voucher-print', {
      title: 'FAZ NETWORK Reseller Voucher Batch',
      resellerName: req.session.auth?.name || req.session.resellerName || 'Reseller',
      brandSettings,
      batch: result.batch,
      vouchers
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

module.exports = { catalog, issueBatch, listBatches, getBatch, lifecycle, printBatchPage };
