'use strict';

const db = require('../db');

function validResellerId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw Object.assign(new Error('Verified reseller identity is required.'), { statusCode: 403 });
  }
  return id;
}

function snapshot(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    reseller_id: Number(row.reseller_id),
    billing_mode: String(row.billing_mode),
    wallet_balance: String(row.wallet_balance ?? '0.00'),
    credit_limit: String(row.credit_limit ?? '0.00'),
    receivable_balance: String(row.receivable_balance ?? '0.00'),
    availableCredit: (Number(row.credit_limit || 0) - Number(row.receivable_balance || 0)).toFixed(2),
    currency: String(row.currency || 'BDT'),
    account_status: String(row.account_status || 'unknown')
  };
}

async function ensureBillingAccount(resellerIdValue, client = db) {
  const resellerId = validResellerId(resellerIdValue);
  await client.query(
    `INSERT INTO public.reseller_billing_accounts
       (reseller_id,billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status,created_at,updated_at)
     VALUES ($1,'prepaid',0.00,0.00,0.00,'BDT','active',NOW(),NOW())
     ON CONFLICT (reseller_id) DO NOTHING`,
    [resellerId]
  );
  const result = await client.query(
    'SELECT id,reseller_id,billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status FROM public.reseller_billing_accounts WHERE reseller_id=$1 LIMIT 1',
    [resellerId]
  );
  return snapshot(result.rows?.[0]);
}

module.exports = { ensureBillingAccount, snapshot };
