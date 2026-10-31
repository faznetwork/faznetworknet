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
    validity_seconds: 7200,
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
  const eligibilitySql = mock.statements.find(entry => entry.sql.includes('FROM public.pops p'))?.sql || '';
  assert.match(eligibilitySql, /pkg\.is_active=TRUE/);
  assert.match(eligibilitySql, /pkg\.validity_seconds/);
  assert.doesNotMatch(eligibilitySql, /pkg\.(?:validity|status|time_limit|data_limit)(?![a-z_])/);
  assert.ok(mock.statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_voucher_batches')));
  assert.ok(mock.statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_voucher_issuance_items')));
  assert.ok(mock.statements.some(entry => entry.sql.startsWith('UPDATE public.reseller_billing_accounts')));
  assert.ok(mock.statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_ledger_entries')));
});

test('Hotspot voucher issuance rejects a missing Hotspot pool before generating vouchers', async t => {
  const mock = installIssueMocks(t, { eligible: { ip_pool: null } });
  await assert.rejects(
    issuance.issueBatch(validInput),
    error => error.code === 'HOTSPOT_IP_POOL_NOT_CONFIGURED' && error.statusCode === 409
  );
  assert.equal(mock.generated.length, 0);
  assert.equal(mock.statements.some(entry => entry.sql.startsWith('INSERT INTO public.reseller_voucher_batches')), false);
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
  const detailSql = mock.statements.find(entry => entry.sql.includes('FROM public.reseller_voucher_batches b') && entry.sql.includes('batch_key=$1::uuid'))?.sql || '';
  assert.match(detailSql, /LEFT JOIN public\.pop_hotspot_packages pkg ON pkg\.id=b\.package_id/);
  assert.match(detailSql, /to_jsonb\(pkg\)->>'validity'/);
  assert.ok(detailSql.includes("'N/A'"));
  assert.doesNotMatch(detailSql, /pkg\.validity/);
  assert.doesNotMatch(detailSql, /b\.validity/);
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
  assert.match(source, /WHERE b\.batch_key=\$1::uuid AND b\.reseller_id=\$2/);
});

test('voucher batch history selects the canonical UUID reference and remains reseller-scoped', async t => {
  let captured;
  t.mock.method(db, 'query', async (sql, values) => {
    captured = { sql, values };
    return { rows: [{
      id: '9001', batch_key: BATCH_KEY, pop_id: 21, package_id: '701',
      profile_key: '2-Hour', validity: '2h', quantity: 1, issued_count: 1,
      retail_total: '50.00', wholesale_total: '30.00', margin_total: '20.00',
      billing_mode: 'prepaid', status: 'issued', created_at: new Date('2026-10-30T10:00:00Z')
    }] };
  });
  const rows = await issuance.listBatches(41);
  assert.equal(rows[0].batchKey, BATCH_KEY);
  assert.match(captured.sql, /to_jsonb\(b\)->>'batch_key' AS batch_key/);
  assert.match(captured.sql, /to_jsonb\(pkg\)->>'validity'/);
  assert.ok(captured.sql.includes("'N/A'"));
  assert.doesNotMatch(captured.sql, /pkg\.validity/);
  assert.match(captured.sql, /LEFT JOIN public\.pop_hotspot_packages pkg ON pkg\.id=b\.package_id/);
  assert.doesNotMatch(captured.sql, /b\.validity/);
  assert.match(captured.sql, /to_jsonb\(b\)->>'retail_total'/);
  assert.match(captured.sql, /to_jsonb\(b\)->>'wholesale_total'/);
  assert.match(captured.sql, /to_jsonb\(b\)->>'margin_total'/);
  assert.doesNotMatch(captured.sql, /b\.retail_total|b\.wholesale_total|b\.margin_total/);
  assert.match(captured.sql, /WHERE b\.reseller_id=\$1/);
  assert.deepEqual(captured.values, [41, 50]);
});


test('voucher batch detail resolves validity from its package and never selects a batch validity column', async t => {
  const mock = installIssueMocks(t);
  const result = await issuance.getBatch(41, BATCH_KEY);
  assert.equal(result.batch.validity, '2h');
  const detailSql = mock.statements.find(entry => entry.sql.includes('FROM public.reseller_voucher_batches b') && entry.sql.includes('batch_key=$1::uuid'))?.sql || '';
  assert.match(detailSql, /LEFT JOIN public\.pop_hotspot_packages pkg ON pkg\.id=b\.package_id/);
  assert.match(detailSql, /to_jsonb\(pkg\)->>'validity'/);
  assert.ok(detailSql.includes("'N/A'"));
  assert.doesNotMatch(detailSql, /pkg\.validity/);
  assert.doesNotMatch(detailSql, /b\.validity/);
  assert.match(detailSql, /to_jsonb\(b\)->>'retail_total'/);
  assert.match(detailSql, /to_jsonb\(b\)->>'wholesale_total'/);
  assert.match(detailSql, /to_jsonb\(b\)->>'margin_total'/);
  assert.doesNotMatch(detailSql, /b\.retail_total|b\.wholesale_total|b\.margin_total/);
});

test('forward batch-key compatibility migration adds/backfills UUID without destructive DDL', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '20261031_reseller_voucher_batch_key_compat.sql'), 'utf8');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS batch_key UUID/);
  assert.match(migration, /SET batch_key = gen_random_uuid\(\)/);
  assert.match(migration, /ALTER COLUMN batch_key SET NOT NULL/);
  assert.match(migration, /CREATE UNIQUE INDEX uq_reseller_voucher_batches_batch_key_compat/);
  assert.match(migration, /i\.indisunique AND i\.indisvalid/);
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);
  assert.doesNotMatch(migration, /DELETE FROM public\.(reseller_voucher_batches|reseller_voucher_issuance_items|reseller_ledger_entries)/i);
});


test('reseller dashboard renders assigned POPs as a full-width responsive SaaS card list', () => {
  const dashboard = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-dashboard.ejs'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'reseller-dashboard.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'reseller-workspace.css'), 'utf8');
  assert.match(dashboard, /reseller-panel reseller-assigned-pops/);
  assert.match(dashboard, /id="popGrid" class="pop-grid"/);
  assert.match(css, /grid-column:1 \/ -1/);
  assert.match(css, /padding:20px 24px/);
  assert.match(css, /font-size:1\.25rem;font-weight:600/);
  assert.match(css, /font-size:\.9375rem/);
  assert.match(script, /pop-status-badge/);
  assert.match(script, /pop\.pppoe_ip_pool \|\| pop\.mikrotik_ip_pool/);
});

test('reseller dashboard contains bounded generation and read-only reprint controls', () => {
  const dashboard = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-vouchers.ejs'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'reseller-vouchers.js'), 'utf8');
  assert.match(dashboard, /id="voucherQuantity"[^>]*min="1"[^>]*max="500"/);
  assert.match(script, /retailPrice/);
  assert.match(script, /wholesalePrice/);
  assert.match(dashboard, /voucherHistoryRows/);
  assert.match(script, /\/reseller\/hotspot\/voucher-batches\//);
  assert.match(script, /Idempotency-Key/);
  assert.match(dashboard, /btnIssueVouchers/);
  assert.match(script, /X-Requested-With/);
  assert.match(script, /new window\.QRCode/);
  assert.match(script, /finally\{/);
});


test('catalog exposes core packages without an IP pool and reports issuance readiness separately', async t => {
  const catalogService = require('../services/resellerHotspotCatalogService');
  const statements = [];
  const client = {
    async query(sql, values) {
      statements.push({ sql, values });
      if (sql.includes('FROM public.reseller_billing_accounts')) return { rows: [{ id: '801', billing_mode: 'prepaid', wallet_balance: '100.00', receivable_balance: '0.00', credit_limit: '0.00', currency: 'BDT', account_status: 'active' }] };
      if (sql.includes('FROM public.pops p')) return { rows: [{ id: 21, name: 'North POP', status: 'active', reseller_id: 41 }] };
      if (sql.includes('FROM public.pop_hotspot_bindings')) return { rows: [{ id: '501', pop_id: 21, status: 'active', ip_pool: null, dns_name: 'wifi.example.test' }] };
      if (sql.includes('FROM public.pop_hotspot_packages')) return { rows: [{ id: '701', pop_id: 21, package_name: '30-Day', profile_key: '30-Day', validity_seconds: '2592000', retail_price: '150.00', wholesale_price: '150.00', is_active: true }] };
      throw new Error('Unexpected catalog SQL: ' + sql);
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  const result = await catalogService.getCatalog(41);
  assert.equal(result.pops.length, 1);
  assert.equal(result.pops[0].packages.length, 1);
  assert.equal(result.pops[0].packages[0].validity, '30 days');
  assert.equal(result.pops[0].issuanceReady, false);
  assert.equal(result.pops[0].dnsName, 'wifi.example.test');
  assert.equal(result.pops[0].readinessReason, 'IP_POOL_NOT_CONFIGURED');
  assert.match(statements.find(call => call.sql.includes('FROM public.pop_hotspot_packages')).sql, /validity_seconds/);
  assert.match(statements.find(call => call.sql.includes('FROM public.pop_hotspot_packages')).sql, /is_active/);
  assert.doesNotMatch(statements.find(call => call.sql.includes('FROM public.pop_hotspot_packages')).sql, /\b(validity|status)\b/);
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
  assert.match(calls[1].sql, /INSERT INTO public\\.hotspot_vouchers/);
  assert.match(calls[1].sql, /NULLIF\\(\\$10::varchar,''\\)/);
});

test('print page is authenticated and batch-scoped; no batch mutation routes exist', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'resellerPortalRoutes.js'), 'utf8');
  const printView = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-voucher-print.ejs'), 'utf8');
  assert.match(server, /\/reseller\/hotspot\/voucher-batches\/:batchKey\/print",requireRole\(\["reseller"\]\),loadTenantScope,resellerHotspotController\.printBatchPage/);
  assert.match(printView, /window\.print\(\)/);
  assert.match(printView, /repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(printView, /print-thermal-58/);
  assert.match(printView, /print-thermal-80/);
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

test('catalog surfaces required package schema errors instead of silently returning an empty catalog', async t => {
  const catalogService = require('../services/resellerHotspotCatalogService');
  const schemaError = Object.assign(new Error('column validity_seconds does not exist'), { code: '42703' });
  const client = {
    async query(sql) {
      if (sql.includes('FROM public.reseller_billing_accounts')) return { rows: [] };
      if (sql.includes('FROM public.pops p')) return { rows: [{ id: 21, name: 'North POP', status: 'active', reseller_id: 41 }] };
      if (sql.includes('FROM public.pop_hotspot_bindings')) return { rows: [{ id: '501', pop_id: 21, status: 'active', ip_pool: 'pool-a' }] };
      if (sql.includes('FROM public.pop_hotspot_packages')) throw schemaError;
      throw new Error('Unexpected SQL: ' + sql);
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  await assert.rejects(catalogService.getCatalog(41), error => error === schemaError);
});


test('voucher history and detail project validity defensively across schema variants', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'resellerVoucherIssuanceService.js'), 'utf8');
  for (const projection of [
    "to_jsonb(b)->>'validity'",
    "to_jsonb(pkg)->>'validity'",
    "to_jsonb(pkg)->>'duration'",
    "to_jsonb(pkg)->>'validity_days'",
    "to_jsonb(pkg)->>'validity_period'",
    "'N/A'"
  ]) assert.ok(source.includes(projection), 'missing defensive validity projection: ' + projection);
  assert.equal(source.includes('pkg.validity AS validity'), false);
  assert.doesNotMatch(source, /b\.retail_total|b\.wholesale_total|b\.margin_total/);
  assert.match(source, /to_jsonb\(b\)->>'retail_total'/);
  assert.match(source, /to_jsonb\(b\)->>'wholesale_total'/);
  assert.match(source, /to_jsonb\(b\)->>'margin_total'/);
  assert.equal((source.match(/COALESCE\(to_jsonb\(b\)->>'status', 'completed'\) AS status/g) || []).length, 2);
  const detailFunction = source.slice(source.indexOf('async function loadBatchDetail'), source.indexOf('async function issueBatch'));
  const listFunction = source.slice(source.indexOf('async function listBatches'), source.indexOf('async function getBatch'));
  const batchSelects = [detailFunction, listFunction].map(section => section.match(/`SELECT([\s\S]*?)FROM public\.reseller_voucher_batches b/)?.[1]);
  assert.equal(batchSelects.length, 2);
  assert.ok(batchSelects.every(Boolean), 'both history functions must expose a batch projection');
  assert.doesNotMatch(batchSelects.join('\n'), /b\.status/);
  for (const projection of batchSelects) {
    assert.doesNotMatch(projection, /b\.(?!id\b|reseller_id\b|created_at\b)[a-z_]+/i);
  }
  assert.match(source, /WHERE b\.reseller_id=\$1/);
  assert.match(source, /ORDER BY b\.created_at DESC,b\.id DESC/);
  assert.doesNotMatch(source, /WHERE[^\`]*to_jsonb\(b\)|ORDER BY[^\`]*to_jsonb\(b\)/s);
});

test('POP update uses deterministic Hotspot SQL without runtime schema discovery', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'popController.js'), 'utf8');
  assert.equal(source.includes('information_schema.columns'), false);
  assert.equal(source.includes('inspectHotspotBindingSchema'), false);
  assert.ok(source.includes("INSERT INTO public.pop_hotspot_bindings"));
  assert.ok(source.includes("COALESCE($2, 'core_mikrotik')"));
  assert.ok(source.includes("ON CONFLICT (pop_id) DO UPDATE SET"));
  const update = source.slice(source.indexOf('async function update(req, res)'), source.indexOf('async function updateStatus'));
  assert.ok(update.includes('SELECT * FROM public.pops WHERE id=$1 FOR UPDATE'));
  assert.ok(update.includes('SAVEPOINT pop_hotspot_optional'));
  assert.ok(update.includes('hotspot_persisted: result.hotspotPersisted'));
  assert.ok(update.includes('console.error('));
  assert.ok(update.includes('mikrotik_ip_pool'));
});


test('reseller POS package selection uses delegated canonical state and recalculates financial totals', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'reseller-vouchers.js'), 'utf8');
  const view = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-vouchers.ejs'), 'utf8');
  const scripts = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', 'reseller-scripts.ejs'), 'utf8');
  assert.match(script, /selectedPackageId:null/);
  assert.match(script, /voucherPackageGrid'\)\.addEventListener\('click'/);
  assert.match(script, /state\.selectedPackageId=String\(selected\.id\)/);
  assert.match(script, /state\.retailPrice=String\(selected\.retailPrice\)/);
  assert.match(script, /state\.wholesalePrice=String\(selected\.wholesalePrice\)/);
  assert.match(script, /state\.margin=decimal\(/);
  assert.match(script, /issueButton\.disabled=!canIssue/);
  assert.match(script, /summary\(\);\}\);el\('btnIssueVouchers'\)/);
  assert.match(view, /class="pos-package-scroll mb-3"/);
  assert.match(view, /max-height:380px;overflow-y:auto/);
  assert.doesNotMatch(view, /voucherPrefix|Username prefix/);
  assert.match(scripts, /reseller-vouchers\.js\?v=20261031-7/);
});


test('actor identity is validated against the BIGINT database contract and persisted consistently', async t => {
  const mock = installIssueMocks(t);
  await issuance.issueBatch(validInput);
  const batch = mock.statements.find(entry => entry.sql.startsWith('INSERT INTO public.reseller_voucher_batches'));
  const ledger = mock.statements.find(entry => entry.sql.startsWith('INSERT INTO public.reseller_ledger_entries'));
  assert.equal(batch.values[21], '41');
  assert.equal(ledger.values[10], '41');
  await assert.rejects(
    issuance.issueBatch({ ...validInput, idempotencyKey: 'test-request-0002', actorUserId: 'user-uuid-not-int8' }),
    error => error.code === 'INVALID_ACTOR_USER_ID' && error.statusCode === 403
  );
});

test('schema reconciliation migration is forward-only and preserves append-only ledger protection', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '20261031_reseller_voucher_contract_reconcile.sql'), 'utf8');
  assert.match(migration, /reseller_voucher/);
  assert.match(migration, /ALTER COLUMN idempotency_key TYPE VARCHAR/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS currency CHAR\\(3\\)/);
  assert.match(migration, /ALTER COLUMN account_id DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN direction DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN created_by DROP NOT NULL/);
  assert.match(migration, /wallet_debit/);
  assert.match(migration, /receivable_charge/);
  assert.match(migration, /trg_reseller_ledger_no_update/);
  assert.doesNotMatch(migration, /\\bDROP\\s+(TABLE|COLUMN)\\b/i);
  assert.doesNotMatch(migration, /\\b(DELETE FROM|TRUNCATE)\\b/i);
});
