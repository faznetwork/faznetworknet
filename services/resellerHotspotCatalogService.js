'use strict';

const db = require('../db');
const { syncPopPackages } = require('./resellerHotspotPackageSyncService');

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
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
    throw Object.assign(new Error('Verified reseller identity is required.'), { statusCode: 403, code: 'RESELLER_ID_REQUIRED' });
  }
  return id;
}
function formatValiditySeconds(value) {
  let seconds;
  try { seconds = BigInt(value ?? 0); } catch (_) { return 'Data / quota package'; }
  if (seconds <= 0n) return 'Data / quota package';
  for (const [unitSeconds, label] of [[86400n, 'day'], [3600n, 'hour'], [60n, 'minute']]) {
    if (seconds % unitSeconds === 0n) {
      const count = seconds / unitSeconds;
      return count.toString() + ' ' + label + (count === 1n ? '' : 's');
    }
  }
  return seconds.toString() + ' seconds';
}
function packageFromRow(row) {
  const retailPrice = String(row.retail_price);
  const wholesalePrice = String(row.wholesale_price);
  return {
    id: String(row.id),
    name: row.package_name,
    profileKey: row.profile_key,
    validity: formatValiditySeconds(row.validity_seconds),
    validitySeconds: String(row.validity_seconds),
    timeLimit: BigInt(row.validity_seconds || 0) > 0n ? String(row.validity_seconds) + 's' : null,
    dataLimit: row.data_limit_bytes != null ? String(row.data_limit_bytes) : null,
    retailPrice,
    wholesalePrice,
    expectedMargin: moneyFromCents(moneyCents(retailPrice) - moneyCents(wholesalePrice))
  };
}
async function getCatalog(resellerIdValue) {
  const resellerId = resellerKey(resellerIdValue);
  return db.withTransaction(async client => {
    const [accountResult, popResult] = await Promise.all([
      client.query(`SELECT id, billing_mode, wallet_balance, receivable_balance, credit_limit,
                           currency, account_status
                    FROM public.reseller_billing_accounts
                    WHERE reseller_id=$1
                    LIMIT 1`, [resellerId]),
      client.query(`SELECT p.id, p.name, p.status, p.reseller_id
                    FROM public.pops p
                    WHERE p.reseller_id=$1 AND p.status='active'
                    ORDER BY p.name ASC, p.id ASC`, [resellerId])
    ]);
    const account = accountResult.rows?.[0] || null;
    const pops = (popResult.rows || []).map(row => ({
      id: Number(row.id),
      name: row.name,
      bindingConfigured: false,
      issuanceReady: false,
      readinessReason: 'HOTSPOT_BINDING_NOT_CONFIGURED',
      packages: []
    }));
    if (!pops.length) {
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
    const bindingResult = await client.query(
      `SELECT id, pop_id, to_jsonb(b)->>'status' AS status, to_jsonb(b)->>'ip_pool' AS ip_pool,
              COALESCE(NULLIF(to_jsonb(b)->>'dns_name',''), NULLIF(to_jsonb(b)->>'hotspot_dns_name','')) AS dns_name
       FROM public.pop_hotspot_bindings b
       WHERE pop_id = ANY($1::integer[])
         AND COALESCE(NULLIF(to_jsonb(b)->>'status','')='active',(to_jsonb(b)->>'is_active')::boolean,FALSE)
       ORDER BY pop_id ASC, id ASC`,
      [popIds]
    );
    const bindingByPopId = new Map((bindingResult.rows || []).map(row => [String(row.pop_id), row]));
    for (const pop of pops) {
      const binding = bindingByPopId.get(String(pop.id));
      pop.bindingConfigured = Boolean(binding);
      pop.dnsName = binding && binding.dns_name ? String(binding.dns_name).trim() : null;
      pop.issuanceReady = Boolean(binding && String(binding.ip_pool || '').trim());
      pop.readinessReason = !binding
        ? 'HOTSPOT_BINDING_NOT_CONFIGURED'
        : pop.issuanceReady ? null : 'IP_POOL_NOT_CONFIGURED';
    }

    const readPackages = async () => client.query(
      `SELECT id, pop_id, package_name, profile_key, validity_seconds, data_limit_bytes,
              retail_price, wholesale_price, is_active
       FROM public.pop_hotspot_packages
       WHERE pop_id = ANY($1::integer[])
       ORDER BY pop_id ASC, id ASC`,
      [popIds]
    );
    let packageResult = await readPackages();
    const packageRowsByPopId = new Map();
    for (const row of packageResult.rows || []) {
      const key = String(row.pop_id);
      if (!packageRowsByPopId.has(key)) packageRowsByPopId.set(key, []);
      packageRowsByPopId.get(key).push(row);
    }

    // Core metadata is the sole source for initial POP package materialization.
    // Materialization runs only for a POP with no package rows yet; the sync
    // itself keeps price, validity, quota and active state in sync with the
    // core profile (see resellerHotspotPackageSyncService).
    for (const pop of pops) {
      if (!pop.bindingConfigured || (packageRowsByPopId.get(String(pop.id)) || []).length) continue;
      const syncResult = await syncPopPackages(client, pop.id);
      if (syncResult.reason && syncResult.reason !== 'core_profile_metadata_not_configured') {
        throw Object.assign(new Error('Core Hotspot package metadata could not be materialized for POP ' + pop.id + '.'), {
          statusCode: 503, code: 'HOTSPOT_PACKAGE_MATERIALIZATION_FAILED'
        });
      }
    }

    packageResult = await readPackages();
    const popById = new Map(pops.map(pop => [String(pop.id), pop]));
    for (const row of packageResult.rows || []) {
      if (row.is_active !== true) continue;
      const pop = popById.get(String(row.pop_id));
      if (pop && pop.bindingConfigured) pop.packages.push(packageFromRow(row));
    }

    return {
      success: true,
      account: account ? {
        id: String(account.id), billingMode: account.billing_mode,
        walletBalance: String(account.wallet_balance), receivableBalance: String(account.receivable_balance),
        creditLimit: String(account.credit_limit), currency: account.currency, status: account.account_status
      } : null,
      pops
    };
  });
}
module.exports = { getCatalog, formatValiditySeconds };
