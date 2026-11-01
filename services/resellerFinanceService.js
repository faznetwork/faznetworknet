'use strict';

const db = require('../db');

function financeError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}
function positiveId(value, label) {
  const text = String(value ?? '').trim();
  if (!/^[1-9]\d{0,18}$/.test(text) || BigInt(text) > 9223372036854775807n) {
    throw financeError('A valid ' + label + ' is required.', 400, 'INVALID_' + label.toUpperCase());
  }
  return text;
}
function amountCents(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(0|[1-9]\d{0,11})(?:\.(\d{1,2}))?$/);
  if (!match) throw financeError('Amount must be a positive monetary value with at most two decimal places.', 400, 'INVALID_AMOUNT');
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || '0');
  if (cents <= 0n) throw financeError('Amount must be greater than zero.', 400, 'INVALID_AMOUNT');
  return cents;
}
function nonNegativeCents(value, label) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(0|[1-9]\d{0,11})(?:\.(\d{1,2}))?$/);
  if (!match) throw financeError((label || 'Amount') + ' must be a non-negative monetary value.', 400, 'INVALID_AMOUNT');
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || '0');
}
function decimal(cents) {
  return (cents / 100n).toString() + '.' + (cents % 100n).toString().padStart(2, '0');
}
function idempotencyKey(value) {
  const key = String(value ?? '').trim();
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key)) {
    throw financeError('A valid Idempotency-Key header (8–120 safe characters) is required.', 400, 'INVALID_IDEMPOTENCY_KEY');
  }
  return key;
}
function actorId(value, required = false) {
  if (value === null || value === undefined || String(value).trim() === '') {
    if (required) throw financeError('An authenticated admin actor is required to post a finance settlement.', 401, 'AUTHENTICATED_ACTOR_REQUIRED');
    return null;
  }
  return positiveId(value, 'authenticated admin actor');
}
function normalizeProvider(value) {
  const provider = String(value ?? 'manual').trim();
  if (!provider || provider.length > 60) throw financeError('Payment provider must be 1–60 characters.', 400, 'INVALID_PAYMENT_PROVIDER');
  return provider;
}
function normalizeOptional(value, label, max) {
  const text = String(value ?? '').trim();
  if (text.length > max) throw financeError(label + ' is too long.', 400, 'INVALID_' + label.toUpperCase().replace(/ /g, '_'));
  return text || null;
}
function assertReplay(existing, input) {
  const same = String(existing.account_id) === String(input.accountId) &&
    Number(existing.reseller_id) === Number(input.resellerId) &&
    String(existing.entry_type) === input.entryType &&
    String(existing.account_type) === input.accountType &&
    amountCents(existing.amount) === input.amountCents;
  if (!same) throw financeError('This global Idempotency-Key was already used for a different finance operation.', 409, 'IDEMPOTENCY_KEY_CONFLICT');
}
async function lockedAccount(client, resellerId) {
  const result = await client.query(
    'SELECT id,reseller_id,billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status ' +
    'FROM public.reseller_billing_accounts WHERE reseller_id=$1 LIMIT 1 FOR UPDATE',
    [resellerId]
  );
  const account = result.rows?.[0];
  if (!account) throw financeError('Reseller billing account was not found.', 404, 'BILLING_ACCOUNT_NOT_FOUND');
  if (account.account_status !== 'active') throw financeError('Reseller billing account is not active.', 409, 'BILLING_ACCOUNT_INACTIVE');
  if (!['prepaid', 'postpaid'].includes(account.billing_mode)) throw financeError('Reseller billing mode is invalid.', 409, 'INVALID_BILLING_MODE');
  return account;
}
async function post(input, mode) {
  const resellerId = Number(positiveId(input.resellerId, 'reseller'));
  const actor = actorId(input.actorUserId, true);
  const amount = amountCents(input.amount);
  const key = idempotencyKey(input.idempotencyKey);
  const entryType = mode === 'prepaid' ? 'wallet_topup' : 'receivable_settlement';
  const settlementType = mode === 'prepaid' ? 'wallet_topup' : 'receivable_payment';
  const accountType = mode === 'prepaid' ? 'wallet' : 'receivable';
  const provider = normalizeProvider(input.paymentProvider);
  const reference = normalizeOptional(input.externalReference, 'external reference', 120);
  const notes = normalizeOptional(input.notes, 'notes', 2000);
  return db.withTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
    const prior = await client.query(
      'SELECT id,COALESCE(account_id,billing_account_id) AS account_id,reseller_id,account_type,entry_type,amount,settlement_id,idempotency_key ' +
      'FROM public.reseller_ledger_entries WHERE idempotency_key=$1 LIMIT 1',
      [key]
    );
    if (prior.rows?.length) {
      const existing = prior.rows[0];
      const currentAccount = await client.query(
        'SELECT id,reseller_id,billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status ' +
        'FROM public.reseller_billing_accounts WHERE reseller_id=$1 LIMIT 1',
        [resellerId]
      );
      if (!currentAccount.rows?.[0]) throw financeError('Reseller billing account was not found.', 404, 'BILLING_ACCOUNT_NOT_FOUND');
      assertReplay(existing, { accountId: currentAccount.rows[0].id, resellerId, entryType, accountType, amountCents: amount });
      const accountResult = currentAccount;
      return { replayed: true, ledgerEntryId: String(existing.id), settlementId: existing.settlement_id ? String(existing.settlement_id) : null, account: accountResult.rows?.[0] || null };
    }

    const account = await lockedAccount(client, resellerId);
    if (account.billing_mode !== mode) {
      throw financeError(mode === 'prepaid'
        ? 'Wallet top-up is available only for prepaid reseller accounts.'
        : 'Receivable settlement is available only for postpaid reseller accounts.',
      409, 'BILLING_MODE_OPERATION_MISMATCH');
    }
    const amountText = decimal(amount);
    if (mode === 'postpaid' && amount > nonNegativeCents(account.receivable_balance, 'Receivable balance')) {
      throw financeError('Settlement amount exceeds the outstanding receivable balance.', 409, 'SETTLEMENT_EXCEEDS_RECEIVABLE');
    }

    const settlementResult = await client.query(
      'INSERT INTO public.reseller_settlements ' +
      '(account_id,reseller_id,settlement_type,amount,payment_provider,external_reference,received_by,received_at,notes) ' +
      'VALUES ($1,$2,$3,$4::numeric,$5,$6,$7,NOW(),$8) RETURNING id',
      [account.id, resellerId, settlementType, amountText, provider, reference, actor, notes]
    );
    const settlement = settlementResult.rows?.[0];
    if (!settlement) throw financeError('Finance settlement record was not persisted.', 503, 'SETTLEMENT_PERSIST_FAILED');

    const updateSql = mode === 'prepaid'
      ? 'UPDATE public.reseller_billing_accounts SET wallet_balance=wallet_balance+$1::numeric,updated_at=NOW() ' +
        "WHERE id=$2 AND reseller_id=$3 AND billing_mode='prepaid' AND account_status='active' " +
        'RETURNING id,reseller_id,billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status'
      : 'UPDATE public.reseller_billing_accounts SET receivable_balance=receivable_balance-$1::numeric,updated_at=NOW() ' +
        "WHERE id=$2 AND reseller_id=$3 AND billing_mode='postpaid' AND account_status='active' " +
        'AND receivable_balance >= $1::numeric ' +
        'RETURNING id,reseller_id,billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status';
    const updated = await client.query(updateSql, [amountText, account.id, resellerId]);
    if (updated.rowCount !== 1) {
      throw financeError(mode === 'prepaid' ? 'Wallet top-up could not be applied to the active prepaid account.' : 'Receivable settlement could not be applied to the outstanding postpaid balance.', 409, mode === 'prepaid' ? 'WALLET_TOPUP_REJECTED' : 'SETTLEMENT_EXCEEDS_RECEIVABLE');
    }

    const description = mode === 'prepaid'
      ? 'Admin wallet top-up' + (reference ? ' · ' + reference : '')
      : 'Admin receivable settlement' + (reference ? ' · ' + reference : '');
    const ledgerResult = await client.query(
      'INSERT INTO public.reseller_ledger_entries ' +
      '(account_id,billing_account_id,reseller_id,account_type,entry_type,amount,currency,batch_id,settlement_id,idempotency_key,description,actor_user_id) ' +
      'VALUES ($1,$1,$2,$3,$4,$5::numeric,$6,NULL,$7,$8,$9,$10) RETURNING id',
      [account.id, resellerId, accountType, entryType, amountText, account.currency, settlement.id, key, description, actor]
    );
    if (ledgerResult.rowCount !== 1) throw financeError('Append-only finance ledger posting failed.', 503, 'LEDGER_POST_FAILED');
    return { replayed: false, ledgerEntryId: String(ledgerResult.rows[0].id), settlementId: String(settlement.id), account: updated.rows[0] };
  });
}
async function walletTopup(input) { return post(input, 'prepaid'); }
async function receivableSettlement(input) { return post(input, 'postpaid'); }
async function updateCreditLimit(input) {
  const resellerId = Number(positiveId(input.resellerId, 'reseller'));
  const actor = actorId(input.actorUserId);
  const limit = nonNegativeCents(input.creditLimit, 'Credit limit');
  return db.withTransaction(async client => {
    const account = await lockedAccount(client, resellerId);
    if (account.billing_mode !== 'postpaid') throw financeError('Credit limits apply only to postpaid reseller accounts.', 409, 'BILLING_MODE_OPERATION_MISMATCH');
    if (limit < nonNegativeCents(account.receivable_balance, 'Receivable balance')) {
      throw financeError('Credit limit cannot be reduced below the current outstanding receivable balance.', 409, 'CREDIT_LIMIT_BELOW_RECEIVABLE');
    }
    const result = await client.query(
      'UPDATE public.reseller_billing_accounts SET credit_limit=$1::numeric,updated_at=NOW() ' +
      "WHERE id=$2 AND reseller_id=$3 AND billing_mode='postpaid' AND receivable_balance <= $1::numeric " +
      'RETURNING id,reseller_id,billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status',
      [decimal(limit), account.id, resellerId]
    );
    if (result.rowCount !== 1) throw financeError('Credit limit update failed its outstanding-receivable invariant.', 409, 'CREDIT_LIMIT_BELOW_RECEIVABLE');
    return { account: result.rows[0], updatedBy: actor };
  });
}
async function inspect(resellerIdValue) {
  const resellerId = Number(positiveId(resellerIdValue, 'reseller'));
  const accountResult = await db.query(
    'SELECT id,reseller_id,billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status,created_at,updated_at ' +
    'FROM public.reseller_billing_accounts WHERE reseller_id=$1 LIMIT 1',
    [resellerId]
  );
  const account = accountResult.rows?.[0];
  if (!account) return null;
  const [ledger, settlements] = await Promise.all([
    db.query(
      'SELECT id,billing_account_id,account_type,entry_type,amount,currency,batch_id,settlement_id,idempotency_key,description,actor_user_id,created_at ' +
      'FROM public.reseller_ledger_entries WHERE billing_account_id=$1 ORDER BY id DESC LIMIT 100',
      [account.id]
    ),
    db.query(
      'SELECT s.id,s.account_id AS billing_account_id,NULL::text AS idempotency_key,s.amount,a.currency,' +
      's.payment_provider AS payment_method,s.external_reference,s.settlement_type,NULL::varchar AS status,' +
      's.received_by AS actor_user_id,s.received_at,s.notes ' +
      'FROM public.reseller_settlements s ' +
      'INNER JOIN public.reseller_billing_accounts a ON a.id=s.account_id AND a.reseller_id=s.reseller_id ' +
      'WHERE s.account_id=$1 ORDER BY s.id DESC LIMIT 100',
      [account.id]
    )
  ]);
  return { account, ledgerEntries: ledger.rows || [], settlements: settlements.rows || [] };
}
module.exports = { walletTopup, receivableSettlement, updateCreditLimit, inspect, amountCents, idempotencyKey };
