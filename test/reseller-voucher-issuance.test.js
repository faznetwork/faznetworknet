'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');
const generator = require('../services/hotspotVoucherGenerator');
const issuance = require('../services/resellerVoucherIssuanceService');

const BATCH_KEY = 'a8d0eaf8-4a9e-4c21-9b3f-8a9e4a7d0f11';

function eligibleRow(overrides = {}) {
  return {
    pop_id: 21,
    pop_name: 'North POP',
    reseller_id: 41,
    binding_id: '501',
    router_key: 'core_mikrotik',
    hotspot_server: 'hotspot1',
    hotspot_interface: 'bridge-hotspot',
    vlan_id: 120,
    ip_pool: 'hs-pool',
    package_id: '701',
    package_name: '2 Hour',
    profile_key: '2-Hour',
    validity: '2h',
    time_limit: '2h',
    data_limit: '1G',
    retail_price: '50.00',
    wholesale_price: '30.00',
    billing_account_id: '801',
    billing_mode: 'prepaid',
    wallet_balance: '500.00',
    receivable_balance: '0.00',
    credit_limit: '0.00',
    currency: 'BDT',
    account_status: 'active',
    ...overrides
  };
}

function installIssueMocks(t, options = {}) {
  const statements = [];
  const generated = [];
  const vouchers = options.vouchers || [{ id: '99001', username: 'VCHR0001', password: 'PASS0001' }];
  const client = {
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.includes('FROM public.reseller_voucher_batches') && sql.includes('idempotency_key')) {
        return { rows: options.existing ? [options.existing] : [] };
      }
      if (sql.includes('FROM public.pops p')) {
        return { rows: options.eligible === false ? [] : [eligibleRow(options.eligible || {})] };
      }
      if (sql.startsWith('INSERT INTO public.reseller_voucher_batches')) {
        return { rowCount: 1, rows: [{ id: '9001', batch_key: values[0] }] };
      }
      if (sql.startsWith('INSERT INTO public.reseller_voucher_issuance_items')) {
        return { rowCount: 1, rows: [{ id: '1' }] };
      }
      if (sql.startsWith('UPDATE public.reseller_billing_accounts')) {
        return {
          rowCount: 1,
          rows: [{ wallet_balance: '470.00', receivable_balance: '0.00', credit_limit: '0.00' }]
        };
      }
      if (sql.startsWith('INSERT INTO public.reseller_ledger_entries')) {
        return { rowCount: 1, rows: [{ id: '1' }] };
      }
      if (sql.includes('FROM public.reseller_voucher_batches') && sql.includes('batch_key=$1::uuid')) {
        return {
          rows: [{
            id: '9001', batch_key: values[0], reseller_id: 41, pop_id: 21,
            billing_account_id: '801', package_id: '701', profile_key: '2-Hour',
            validity: '2h', quantity: 1, retail_unit_price: '50.00',
            wholesale_unit_price: '30.00', retail_total: '50.00',
            wholesale_total: '30.00', margin_total: '20.00',
            billing_mode: 'prepaid', status: 'issued', created_at: new Date('2026-10-30T10:00:00Z')
          }]
        };
      }
      if (sql.includes('FROM public.reseller_voucher_issuance_items i')) {
        return { rows: vouchers.map(v => ({ ...v, profile: '2-Hour', validity: '2h', status: 'unused' })) };
      }
      throw new Error('Unexpected SQL in reseller voucher issuance test: ' + sql);
    }
  };

  t.mock.method(db, 'withTransaction', async callback => callback(client));
  t.mock.method(generator, 'generateVoucherBatch', async args => {
    generated.push(args);
    return { batchId: args.batchId, vouchers };
  });
  return { statements, generated, client };
}

const validInput = {
  resellerId: 41,
  popId: 21,
  packageId: '701',
  quantity: 1,
  idempotencyKey: 'test-request-0001',
  actorUserId: '41'
};

test('issuance uses one transaction client for the canonical generator, item mapping and ledger', async t => {
  const mock = installIssueMocks(t);
  const result = await issuance.issueBatch(validInput);

  assert.equal(result.replayed, false);
  assert.match(result.batch.batchKey, /^[0-9a-f-]{36}$/i);
  assert.equal(result.vouchers.length, 1);
  assert.equal(mock.generated.length, 1);
  assert.equal(mock.generated[0].client, mock.client);
  assert.equal(mock.generated[0].subscriberType, 'reseller_voucher');
  assert.equal(mock.generated[0].profileName, '2-Hour');
  assert.equal(mock.generated[0].price, 50);
  assert.ok(mock.statements.some(entry => /p\.reseller_id=\$2/.test(entry.sql) && /FOR UPDATE OF p,b,pkg,a/.test(entry.sql)));
  assert.ok(mock.statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_voucher_batches')));
  assert.ok(mock.statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_voucher_issuance_items')));
  assert.ok(mock.statements.some(entry => entry.sql.startsWith('UPDATE public.reseller_billing_accounts')));
  assert.ok(mock.statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_ledger_entries')));
});

test('cross-reseller POP/package selection is rejected before voucher generation', async t => {
  const mock = installIssueMocks(t, { eligible: false });
  await assert.rejects(
    issuance.issueBatch(validInput),
    error => error.code === 'POP_PACKAGE_NOT_ELIGIBLE' && error.statusCode === 403
  );
  assert.equal(mock.generated.length, 0);
  assert.equal(mock.statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_voucher_batches')), false);
});

test('negative margin is rejected before batch persistence', async t => {
  const mock = installIssueMocks(t, { eligible: { retail_price: '20.00', wholesale_price: '25.00' } });
  await assert.rejects(
    issuance.issueBatch(validInput),
    error => error.code === 'NEGATIVE_MARGIN' && error.statusCode === 409
  );
  assert.equal(mock.generated.length, 0);
  assert.equal(mock.statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_voucher_batches')), false);
});

test('prepaid insufficient balance is rejected before batch persistence or PIN generation', async t => {
  const mock = installIssueMocks(t, { eligible: { wallet_balance: '10.00' } });
  await assert.rejects(
    issuance.issueBatch(validInput),
    error => error.code === 'INSUFFICIENT_WALLET_BALANCE' && error.statusCode === 409
  );
  assert.equal(mock.generated.length, 0);
  assert.equal(mock.statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_voucher_batches')), false);
});

test('postpaid receivable cannot exceed the configured credit limit', async t => {
  const mock = installIssueMocks(t, {
    eligible: { billing_mode: 'postpaid', receivable_balance: '80.00', credit_limit: '100.00' }
  });
  await assert.rejects(
    issuance.issueBatch(validInput),
    error => error.code === 'POSTPAID_CREDIT_LIMIT_EXCEEDED' && error.statusCode === 409
  );
  assert.equal(mock.generated.length, 0);
  assert.equal(mock.statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_voucher_batches')), false);
});

test('idempotent replay returns the original scoped batch without another debit or generation', async t => {
  const existing = { id: '9001', batch_key: BATCH_KEY, pop_id: 21, package_id: '701', quantity: 1 };
  const mock = installIssueMocks(t, { existing });
  const result = await issuance.issueBatch(validInput);
  assert.equal(result.replayed, true);
  assert.equal(result.batch.batchKey, BATCH_KEY);
  assert.equal(mock.generated.length, 0);
  assert.equal(mock.statements.some(entry => entry.sql.startsWith('UPDATE public.reseller_billing_accounts')), false);
  assert.equal(mock.statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_ledger_entries')), false);
});

test('reusing an idempotency key for different request details is rejected', async t => {
  const existing = { id: '9001', batch_key: BATCH_KEY, pop_id: 99, package_id: '701', quantity: 1 };
  const mock = installIssueMocks(t, { existing });
  await assert.rejects(
    issuance.issueBatch(validInput),
    error => error.code === 'IDEMPOTENCY_KEY_CONFLICT' && error.statusCode === 409
  );
  assert.equal(mock.generated.length, 0);
});

test('quantity and idempotency validation are bounded', () => {
  assert.throws(() => issuance.validateQuantity(0), error => error.code === 'INVALID_QUANTITY');
  assert.throws(() => issuance.validateQuantity(501), error => error.code === 'INVALID_QUANTITY');
  assert.throws(() => issuance.validateQuantity(1.5), error => error.code === 'INVALID_QUANTITY');
  assert.throws(() => issuance.validateIdempotencyKey('short'), error => error.code === 'INVALID_IDEMPOTENCY_KEY');
});

test('zero wholesale cost is rejected rather than fabricating a positive ledger debit', async t => {
  const mock = installIssueMocks(t, { eligible: { wholesale_price: '0.00' } });
  await assert.rejects(
    issuance.issueBatch(validInput),
    error => error.code === 'ZERO_WHOLESALE_COST' && error.statusCode === 409
  );
  assert.equal(mock.generated.length, 0);
});

test('reseller voucher schema tracking migration is additive and declares all seven tables idempotently', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '20261030_reseller_voucher_billing_v1_3.sql'), 'utf8');
  const tables = [
    'pop_hotspot_bindings',
    'pop_hotspot_packages',
    'reseller_billing_accounts',
    'reseller_voucher_batches',
    'reseller_voucher_issuance_items',
    'reseller_settlements',
    'reseller_ledger_entries'
  ];
  for (const table of tables) assert.match(migration, new RegExp('CREATE TABLE IF NOT EXISTS public\\.' + table));
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)\b/i);
  assert.match(migration, /wholesale_unit_price <= retail_unit_price/);
  assert.match(migration, /trg_reseller_ledger_append_only/);
});

test('reseller portal exposes only voucher issuance as a write and keeps batch history read-only', () => {
  const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'resellerPortalRoutes.js'), 'utf8');
  assert.match(routes, /router\.get\('\/hotspot\/catalog'/);
  assert.match(routes, /router\.post\('\/hotspot\/voucher-batches'/);
  assert.match(routes, /router\.get\('\/hotspot\/voucher-batches'/);
  assert.match(routes, /router\.get\('\/hotspot\/voucher-batches\/:batchKey'/);
  assert.doesNotMatch(routes, /router\.(delete|put)\([^\n]*voucher-batches/i);
  assert.doesNotMatch(routes, /router\.post\([^\n]*(cancel|void|delete|disable)/i);
});

test('reseller history SQL is always scoped by the authenticated reseller id', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'resellerVoucherIssuanceService.js'), 'utf8');
  assert.match(source, /WHERE b\.reseller_id=\$1/);
  assert.match(source, /WHERE batch_key=\$1::uuid AND reseller_id=\$2/);
});

test('reseller dashboard contains bounded generation and read-only reprint controls', () => {
  const dashboard = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-vouchers.ejs'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'reseller-vouchers.js'), 'utf8');
  assert.match(dashboard, /id="voucherQuantity"[^>]*min="1"[^>]*max="500"/);
  assert.match(script, /retailPrice/);
  assert.match(dashboard, /wholesale_price|wholesalePrice/);
  assert.match(dashboard, /voucherHistoryRows/);
  assert.match(dashboard, /\/reseller\/hotspot\/voucher-batches\//);
  assert.match(script, /Idempotency-Key/);
});


test('catalog returns only the authenticated reseller POP/package rows and exact margin', async t => {
  const catalogService = require('../services/resellerHotspotCatalogService');
  const calls = [];
  t.mock.method(db, 'query', async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('FROM public.reseller_billing_accounts')) {
      return { rows: [{ id: '801', billing_mode: 'prepaid', wallet_balance: '100.00', receivable_balance: '0.00', credit_limit: '0.00', currency: 'BDT', account_status: 'active' }] };
    }
    if (sql.includes('FROM public.pops p')) {
      return { rows: [{
        pop_id: 21, pop_name: 'North POP', area_zone: 'North',
        binding_id: '501', router_key: 'core_mikrotik', hotspot_server: 'hotspot1',
        hotspot_interface: 'bridge-hotspot', vlan_id: 120, ip_pool: 'hs-pool',
        package_id: '701', package_name: '2 Hour', profile_key: '2-Hour',
        validity: '2h', time_limit: '2h', data_limit: '1G',
        retail_price: '50.10', wholesale_price: '30.05'
      }] };
    }
    throw new Error('Unexpected catalog SQL: ' + sql);
  });
  const result = await catalogService.getCatalog(41);
  assert.equal(result.pops.length, 1);
  assert.equal(result.pops[0].id, 21);
  assert.equal(result.pops[0].packages[0].expectedMargin, '20.05');
  assert.equal(result.account.walletBalance, '100.00');
  assert.deepEqual(calls.map(call => call.values), [[41], [41]]);
  assert.match(calls[1].sql, /p\.status='active'/);
  assert.match(calls[1].sql, /b\.status='active'/);
  assert.match(calls[1].sql, /pkg\.status='active'/);
});

test('catalog rejects missing or invalid authenticated reseller identity', async () => {
  const catalogService = require('../services/resellerHotspotCatalogService');
  await assert.rejects(catalogService.getCatalog(0), error => error.code === 'RESELLER_ID_REQUIRED');
});

test('canonical voucher generator defaults to legacy scratch type and accepts reseller metadata', async () => {
  const calls = [];
  const client = { query: async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [{ id: '1', username: values[0], password: values[1], profile_id: values[10], time_limit: values[11], data_limit: values[12] }] };
  }};
  const legacy = await generator.generateVoucherBatch({ client, profileName: 'Legacy', validity: '1h', price: 10, quantity: 1 });
  const reseller = await generator.generateVoucherBatch({
    client, profileName: 'Reseller', validity: '2h', price: 50, quantity: 1,
    subscriberType: 'reseller_voucher', profileId: '2-Hour', timeLimit: '2h', dataLimit: '1G'
  });
  assert.equal(legacy.vouchers.length, 1);
  assert.equal(calls[0].values[9], 'scratch_voucher');
  assert.equal(reseller.vouchers.length, 1);
  assert.equal(calls[1].values[9], 'reseller_voucher');
  assert.equal(calls[1].values[10], '2-Hour');
  assert.match(calls[1].sql, /profile_id,time_limit,data_limit/);
});

test('print page is authenticated and batch-scoped; no batch mutation routes exist', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'resellerPortalRoutes.js'), 'utf8');
  const printView = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-voucher-print.ejs'), 'utf8');
  assert.match(server, /\/reseller\/hotspot\/voucher-batches\/:batchKey\/print",requireRole\(\["reseller"\]\),loadTenantScope,resellerHotspotController\.printBatchPage/);
  assert.match(printView, /window\.print\(\)/);
  assert.doesNotMatch(routes, /router\.(delete|put)\([^\n]*voucher-batches/i);
  assert.doesNotMatch(routes, /router\.post\([^\n]*(cancel|void|delete|disable)/i);
});


test('reseller workspace and printable voucher EJS templates compile; dashboard script parses', () => {
  const ejs = require('ejs');
  const vm = require('node:vm');
  const dashboard = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-dashboard.ejs'), 'utf8');
  const vouchers = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-vouchers.ejs'), 'utf8');
  const customers = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-customers.ejs'), 'utf8');
  const payments = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-payments.ejs'), 'utf8');
  const partials = ['reseller-sidebar.ejs','reseller-topbar.ejs','reseller-scripts.ejs'].map(name => fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', name), 'utf8'));
  const printView = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-voucher-print.ejs'), 'utf8');
  [dashboard,vouchers,customers,payments,...partials,printView].forEach(source => ejs.compile(source));
  for (const name of ['reseller-workspace.js','reseller-dashboard.js','reseller-vouchers.js','reseller-customers.js','reseller-payments.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', name), 'utf8');
    new vm.Script(source);
  }
});


test('postpaid issuance is accepted at the exact credit limit and journals a receivable charge', async t => {
  const mock = installIssueMocks(t, {
    eligible: { billing_mode: 'postpaid', receivable_balance: '70.00', credit_limit: '100.00' }
  });
  const result = await issuance.issueBatch(validInput);
  assert.equal(result.replayed, false);
  const ledger = mock.statements.find(entry => entry.sql.startsWith('INSERT INTO public.reseller_ledger_entries'));
  assert.ok(ledger);
  assert.equal(ledger.values[2], 'receivable');
  assert.equal(ledger.values[3], 'receivable_charge');
  const accountUpdate = mock.statements.find(entry => entry.sql.startsWith('UPDATE public.reseller_billing_accounts'));
  assert.match(accountUpdate.sql, /receivable_balance=receivable_balance\+\$1::numeric/);
});

test('voucher generation failure aborts the enclosing transaction before account or ledger writes', async t => {
  const statements = [];
  let rollbackObserved = false;
  const client = {
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.startsWith('SELECT id, batch_key')) return { rows: [] };
      if (sql.includes('FROM public.pops p')) return { rows: [eligibleRow()] };
      if (sql.startsWith('INSERT INTO public.reseller_voucher_batches')) return { rowCount: 1, rows: [{ id: '9001', batch_key: values[0] }] };
      throw new Error('Unexpected SQL in rollback test: ' + sql);
    }
  };
  t.mock.method(db, 'withTransaction', async callback => {
    try {
      return await callback(client);
    } catch (error) {
      rollbackObserved = true;
      throw error;
    }
  });
  t.mock.method(generator, 'generateVoucherBatch', async () => {
    throw new Error('simulated canonical generator failure');
  });
  await assert.rejects(issuance.issueBatch(validInput), /simulated canonical generator failure/);
  assert.equal(rollbackObserved, true);
  assert.equal(statements.some(entry => entry.sql.startsWith('UPDATE public.reseller_billing_accounts')), false);
  assert.equal(statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_ledger_entries')), false);
});
