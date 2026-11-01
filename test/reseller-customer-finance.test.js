'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const finance = require('../services/resellerFinanceService');

function billingClient({ mode='prepaid', wallet='500.00', receivable='0.00', credit='0.00' }={}) {
  const statements=[];
  return {
    statements,
    async query(sql, params=[]) {
      statements.push({sql:String(sql),params});
      if (/FROM public\.reseller_ledger_entries WHERE reseller_id=\$1 AND idempotency_key=\$2/.test(sql)) return {rows:[]};
      if (/SELECT id,reseller_id,billing_mode,wallet_balance/.test(sql)) return {rows:[{id:'801',reseller_id:'41',billing_mode:mode,wallet_balance:wallet,receivable_balance:receivable,credit_limit:credit,currency:'BDT',account_status:'active'}]};
      if (/UPDATE public\.reseller_billing_accounts/.test(sql)) {
        if (mode==='prepaid' && Number(wallet)<Number(params[0])) return {rowCount:0,rows:[]};
        return {rowCount:1,rows:[{wallet_balance:mode==='prepaid'?'400.00':wallet,receivable_balance:mode==='postpaid'?'100.00':receivable,credit_limit:credit,currency:'BDT'}]};
      }
      if (/INSERT INTO public\.reseller_ledger_entries/.test(sql)) return {rowCount:1,rows:[{id:'991'}]};
      throw new Error('Unexpected query: '+sql);
    }
  };
}

test('customer charge deducts prepaid wallet and writes customer debit ledger entry', async () => {
  const client=billingClient();
  const result=await finance.chargeCustomer(client,{resellerId:41,customerId:902,amount:'100.00',idempotencyKey:'create-customer:902',description:'Initial activation for customer test-user',actorUserId:41});
  assert.equal(result.ledgerEntryId,'991');
  assert.equal(result.billingMode,'prepaid');
  const update=client.statements.find(s=>/UPDATE public\.reseller_billing_accounts/.test(s.sql));
  assert.match(update.sql,/wallet_balance=wallet_balance-\$1::numeric/);
  const insert=client.statements.find(s=>/INSERT INTO public\.reseller_ledger_entries/.test(s.sql));
  assert.match(insert.sql,/customer_id,batch_id,settlement_id/);
  assert.equal(insert.params[6],'902');
  assert.equal(insert.params[3],'wallet_debit');
});

test('customer charge refuses an insufficient prepaid wallet before any mutation', async () => {
  const client=billingClient({wallet:'50.00'});
  await assert.rejects(
    finance.chargeCustomer(client,{resellerId:41,customerId:902,amount:'100.00',idempotencyKey:'create-customer:902',description:'Initial activation',actorUserId:41}),
    error=>error.code==='INSUFFICIENT_WALLET_BALANCE' && error.statusCode===400
  );
  assert.equal(client.statements.some(s=>/UPDATE public\.reseller_billing_accounts|INSERT INTO public\.reseller_ledger_entries/.test(s.sql)),false);
});

test('customer charge records postpaid receivable usage', async () => {
  const client=billingClient({mode:'postpaid',wallet:'0.00',receivable:'50.00',credit:'500.00'});
  const result=await finance.chargeCustomer(client,{resellerId:41,customerId:902,amount:'100.00',idempotencyKey:'create-customer:902',description:'Initial activation',actorUserId:41});
  assert.equal(result.billingMode,'postpaid');
  const update=client.statements.find(s=>/UPDATE public\.reseller_billing_accounts/.test(s.sql));
  assert.match(update.sql,/receivable_balance=receivable_balance\+\$1::numeric/);
  const insert=client.statements.find(s=>/INSERT INTO public\.reseller_ledger_entries/.test(s.sql));
  assert.equal(insert.params[3],'receivable_charge');
});
