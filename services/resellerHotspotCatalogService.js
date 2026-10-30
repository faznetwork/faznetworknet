'use strict';
const db = require('../db');

function moneyCents(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,12})(?:\.(\d{1,2}))?$/);
  if (!match) throw Object.assign(new Error('The configured POP package price is invalid.'), { statusCode: 503, code: 'INVALID_PACKAGE_PRICE' });
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || '0');
}
function moneyFromCents(value) {
  const amount = BigInt(value);
  return (amount / 100n).toString() + '.' + (amount % 100n).toString().padStart(2, '0');
}
function resellerKey(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error('Verified reseller identity is required.'), { statusCode: 403, code: 'RESELLER_ID_REQUIRED' });
  return id;
}
function isSchemaCompatibilityError(error) {
  return error && (error.code === '42703' || error.code === '42P01');
}
function logOptionalCatalogFallback(relation, error) {
  console.warn('[Reseller Hotspot] Optional catalog relation unavailable; returning a reduced catalog:', {
    relation, databaseCode: error.code, message: error.message
  });
}
async function getOptionalRows(sql, values, relation) {
  try {
    const result = await db.query(sql, values);
    return result.rows || [];
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    logOptionalCatalogFallback(relation, error);
    return [];
  }
}
async function getCatalog(resellerIdValue) {
  const resellerId = resellerKey(resellerIdValue);

  // Keep the POP ownership lookup independent of voucher metadata. These are
  // the stable POP identity/lifecycle columns used by the reseller workspace.
  const [accountRows, popResult] = await Promise.all([
    getOptionalRows(`SELECT id, billing_mode, wallet_balance, receivable_balance, credit_limit,
                            currency, account_status
                     FROM public.reseller_billing_accounts
                     WHERE reseller_id=$1
                     LIMIT 1`, [resellerId], 'reseller_billing_accounts'),
    db.query(`SELECT p.id, p.name, p.status, p.reseller_id
              FROM public.pops p
              WHERE p.reseller_id=$1 AND p.status='active'
              ORDER BY p.name ASC, p.id ASC`, [resellerId])
  ]);

  const pops = (popResult.rows || []).map(row => ({
    id: Number(row.id), name: row.name, bindingConfigured: false, packages: []
  }));
  if (!pops.length) {
    const account = accountRows[0] || null;
    return {
      success: true,
      account: account ? {
        id: String(account.id), billingMode: account.billing_mode,
        walletBalance: String(account.wallet_balance), receivableBalance: String(account.receivable_balance),
        creditLimit: String(account.credit_limit), currency: account.currency, status: account.account_status
      } : null,
      pops
    };
  }

  const popIds = pops.map(pop => pop.id);
  const bindings = await getOptionalRows(
    `SELECT id, pop_id, status, ip_pool
     FROM public.pop_hotspot_bindings
     WHERE pop_id = ANY($1::bigint[]) AND status='active'
     ORDER BY pop_id ASC, id ASC`,
    [popIds],
    'pop_hotspot_bindings'
  );
  const bindingPopIds = new Set(bindings.filter(row => String(row.ip_pool || '').trim()).map(row => String(row.pop_id)));
  for (const pop of pops) pop.bindingConfigured = bindingPopIds.has(String(pop.id));

  if (bindings.length) {
    const packages = await getOptionalRows(
      `SELECT id, pop_id, package_name, profile_key, validity,
              retail_price, wholesale_price
       FROM public.pop_hotspot_packages
       WHERE pop_id = ANY($1::bigint[]) AND status='active'
       ORDER BY pop_id ASC, id ASC`,
      [popIds],
      'pop_hotspot_packages'
    );
    const popById = new Map(pops.map(pop => [String(pop.id), pop]));
    for (const row of packages) {
      const pop = popById.get(String(row.pop_id));
      if (!pop || !pop.bindingConfigured) continue;
      pop.packages.push({
        id: String(row.id), name: row.package_name, profileKey: row.profile_key,
        validity: row.validity, timeLimit: null, dataLimit: null,
        retailPrice: String(row.retail_price), wholesalePrice: String(row.wholesale_price),
        expectedMargin: moneyFromCents(moneyCents(row.retail_price) - moneyCents(row.wholesale_price))
      });
    }
  }

  const account = accountRows[0] || null;
  return {
    success: true,
    account: account ? {
      id: String(account.id), billingMode: account.billing_mode,
      walletBalance: String(account.wallet_balance), receivableBalance: String(account.receivable_balance),
      creditLimit: String(account.credit_limit), currency: account.currency, status: account.account_status
    } : null,
    pops
  };
}
module.exports = { getCatalog };
