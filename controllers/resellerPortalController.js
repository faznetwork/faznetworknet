'use strict';

const db = require('../db');
const customerController = require('./customerController');

function resellerPopIds(req) {
  const ids = req.tenantScope?.popIds;
  if (!Array.isArray(ids)) {
    throw Object.assign(new Error('Verified reseller POP scope is required.'), { statusCode: 403 });
  }
  return ids.map(Number).filter(id => Number.isSafeInteger(id) && id > 0);
}

function customerKey(value) {
  return String(value ?? '').trim().slice(0, 100);
}

function handleError(res, error, operation) {
  console.error('[Reseller Portal] ' + operation + ' failed:', error);
  return res.status(error.statusCode || 503).json({
    success: false,
    message: error.statusCode ? error.message : 'Reseller portal data is temporarily unavailable.'
  });
}

async function overview(req, res) {
  try {
    const popIds = resellerPopIds(req);
    const resellerId = Number(req.auth?.resellerId);
    const popResult = await db.query(
      'SELECT id, name, area_zone, status, vlan_id, mikrotik_ip_pool FROM pops WHERE reseller_id=$1 ORDER BY name ASC, id ASC',
      [resellerId]
    );

    const customerResult = await db.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE status='active'
             AND (expiration_date >= CURRENT_DATE OR expiration_date IS NULL)
         )::int AS active_customer_count,
         COUNT(*) FILTER (
           WHERE status <> 'active'
              OR (expiration_date IS NOT NULL AND expiration_date < CURRENT_DATE)
         )::int AS inactive_expired_customer_count
       FROM customers
       WHERE pop_id = ANY($1::bigint[])`,
      [popIds]
    );

    const paymentResult = await db.query(
      `SELECT COUNT(t.id)::int AS renewal_count,
              COALESCE(SUM(t.amount), 0)::numeric(14,2) AS collection_amount
       FROM transactions t
       INNER JOIN customers c
         ON LOWER(c.username) = LOWER(t.matched_username)
       WHERE c.pop_id = ANY($1::bigint[])
         AND t.matched_username IS NOT NULL
         AND LOWER(t.matched_username) = LOWER(c.username)
         AND t.service_type = 'pppoe'
         AND t.status = 'PAID'
         AND t.created_at >= (
           date_trunc('month', NOW() AT TIME ZONE 'Asia/Dhaka')
           AT TIME ZONE 'Asia/Dhaka'
         )
         AND t.created_at < (
           (date_trunc('month', NOW() AT TIME ZONE 'Asia/Dhaka') + INTERVAL '1 month')
           AT TIME ZONE 'Asia/Dhaka'
         )`,
      [popIds]
    );

    const customers = customerResult.rows[0] || {};
    const payments = paymentResult.rows[0] || {};
    return res.json({
      success: true,
      metrics: {
        assignedPopCount: popResult.rows.length,
        activeCustomerCount: Number(customers.active_customer_count || 0),
        inactiveExpiredCustomerCount: Number(customers.inactive_expired_customer_count || 0),
        monthlyRenewalCount: Number(payments.renewal_count || 0),
        monthlyCollectionAmount: String(payments.collection_amount || '0.00')
      },
      pops: popResult.rows
    });
  } catch (error) {
    return handleError(res, error, 'Overview');
  }
}

async function listCustomers(req, res) {
  try {
    const popIds = resellerPopIds(req);
    const result = await db.query(
      `SELECT c.id, c.full_name, c.username, c.phone, c.package_name,
              c.status, c.expiration_date, c.monthly_bill, c.pop_id,
              p.name AS pop_name
       FROM customers c
       INNER JOIN pops p ON p.id = c.pop_id
       WHERE c.pop_id = ANY($1::bigint[])
         AND p.reseller_id = $2
       ORDER BY c.full_name ASC, c.id ASC`,
      [popIds, Number(req.auth.resellerId)]
    );
    return res.json({ success: true, customers: result.rows });
  } catch (error) {
    return handleError(res, error, 'Customer directory');
  }
}

async function createCustomer(req, res) {
  const resellerId = Number(req.auth?.resellerId);
  const scopedResellerId = Number(req.tenantScope?.resellerId);
  const popIds = resellerPopIds(req);
  const requestedPopId = Number(req.body?.pop_id);

  if (!Number.isSafeInteger(resellerId) || resellerId < 1 || resellerId !== scopedResellerId) {
    return res.status(403).json({ success: false, message: 'Verified reseller identity and tenant scope do not match.' });
  }
  if (!Number.isSafeInteger(requestedPopId) || requestedPopId < 1) {
    return res.status(400).json({ success: false, message: 'Select one of your assigned active POPs before creating a customer.' });
  }
  if (!popIds.includes(requestedPopId)) {
    return res.status(403).json({ success: false, message: 'The selected POP is not assigned to your reseller account.' });
  }

  // POP ownership is checked again under a database row lock by the existing
  // customer creation transaction. Never accept tenant/network ownership fields
  // from the browser; VLAN and MikroTik IP Pool remain POP-owned configuration.
  const body = { ...(req.body || {}), pop_id: requestedPopId };
  delete body.reseller_id;
  delete body.vlan_id;
  delete body.mikrotik_ip_pool;
  req.body = body;
  return customerController.createCustomer(req, res);
}

async function getCustomer(req, res) {
  const key = customerKey(req.params.id);
  if (!key) return res.status(400).json({ success: false, message: 'Customer identifier is required.' });

  try {
    const popIds = resellerPopIds(req);
    const scoped = await db.query(
      `SELECT c.id, c.full_name, c.username, c.phone, c.email,
              c.package_name, c.profile, c.status, c.expiration_date,
              c.monthly_bill, c.connection_date, c.installation_address,
              c.pop_id, p.name AS pop_name, p.area_zone AS pop_area_zone
       FROM customers c
       INNER JOIN pops p ON p.id = c.pop_id
       WHERE (c.id::text = $1 OR LOWER(c.username) = LOWER($1))
         AND c.pop_id = ANY($2::bigint[])
         AND p.reseller_id = $3
       LIMIT 1`,
      [key, popIds, Number(req.auth.resellerId)]
    );

    if (!scoped.rows.length) {
      const exists = await db.query(
        'SELECT 1 FROM customers WHERE id::text=$1 OR LOWER(username)=LOWER($1) LIMIT 1',
        [key]
      );
      if (exists.rows.length) {
        return res.status(403).json({ success: false, message: 'Customer belongs to another reseller or POP.' });
      }
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    return res.json({ success: true, customer: scoped.rows[0] });
  } catch (error) {
    return handleError(res, error, 'Customer profile');
  }
}

async function liveSession(req, res) {
  // Reuse the established target-router status resolver after this router has
  // authenticated the reseller and loaded the reseller's POP tenant scope.
  return customerController.getCustomerLiveSession(req, res);
}

async function paymentHistory(req, res) {
  const key = customerKey(req.params.id);
  if (!key) return res.status(400).json({ success: false, message: 'Customer identifier is required.' });

  try {
    const popIds = resellerPopIds(req);
    const customerResult = await db.query(
      `SELECT c.id, c.username
       FROM customers c
       INNER JOIN pops p ON p.id = c.pop_id
       WHERE (c.id::text = $1 OR LOWER(c.username) = LOWER($1))
         AND c.pop_id = ANY($2::bigint[])
         AND p.reseller_id = $3
       LIMIT 1`,
      [key, popIds, Number(req.auth.resellerId)]
    );
    const customer = customerResult.rows[0];
    if (!customer) {
      const exists = await db.query(
        'SELECT 1 FROM customers WHERE id::text=$1 OR LOWER(username)=LOWER($1) LIMIT 1',
        [key]
      );
      if (exists.rows.length) {
        return res.status(403).json({ success: false, message: 'Customer belongs to another reseller or POP.' });
      }
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const result = await db.query(
      `SELECT t.id, t.trx_id, t.amount, t.channel, t.status, t.created_at
       FROM transactions t
       INNER JOIN customers c
         ON LOWER(c.username) = LOWER(t.matched_username)
       WHERE c.id = $1
         AND c.pop_id = ANY($2::bigint[])
         AND LOWER(t.matched_username) = LOWER(c.username)
         AND t.matched_username IS NOT NULL
         AND t.service_type = 'pppoe'
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT 100`,
      [customer.id, popIds]
    );
    return res.json({ success: true, payments: result.rows });
  } catch (error) {
    return handleError(res, error, 'Customer payment history');
  }
}

module.exports = { overview, listCustomers, createCustomer, getCustomer, liveSession, paymentHistory };
