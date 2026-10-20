'use strict';

const db = require('../db');

function tenantId(req) {
  const id = Number(req.session?.tenantId);
  return req.session?.tenantAdmin === true && Number.isSafeInteger(id) && id > 0 ? id : null;
}
function requireTenant(req, res) {
  const id = tenantId(req);
  if (!id) {
    res.status(403).json({ success: false, code: 'TENANT_CONTEXT_REQUIRED', message: 'A valid tenant session is required.' });
    return null;
  }
  return id;
}
function fail(res, error) {
  console.error('[Tenant Data API]', error?.message || error);
  return res.status(error?.statusCode || 500).json({ success: false, message: error?.message || 'Tenant data request failed.' });
}
function required(value, label, max = 255) {
  const out = String(value ?? '').trim();
  if (!out || out.length > max) throw Object.assign(new Error(label + ' is required and must be at most ' + max + ' characters.'), { statusCode: 400 });
  return out;
}
function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

exports.listCustomers = async (req, res) => {
  const tid = requireTenant(req, res); if (!tid) return;
  try {
    const result = await db.query(
      'SELECT id, full_name, phone, connection_date, username, package_name, profile, monthly_bill, installation_address, status, expiry_date, created_at, updated_at FROM public.customers WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1000',
      [tid]
    );
    return res.json({ success: true, customers: result.rows });
  } catch (error) { return fail(res, error); }
};
exports.createCustomer = async (req, res) => {
  const tid = requireTenant(req, res); if (!tid) return;
  try {
    const body = req.body || {};
    const fullName = required(body.full_name ?? body.fullName ?? body.name, 'full_name', 255);
    const phone = required(body.phone, 'phone', 40);
    const username = required(body.username, 'username', 100);
    const password = required(body.password, 'password', 255);
    const packageName = required(body.package_name ?? body.packageName, 'package_name', 100);
    const profile = required(body.profile ?? packageName, 'profile', 100);
    const bill = Number(body.monthly_bill ?? body.monthlyBill ?? 0);
    if (!Number.isFinite(bill) || bill < 0) throw Object.assign(new Error('monthly_bill must be a non-negative number.'), { statusCode: 400 });
    const result = await db.query(
      `INSERT INTO public.customers
       (tenant_id,full_name,phone,connection_date,username,password,package_name,profile,monthly_bill,nid,installation_address,remarks,status)
       VALUES($1,$2,$3,COALESCE(NULLIF($4,'')::date,CURRENT_DATE),$5,$6,$7,$8,$9,$10,$11,$12,'active')
       RETURNING id,tenant_id,full_name,phone,connection_date,username,package_name,profile,monthly_bill,status,created_at`,
      [tid,fullName,phone,String(body.connection_date || ''),username,password,packageName,profile,bill,body.nid || null,body.installation_address || body.address || null,body.remarks || null]
    );
    return res.status(201).json({ success: true, customer: result.rows[0] });
  } catch (error) { return fail(res, error); }
};
exports.updateCustomer = async (req, res) => {
  const tid = requireTenant(req, res); if (!tid) return;
  const id = positiveId(req.params.id); if (!id) return res.status(400).json({ success: false, message: 'Invalid customer id.' });
  try {
    const body = req.body || {};
    const result = await db.query(
      `UPDATE public.customers SET
       full_name=COALESCE($3,full_name), phone=COALESCE($4,phone),
       package_name=COALESCE($5,package_name), profile=COALESCE($6,profile),
       monthly_bill=COALESCE($7,monthly_bill), installation_address=COALESCE($8,installation_address),
       status=COALESCE($9,status), updated_at=NOW()
       WHERE tenant_id=$1 AND id=$2
       RETURNING id,tenant_id,full_name,phone,username,package_name,profile,monthly_bill,status,updated_at`,
      [tid,id,body.full_name ?? null,body.phone ?? null,body.package_name ?? null,body.profile ?? null,
       body.monthly_bill == null ? null : Number(body.monthly_bill),body.installation_address ?? null,body.status ?? null]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Customer not found for this tenant.' });
    return res.json({ success: true, customer: result.rows[0] });
  } catch (error) { return fail(res, error); }
};
exports.deleteCustomer = async (req, res) => {
  const tid = requireTenant(req, res); if (!tid) return;
  const id = positiveId(req.params.id); if (!id) return res.status(400).json({ success: false, message: 'Invalid customer id.' });
  try {
    const result = await db.query('DELETE FROM public.customers WHERE tenant_id=$1 AND id=$2 RETURNING id', [tid,id]);
    if (!result.rowCount) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Customer not found for this tenant.' });
    return res.json({ success: true, id: result.rows[0].id });
  } catch (error) { return fail(res, error); }
};

exports.listVouchers = async (req, res) => {
  const tid = requireTenant(req, res); if (!tid) return;
  try {
    const result = await db.query('SELECT id,tenant_id,username,profile,validity,price,status,comment,transaction_id,created_at FROM public.hotspot_vouchers WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1000', [tid]);
    return res.json({ success: true, vouchers: result.rows });
  } catch (error) { return fail(res, error); }
};
exports.createVoucher = async (req, res) => {
  const tid = requireTenant(req, res); if (!tid) return;
  try {
    const body = req.body || {};
    const username = required(body.username, 'username', 100);
    const password = required(body.password, 'password', 100);
    const profile = required(body.profile, 'profile', 100);
    const validity = required(body.validity, 'validity', 50);
    const price = Number(body.price ?? 0);
    if (!Number.isFinite(price) || price < 0) throw Object.assign(new Error('price must be non-negative.'), { statusCode: 400 });
    const result = await db.query(
      `INSERT INTO public.hotspot_vouchers(tenant_id,username,password,profile,validity,price,status,comment)
       VALUES($1,$2,$3,$4,$5,$6,'unused',$7)
       RETURNING id,tenant_id,username,profile,validity,price,status,comment,created_at`,
      [tid,username,password,profile,validity,price,body.comment || null]
    );
    return res.status(201).json({ success: true, voucher: result.rows[0] });
  } catch (error) { return fail(res, error); }
};
exports.updateVoucher = async (req, res) => {
  const tid = requireTenant(req, res); if (!tid) return;
  const id = positiveId(req.params.id); if (!id) return res.status(400).json({ success: false, message: 'Invalid voucher id.' });
  try {
    const body = req.body || {};
    const result = await db.query(
      `UPDATE public.hotspot_vouchers SET
       profile=COALESCE($3,profile),validity=COALESCE($4,validity),price=COALESCE($5,price),
       status=COALESCE($6,status),comment=COALESCE($7,comment)
       WHERE tenant_id=$1 AND id=$2
       RETURNING id,tenant_id,username,profile,validity,price,status,comment`,
      [tid,id,body.profile ?? null,body.validity ?? null,body.price == null ? null : Number(body.price),body.status ?? null,body.comment ?? null]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Voucher not found for this tenant.' });
    return res.json({ success: true, voucher: result.rows[0] });
  } catch (error) { return fail(res, error); }
};
exports.deleteVoucher = async (req, res) => {
  const tid = requireTenant(req, res); if (!tid) return;
  const id = positiveId(req.params.id); if (!id) return res.status(400).json({ success: false, message: 'Invalid voucher id.' });
  try {
    const result = await db.query('DELETE FROM public.hotspot_vouchers WHERE tenant_id=$1 AND id=$2 RETURNING id', [tid,id]);
    if (!result.rowCount) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Voucher not found for this tenant.' });
    return res.json({ success: true, id: result.rows[0].id });
  } catch (error) { return fail(res, error); }
};

exports.listTransactions = async (req, res) => {
  const tid = requireTenant(req, res); if (!tid) return;
  try {
    const result = await db.query('SELECT id,tenant_id,channel,trx_id,sender_phone,amount,status,matched_username,used,created_at FROM public.transactions WHERE tenant_id=$1 ORDER BY id DESC LIMIT 1000', [tid]);
    return res.json({ success: true, transactions: result.rows });
  } catch (error) { return fail(res, error); }
};
exports.updateTransaction = async (req, res) => {
  const tid = requireTenant(req, res); if (!tid) return;
  const id = positiveId(req.params.id); if (!id) return res.status(400).json({ success: false, message: 'Invalid transaction id.' });
  try {
    const body = req.body || {};
    const status = body.status == null ? null : String(body.status);
    if (status !== null && !['processed','unmatched','duplicate'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Unsupported transaction status.' });
    }
    const result = await db.query(
      `UPDATE public.transactions SET
       sender_phone=COALESCE($3,sender_phone), amount=COALESCE($4,amount),
       status=COALESCE($5,status), matched_username=COALESCE($6,matched_username)
       WHERE tenant_id=$1 AND id=$2
       RETURNING id,tenant_id,channel,trx_id,sender_phone,amount,status,matched_username,used,created_at`,
      [tid,id,body.sender_phone ?? null,body.amount == null ? null : Number(body.amount),status,body.matched_username ?? null]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Transaction not found for this tenant.' });
    return res.json({ success: true, transaction: result.rows[0] });
  } catch (error) { return fail(res, error); }
};

exports.createTransaction = async (req, res) => {
  const tid = requireTenant(req, res); if (!tid) return;
  try {
    const body = req.body || {};
    const channel = required(body.channel, 'channel', 20).toLowerCase();
    if (!['bkash','nagad','rocket','upay'].includes(channel)) throw Object.assign(new Error('Unsupported payment channel.'), { statusCode: 400 });
    const trxId = required(body.trx_id ?? body.trxId, 'trx_id', 100);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) throw Object.assign(new Error('amount must be non-negative.'), { statusCode: 400 });
    const status = ['processed','unmatched','duplicate'].includes(body.status) ? body.status : 'unmatched';
    const result = await db.query(
      `INSERT INTO public.transactions(tenant_id,channel,trx_id,sender_phone,amount,status,matched_username,used)
       VALUES($1,$2,$3,$4,$5,$6,$7,false)
       RETURNING id,tenant_id,channel,trx_id,sender_phone,amount,status,matched_username,used,created_at`,
      [tid,channel,trxId,body.sender_phone || null,amount,status,body.matched_username || null]
    );
    return res.status(201).json({ success: true, transaction: result.rows[0] });
  } catch (error) { return fail(res, error); }
};
