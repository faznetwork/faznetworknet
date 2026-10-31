'use strict';

const crypto = require('crypto');
const db = require('../db');
const hotspotVoucherGenerator = require('./hotspotVoucherGenerator');

function serviceError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}

function resellerKey(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw serviceError('Verified reseller identity is required.', 403, 'RESELLER_ID_REQUIRED');
  return id;
}

function positiveId(value, label) {
  const text = String(value ?? '').trim();
  if (!/^[1-9]\d{0,18}$/.test(text) || BigInt(text) > 9223372036854775807n) throw serviceError('A valid ' + label + ' is required.', 400, 'INVALID_' + label.toUpperCase());
  return text;
}

function toCents(value, label) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{1,12})(?:\.(\d{1,2}))?$/);
  if (!match) throw serviceError('The configured ' + label + ' is invalid.', 409, 'INVALID_FINANCIAL_CONFIGURATION');
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || '0');
}

function fromCents(value) {
  const amount = BigInt(value);
  return (amount / 100n).toString() + '.' + (amount % 100n).toString().padStart(2, '0');
}

function validateQuantity(value) {
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 500) {
    throw serviceError('Voucher quantity must be a whole number from 1 to 500.', 400, 'INVALID_QUANTITY');
  }
  return quantity;
}

function validateIdempotencyKey(value) {
  const key = String(value ?? '').trim();
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key)) {
    throw serviceError('A valid Idempotency-Key header (8–120 safe characters) is required.', 400, 'INVALID_IDEMPOTENCY_KEY');
  }
  return key;
}

function validateBatchKey(value) {
  const key = String(value ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw serviceError('Invalid voucher batch reference.', 400, 'INVALID_BATCH_KEY');
  }
  return key;
}

function assertSameRequest(existing, input) {
  if (
    Number(existing.pop_id) !== Number(input.popId) ||
    String(existing.package_id) !== String(input.packageId) ||
    Number(existing.quantity) !== Number(input.quantity)
  ) {
    throw serviceError('This Idempotency-Key was already used for a different voucher request.', 409, 'IDEMPOTENCY_KEY_CONFLICT');
  }
}

async function loadBatchDetail(client, resellerId, batchKey) {
  const batchResult = await client.query(
    `SELECT b.id, b.batch_key, b.reseller_id, b.pop_id, b.billing_account_id,
            b.package_id, b.profile_key,
            COALESCE(
              NULLIF(to_jsonb(b)->>'validity',''),
              NULLIF(to_jsonb(pkg)->>'validity',''),
              NULLIF(to_jsonb(pkg)->>'duration',''),
              NULLIF(to_jsonb(pkg)->>'validity_days',''),
              NULLIF(to_jsonb(pkg)->>'validity_period',''),
              'N/A'
            ) AS validity,
            b.quantity,b.retail_unit_price,b.wholesale_unit_price,
            COALESCE(
              NULLIF(to_jsonb(b)->>'retail_total','')::numeric,
              NULLIF(to_jsonb(b)->>'total_cost','')::numeric,
              NULLIF(to_jsonb(b)->>'retail_unit_price','')::numeric * b.quantity,
              0::numeric
            ) AS retail_total,
            COALESCE(
              NULLIF(to_jsonb(b)->>'wholesale_total','')::numeric,
              NULLIF(to_jsonb(b)->>'wholesale_unit_price','')::numeric * b.quantity,
              0::numeric
            ) AS wholesale_total,
            COALESCE(
              NULLIF(to_jsonb(b)->>'margin_total','')::numeric,
              (
                COALESCE(NULLIF(to_jsonb(b)->>'retail_total','')::numeric,
                         NULLIF(to_jsonb(b)->>'total_cost','')::numeric,
                         NULLIF(to_jsonb(b)->>'retail_unit_price','')::numeric * b.quantity,
                         0::numeric)
                -
                COALESCE(NULLIF(to_jsonb(b)->>'wholesale_total','')::numeric,
                         NULLIF(to_jsonb(b)->>'wholesale_unit_price','')::numeric * b.quantity,
                         0::numeric)
              ),
              0::numeric
            ) AS margin_total,
            b.billing_mode,b.status,b.created_at
     FROM public.reseller_voucher_batches b
     LEFT JOIN public.pop_hotspot_packages pkg ON pkg.id=b.package_id
     WHERE b.batch_key=$1::uuid AND b.reseller_id=$2
     LIMIT 1`,
    [batchKey, resellerId]
  );
  const batch = batchResult.rows?.[0];
  if (!batch) return null;

  const itemResult = await client.query(
    `SELECT v.id, v.username, v.password, v.profile, v.validity,
            v.time_limit, v.data_limit, v.status, v.created_at
     FROM public.reseller_voucher_issuance_items i
     INNER JOIN public.hotspot_vouchers v ON v.id=i.voucher_id
     WHERE i.batch_id=$1
     ORDER BY i.id ASC`,
    [batch.id]
  );

  return {
    batch: {
      id: String(batch.id),
      batchKey: batch.batch_key,
      popId: Number(batch.pop_id),
      packageId: String(batch.package_id),
      profileKey: batch.profile_key,
      validity: batch.validity,
      quantity: Number(batch.quantity),
      retailUnitPrice: String(batch.retail_unit_price),
      wholesaleUnitPrice: String(batch.wholesale_unit_price),
      retailTotal: String(batch.retail_total),
      wholesaleTotal: String(batch.wholesale_total),
      marginTotal: String(batch.margin_total),
      billingMode: batch.billing_mode,
      status: batch.status,
      createdAt: batch.created_at
    },
    vouchers: (itemResult.rows || []).map(row => ({
      id: String(row.id),
      username: row.username,
      password: row.password,
      profile: row.profile,
      validity: row.validity,
      timeLimit: row.time_limit || null,
      dataLimit: row.data_limit || null,
      status: row.status,
      createdAt: row.created_at
    }))
  };
}

async function issueBatch(input) {
  const resellerId = resellerKey(input.resellerId);
  const popId = Number(input.popId);
  if (!Number.isSafeInteger(popId) || popId < 1 || popId > 2147483647) throw serviceError('Select an eligible POP.', 400, 'INVALID_POP');
  const packageId = positiveId(input.packageId, 'package');
  const quantity = validateQuantity(input.quantity);
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const actorUserId = String(input.actorUserId || resellerId).slice(0, 160);

  return db.withTransaction(async client => {
    const findExisting = async () => client.query(
      `SELECT id, batch_key, pop_id, package_id, quantity
       FROM public.reseller_voucher_batches
       WHERE reseller_id=$1 AND idempotency_key=$2
       LIMIT 1
       FOR UPDATE`,
      [resellerId, idempotencyKey]
    );

    let existingResult = await findExisting();
    if (existingResult.rows?.length) {
      const existing = existingResult.rows[0];
      assertSameRequest(existing, { popId, packageId, quantity });
      const detail = await loadBatchDetail(client, resellerId, existing.batch_key);
      if (!detail || detail.vouchers.length !== quantity) {
        throw serviceError('The existing idempotent batch is incomplete; contact support before retrying.', 503, 'IDEMPOTENT_BATCH_INCOMPLETE');
      }
      return { ...detail, replayed: true };
    }

    const eligibleResult = await client.query(
      `SELECT p.id AS pop_id, p.name AS pop_name, p.reseller_id,
              b.id AS binding_id, b.router_key, b.hotspot_server,
              b.hotspot_interface, b.vlan_id, b.ip_pool,
              pkg.id AS package_id, pkg.package_name, pkg.profile_key,
              pkg.validity, pkg.time_limit, pkg.data_limit,
              pkg.retail_price, pkg.wholesale_price,
              a.id AS billing_account_id, a.billing_mode,
              a.wallet_balance, a.receivable_balance, a.credit_limit,
              a.currency, a.account_status
       FROM public.pops p
       INNER JOIN public.pop_hotspot_bindings b
         ON b.pop_id=p.id AND b.status='active'
       INNER JOIN public.pop_hotspot_packages pkg
         ON pkg.pop_id=p.id AND pkg.status='active'
       INNER JOIN public.reseller_billing_accounts a
         ON a.reseller_id=p.reseller_id
       WHERE p.id=$1
         AND p.reseller_id=$2
         AND pkg.id=$3
         AND p.status='active'
       LIMIT 1
       FOR UPDATE OF p,b,pkg,a`,
      [popId, resellerId, packageId]
    );
    const eligible = eligibleResult.rows?.[0];
    if (!eligible) throw serviceError('The selected POP or package is inactive or is not assigned to your reseller account.', 403, 'POP_PACKAGE_NOT_ELIGIBLE');
    if (!String(eligible.ip_pool || '').trim()) throw serviceError('The selected POP does not have a configured Hotspot IP Pool. Configure the Hotspot binding before issuing vouchers.', 409, 'HOTSPOT_IP_POOL_NOT_CONFIGURED');
    if (eligible.account_status !== 'active') throw serviceError('Your reseller billing account is not active. Contact FAZ NETWORK support.', 409, 'BILLING_ACCOUNT_INACTIVE');
    if (!['prepaid', 'postpaid'].includes(eligible.billing_mode)) throw serviceError('The reseller billing mode is not configured correctly.', 409, 'INVALID_BILLING_MODE');

    // Recheck after taking the billing-account row lock. This serializes same-reseller
    // requests and prevents concurrent retries from charging the same idempotency key.
    existingResult = await findExisting();
    if (existingResult.rows?.length) {
      const existing = existingResult.rows[0];
      assertSameRequest(existing, { popId, packageId, quantity });
      const detail = await loadBatchDetail(client, resellerId, existing.batch_key);
      if (!detail || detail.vouchers.length !== quantity) {
        throw serviceError('The existing idempotent batch is incomplete; contact support before retrying.', 503, 'IDEMPOTENT_BATCH_INCOMPLETE');
      }
      return { ...detail, replayed: true };
    }

    const retailUnitCents = toCents(eligible.retail_price, 'retail price');
    const wholesaleUnitCents = toCents(eligible.wholesale_price, 'wholesale cost');
    if (wholesaleUnitCents > retailUnitCents) {
      throw serviceError('Voucher issuance rejected because wholesale cost exceeds retail price.', 409, 'NEGATIVE_MARGIN');
    }
    // The v1.3 ledger schema requires amount > 0. Do not invent a 0.01 debit
    // or post an inaccurate journal entry for a zero-cost package.
    if (wholesaleUnitCents === 0n) {
      throw serviceError('This package has zero wholesale cost and cannot be issued until a zero-value ledger policy is approved.', 409, 'ZERO_WHOLESALE_COST');
    }

    const retailTotalCents = retailUnitCents * BigInt(quantity);
    const wholesaleTotalCents = wholesaleUnitCents * BigInt(quantity);
    const marginTotalCents = retailTotalCents - wholesaleTotalCents;
    const maxBatchTotalCents = 99999999999999n; // NUMERIC(14,2) maximum
    if (retailTotalCents > maxBatchTotalCents || wholesaleTotalCents > maxBatchTotalCents || marginTotalCents > maxBatchTotalCents) {
      throw serviceError('The selected quantity and package price exceed the supported batch financial range.', 422, 'BATCH_TOTAL_EXCEEDS_LIMIT');
    }
    const wholesaleTotal = fromCents(wholesaleTotalCents);
    if (eligible.billing_mode === 'prepaid' && toCents(eligible.wallet_balance, 'wallet balance') < wholesaleTotalCents) {
      throw serviceError('Insufficient prepaid wallet balance for this voucher batch.', 409, 'INSUFFICIENT_WALLET_BALANCE');
    }
    if (eligible.billing_mode === 'postpaid' && toCents(eligible.receivable_balance, 'receivable balance') + wholesaleTotalCents > toCents(eligible.credit_limit, 'credit limit')) {
      throw serviceError('This voucher batch exceeds your available postpaid credit limit.', 409, 'POSTPAID_CREDIT_LIMIT_EXCEEDED');
    }
    const batchKey = crypto.randomUUID();

    const batchResult = await client.query(
      `INSERT INTO public.reseller_voucher_batches (
         batch_key,idempotency_key,reseller_id,pop_id,billing_account_id,
         binding_id,package_id,router_key,hotspot_server,hotspot_interface,
         vlan_id,ip_pool,profile_key,validity,quantity,retail_unit_price,
         wholesale_unit_price,retail_total,wholesale_total,margin_total,
         billing_mode,status,actor_user_id
       ) VALUES (
         $1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
         $16::numeric,$17::numeric,$18::numeric,$19::numeric,$20::numeric,
         $21,'issued',$22
       )
       RETURNING id,batch_key`,
      [
        batchKey,idempotencyKey,resellerId,popId,eligible.billing_account_id,
        eligible.binding_id,packageId,eligible.router_key,eligible.hotspot_server,
        eligible.hotspot_interface,eligible.vlan_id,eligible.ip_pool,
        eligible.profile_key,eligible.validity,quantity,
        fromCents(retailUnitCents),fromCents(wholesaleUnitCents),
        fromCents(retailTotalCents),wholesaleTotal,fromCents(marginTotalCents),
        eligible.billing_mode,actorUserId
      ]
    );
    const batch = batchResult.rows?.[0];
    if (!batch) throw serviceError('The voucher batch snapshot could not be persisted.', 503, 'BATCH_SNAPSHOT_FAILED');

    const generated = await hotspotVoucherGenerator.generateVoucherBatch({
      client,
      profileName: eligible.profile_key,
      profileId: eligible.profile_key,
      validity: eligible.validity,
      timeLimit: eligible.time_limit || '',
      dataLimit: eligible.data_limit || '',
      price: Number(eligible.retail_price),
      server: eligible.hotspot_server,
      quantity,
      charLength: 8,
      passwordEqualsUsername: false,
      batchId: batchKey,
      transactionId: null,
      subscriberType: 'reseller_voucher',
      comment: 'FAZ NETWORK reseller voucher batch ' + batchKey + '; POP ' + eligible.pop_name + '.'
    });
    const vouchers = generated.vouchers || [];
    if (vouchers.length !== quantity || vouchers.some(voucher => !voucher.id || !voucher.username || !voucher.password)) {
      throw serviceError('Canonical voucher generation returned an incomplete batch.', 503, 'VOUCHER_GENERATION_INCOMPLETE');
    }

    let mappedCount = 0;
    for (const voucher of vouchers) {
      const itemResult = await client.query(
        `INSERT INTO public.reseller_voucher_issuance_items (batch_id,voucher_id)
         VALUES ($1,$2)
         RETURNING id`,
        [batch.id, voucher.id]
      );
      if (itemResult.rowCount !== 1) throw serviceError('A generated voucher could not be linked to its reseller batch.', 503, 'VOUCHER_ITEM_MAPPING_FAILED');
      mappedCount += 1;
    }
    if (mappedCount !== quantity) throw serviceError('The voucher batch item count does not match the requested quantity.', 503, 'VOUCHER_ITEM_COUNT_MISMATCH');

    let accountUpdate;
    if (eligible.billing_mode === 'prepaid') {
      accountUpdate = await client.query(
        `UPDATE public.reseller_billing_accounts
         SET wallet_balance=wallet_balance-$1::numeric, updated_at=NOW()
         WHERE id=$2 AND reseller_id=$3 AND account_status='active'
           AND wallet_balance >= $1::numeric
         RETURNING wallet_balance,receivable_balance,credit_limit`,
        [wholesaleTotal,eligible.billing_account_id,resellerId]
      );
      if (accountUpdate.rowCount !== 1) throw serviceError('Insufficient prepaid wallet balance for this voucher batch.', 409, 'INSUFFICIENT_WALLET_BALANCE');
    } else {
      accountUpdate = await client.query(
        `UPDATE public.reseller_billing_accounts
         SET receivable_balance=receivable_balance+$1::numeric, updated_at=NOW()
         WHERE id=$2 AND reseller_id=$3 AND account_status='active'
           AND receivable_balance+$1::numeric <= credit_limit
         RETURNING wallet_balance,receivable_balance,credit_limit`,
        [wholesaleTotal,eligible.billing_account_id,resellerId]
      );
      if (accountUpdate.rowCount !== 1) throw serviceError('This voucher batch exceeds your available postpaid credit limit.', 409, 'POSTPAID_CREDIT_LIMIT_EXCEEDED');
    }

    const entryType = eligible.billing_mode === 'prepaid' ? 'wallet_debit' : 'receivable_charge';
    const accountType = eligible.billing_mode === 'prepaid' ? 'wallet' : 'receivable';
    const ledgerResult = await client.query(
      `INSERT INTO public.reseller_ledger_entries (
         reseller_id,billing_account_id,account_type,entry_type,amount,currency,
         batch_id,settlement_id,idempotency_key,description,actor_user_id
       ) VALUES ($1,$2,$3,$4,$5::numeric,$6,$7,NULL,$8,$9,$10)
       RETURNING id`,
      [
        resellerId,eligible.billing_account_id,accountType,entryType,wholesaleTotal,
        eligible.currency,batch.id,'reseller-voucher-batch:' + batchKey,
        'Hotspot voucher batch ' + batchKey + ' (' + quantity + ' vouchers)',
        actorUserId
      ]
    );
    if (ledgerResult.rowCount !== 1) throw serviceError('The reseller financial journal entry could not be posted.', 503, 'LEDGER_POST_FAILED');

    const detail = await loadBatchDetail(client, resellerId, batchKey);
    if (!detail || detail.vouchers.length !== quantity) throw serviceError('The persisted voucher batch could not be read back completely.', 503, 'BATCH_READBACK_FAILED');

    return {
      ...detail,
      replayed: false,
      account: {
        billingMode: eligible.billing_mode,
        walletBalance: String(accountUpdate.rows[0].wallet_balance),
        receivableBalance: String(accountUpdate.rows[0].receivable_balance),
        creditLimit: String(accountUpdate.rows[0].credit_limit),
        currency: eligible.currency
      }
    };
  });
}

async function listBatches(resellerIdValue, limitValue = 50) {
  const resellerId = resellerKey(resellerIdValue);
  const limit = Math.max(1, Math.min(100, Number.isSafeInteger(Number(limitValue)) ? Number(limitValue) : 50));
  const result = await db.query(
    `SELECT b.id,b.batch_key AS batch_key,b.pop_id,b.package_id,b.profile_key,
            COALESCE(
              NULLIF(to_jsonb(b)->>'validity',''),
              NULLIF(to_jsonb(pkg)->>'validity',''),
              NULLIF(to_jsonb(pkg)->>'duration',''),
              NULLIF(to_jsonb(pkg)->>'validity_days',''),
              NULLIF(to_jsonb(pkg)->>'validity_period',''),
              'N/A'
            ) AS validity,
            b.quantity,
            COALESCE(
              NULLIF(to_jsonb(b)->>'retail_total','')::numeric,
              NULLIF(to_jsonb(b)->>'total_cost','')::numeric,
              NULLIF(to_jsonb(b)->>'retail_unit_price','')::numeric * b.quantity,
              0::numeric
            ) AS retail_total,
            COALESCE(
              NULLIF(to_jsonb(b)->>'wholesale_total','')::numeric,
              NULLIF(to_jsonb(b)->>'wholesale_unit_price','')::numeric * b.quantity,
              0::numeric
            ) AS wholesale_total,
            COALESCE(
              NULLIF(to_jsonb(b)->>'margin_total','')::numeric,
              (
                COALESCE(NULLIF(to_jsonb(b)->>'retail_total','')::numeric,
                         NULLIF(to_jsonb(b)->>'total_cost','')::numeric,
                         NULLIF(to_jsonb(b)->>'retail_unit_price','')::numeric * b.quantity,
                         0::numeric)
                -
                COALESCE(NULLIF(to_jsonb(b)->>'wholesale_total','')::numeric,
                         NULLIF(to_jsonb(b)->>'wholesale_unit_price','')::numeric * b.quantity,
                         0::numeric)
              ),
              0::numeric
            ) AS margin_total,
            b.billing_mode,b.status,b.created_at,
            COALESCE(items.issued_count,0)::int AS issued_count
     FROM public.reseller_voucher_batches b
     LEFT JOIN public.pop_hotspot_packages pkg ON pkg.id=b.package_id
     LEFT JOIN (
       SELECT batch_id,COUNT(*)::int AS issued_count
       FROM public.reseller_voucher_issuance_items
       GROUP BY batch_id
     ) items ON items.batch_id=b.id
     WHERE b.reseller_id=$1
     ORDER BY b.created_at DESC,b.id DESC
     LIMIT $2`,
    [resellerId,limit]
  );
  return (result.rows || []).map(row => ({
    id: String(row.id),
    batchKey: row.batch_key,
    popId: Number(row.pop_id),
    packageId: String(row.package_id),
    profileKey: row.profile_key,
    validity: row.validity,
    quantity: Number(row.quantity),
    issuedCount: Number(row.issued_count),
    retailTotal: String(row.retail_total),
    wholesaleTotal: String(row.wholesale_total),
    marginTotal: String(row.margin_total),
    billingMode: row.billing_mode,
    status: row.status,
    createdAt: row.created_at
  }));
}

async function getBatch(resellerIdValue, batchKeyValue) {
  const resellerId = resellerKey(resellerIdValue);
  const batchKey = validateBatchKey(batchKeyValue);
  const result = await db.withTransaction(async client => loadBatchDetail(client, resellerId, batchKey));
  if (result && result.vouchers.length !== result.batch.quantity) {
    throw serviceError('This voucher batch is incomplete and cannot be reprinted. Contact FAZ NETWORK support.', 503, 'BATCH_ITEM_COUNT_MISMATCH');
  }
  return result;
}

module.exports = { issueBatch, listBatches, getBatch, validateQuantity, validateIdempotencyKey, validateBatchKey };
