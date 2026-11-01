'use strict';

const db = require('../db');
const customerController = require('./customerController');
const { ensureBillingAccount } = require('../services/resellerBillingAccountService');
const resellerFinanceService = require('../services/resellerFinanceService');

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
    if (!Number.isSafeInteger(resellerId) || resellerId < 1) throw Object.assign(new Error('Verified reseller identity is required.'), { statusCode: 403 });
    const billingAccount = await ensureBillingAccount(resellerId);
    const popResult = await db.query(
      'SELECT id, name, area_zone, status, vlan_id, pppoe_enabled, pppoe_ip_pool FROM pops WHERE reseller_id=$1 ORDER BY name ASC, id ASC',
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
      pops: popResult.rows,
      billingAccount, walletBalance: billingAccount.wallet_balance,
      creditLimit: billingAccount.credit_limit, receivableBalance: billingAccount.receivable_balance,
      availableCredit: billingAccount.availableCredit
    });
  } catch (error) {
    return handleError(res, error, 'Overview');
  }
}

async function renderDashboard(req, res) {
  try {
    const resellerId = Number(req.auth?.resellerId);
    if (!Number.isSafeInteger(resellerId) || resellerId < 1) throw Object.assign(new Error('Verified reseller identity is required.'), { statusCode: 403 });
    const billingAccount = req.billingAccount || null;
    res.set('Cache-Control','no-store, no-cache, must-revalidate, private');
    return res.render('reseller-dashboard',{title:'Network Overview · Reseller Workspace',
      resellerName:req.session.auth?.name||req.session.resellerName||'Reseller',
      activePath:req.path,currentPath:req.path,billingAccount,
      billingAccountUnavailable: !billingAccount});
  } catch(error) {
    console.error('[Reseller Portal] Dashboard billing snapshot failed:',error);
    return res.status(error.statusCode||503).send(error.statusCode && error.statusCode < 500 ? error.message : 'Reseller dashboard is temporarily unavailable. Please retry or contact support.');
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

async function packages(req, res) {
  try {
    // Read-only catalog: do not open MikroTik connections while rendering the form.
    const result = await db.query(`SELECT id, plan_name AS name,
      COALESCE(profile_name, plan_name) AS profile_name, price, duration_months
      FROM packages
      WHERE LOWER(COALESCE(profile_name, plan_name, '')) NOT LIKE '%default%'
        AND LOWER(COALESCE(profile_name, plan_name, '')) <> 'vpn'
        AND LOWER(COALESCE(profile_name, plan_name, '')) NOT LIKE 'template%'
        AND LOWER(COALESCE(profile_name, plan_name, '')) NOT LIKE 'internal%'
        AND LOWER(COALESCE(profile_name, plan_name, '')) NOT LIKE 'system%'
      ORDER BY plan_name ASC, id ASC`);
    return res.json({ success: true, packages: result.rows.map(row => ({
      id: String(row.id), name: row.name, profileName: row.profile_name,
      price: Number(row.price || 0), durationMonths: Number(row.duration_months || 1)
    })) });
  } catch (error) { return handleError(res, error, 'Package catalog'); }
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
  delete body.pppoe_ip_pool;
  delete body.pppoe_enabled;
  req.body = body;
  return customerController.createCustomer(req, res);
}

async function getCustomer(req, res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const key = customerKey(req.params.id);
  if (!key) return res.status(400).json({ success: false, message: 'Customer identifier is required.' });

  try {
    const popIds = resellerPopIds(req);
    const scoped = await db.query(
      `SELECT c.id, c.full_name, c.username, c.password AS pppoe_password, c.phone, c.email,
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

async function renewCustomer(req, res) {
  const customerId = String(req.params.id || '').trim();
  const resellerId = Number(req.auth?.resellerId);
  const idempotencyKey = req.get?.('Idempotency-Key') || req.headers?.['idempotency-key'];
  if (!/^[1-9]\d{0,18}$/.test(customerId)) return res.status(400).json({ success:false, message:'A valid customer ID is required.' });
  if (!idempotencyKey) return res.status(400).json({ success:false, code:'INVALID_IDEMPOTENCY_KEY', message:'A renewal request key is required. Please retry from the customer directory.' });
  try {
    const outcome = await db.withTransaction(async client => {
      const result = await client.query(
        `SELECT c.id,c.full_name,c.username,c.password,c.phone,c.package_name,c.profile,c.monthly_bill,
                c.expiration_date,c.billing_cycle,c.billing_duration_days,c.router_id,c.status,
                c.provisioning_status,c.pop_id,
                COALESCE(pkg.price,c.monthly_bill) AS charge,
                COALESCE(pkg.profile_name,pkg.plan_name,c.profile) AS router_profile,
                pu.caller_id
         FROM customers c
         INNER JOIN pops p ON p.id=c.pop_id AND p.reseller_id=$2
         LEFT JOIN packages pkg ON LOWER(pkg.plan_name)=LOWER(c.package_name)
                              OR LOWER(pkg.profile_name)=LOWER(c.profile)
         LEFT JOIN pppoe_users pu ON LOWER(pu.username)=LOWER(c.username)
         WHERE c.id=$1 AND c.pop_id=ANY($3::bigint[])
         ORDER BY pkg.id ASC LIMIT 1 FOR UPDATE OF c`,
        [customerId, resellerId, resellerPopIds(req)]
      );
      const customer = result.rows[0];
      if (!customer) return { kind:'not_found' };
      const existing = await resellerFinanceService.findCustomerCharge(client, resellerId, customer.id, idempotencyKey);
      if (existing) {
        const dateMatch = String(existing.existing.description || '').match(/through (\d{4}-\d{2}-\d{2})$/);
        if (!dateMatch) throw Object.assign(new Error('The previous renewal charge is missing its expiration record.'), { statusCode:409, code:'RENEWAL_REPLAY_INCOMPLETE' });
        return { kind:'renewal', customer, expirationDate:dateMatch[1], billing:{ replayed:true, ledgerEntryId:String(existing.existing.id), billingMode:existing.existing.account_type==='wallet'?'prepaid':'postpaid' } };
      }
      const price = Number(customer.charge || 0);
      if (!Number.isFinite(price) || price <= 0) throw Object.assign(new Error('This customer has no positive package price configured.'), { statusCode:409, code:'ZERO_PACKAGE_PRICE' });
      const expirationDate = customerController.nextBillingExpiryDate(customer.expiration_date, customer.billing_cycle, customer.billing_duration_days);
      const billingInput = {
        resellerId, customerId:customer.id, amount:String(price.toFixed(2)), idempotencyKey,
        description:'Manual renewal for customer ' + customer.username + ' through ' + expirationDate,
        actorUserId:resellerId
      };
      const prepared = await resellerFinanceService.prepareCustomerCharge(client, billingInput);
      const billing = await resellerFinanceService.postCustomerCharge(client, billingInput, prepared);
      await client.query(
        `UPDATE customers SET expiration_date=$1::date,paid_until=$1::date,billing_status='paid',
           last_paid_at=NOW(),provisioning_status='pending',updated_at=NOW() WHERE id=$2`,
        [expirationDate, customer.id]
      );
      return { kind:'renewal', customer, expirationDate, billing };
    });
    if (outcome.kind==='not_found') return res.status(404).json({ success:false, message:'Customer was not found in your assigned POPs.' });

    const { customer, expirationDate, billing } = outcome;
    try {
      const router = await customerController.getCustomerRouterService(customer);
      const comment = customerController.buildExpirationComment(customer.full_name, customer.phone, expirationDate);
      await router.updateSecret(customer.username, {
        password:customer.password, profile:customer.router_profile || customer.profile,
        comment, disabled:false
      });
      await router.kickActiveUser(customer.username).catch(() => null);
      await db.withTransaction(async client => {
        await client.query(
          `UPDATE customers SET status='active',provisioning_status='provisioned',updated_at=NOW() WHERE id=$1`,
          [customer.id]
        );
        await client.query(
          `INSERT INTO pppoe_users(username,password,profile,service,disabled,comment,phone,router_id,expiry_date,status,caller_id,billing_status,last_paid_at,paid_until,synced_at,updated_at)
           VALUES($1,$2,$3,'pppoe',false,$4,$5,$6,$7,'active',$8,'paid',NOW(),$7,NOW(),NOW())
           ON CONFLICT(username) DO UPDATE SET password=EXCLUDED.password,profile=EXCLUDED.profile,disabled=false,
             comment=EXCLUDED.comment,phone=EXCLUDED.phone,router_id=EXCLUDED.router_id,expiry_date=EXCLUDED.expiry_date,
             status='active',caller_id=COALESCE(NULLIF(EXCLUDED.caller_id,''),pppoe_users.caller_id),billing_status='paid',
             last_paid_at=NOW(),paid_until=EXCLUDED.paid_until,synced_at=NOW(),updated_at=NOW()`,
          [customer.username,customer.password,customer.router_profile||customer.profile,comment,customer.phone,customer.router_id,expirationDate,customer.caller_id||null]
        );
      });
    } catch (routerError) {
      console.error('[Reseller Renewal] Router provisioning remains pending:', routerError.message);
      return res.status(503).json({ success:false, code:'RENEWAL_PROVISIONING_PENDING', charged:true, expirationDate, message:'Wallet charged and renewal recorded. Router provisioning is pending; retry this request to finish without charging again.' });
    }
    return res.json({ success:true, replayed:Boolean(billing.replayed), expirationDate, billing:{ billingMode:billing.billingMode, ledgerEntryId:billing.ledgerEntryId, ...(billing.account ? { walletBalance:String(billing.account.wallet_balance), receivableBalance:String(billing.account.receivable_balance) } : {}) }, message:'Customer renewed successfully.' });
  } catch (error) {
    if (error.code==='INSUFFICIENT_WALLET_BALANCE') return res.status(400).json({ success:false, code:error.code, message:error.message });
    return res.status(error.statusCode || 503).json({ success:false, code:error.code, message:error.statusCode ? error.message : 'Customer renewal is temporarily unavailable.' });
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

module.exports = { overview, renderDashboard, listCustomers, packages, createCustomer, getCustomer, renewCustomer, liveSession, paymentHistory };
