'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../db');
const finance=require('../services/resellerFinanceService');
function mockTransaction(t,handler){
 const calls=[];const client={async query(sql,values){calls.push({sql,values});return handler(sql,values,calls);}};
 t.mock.method(db,'withTransaction',async callback=>callback(client));return calls;
}
const input={resellerId:41,actorUserId:9,amount:'25.50',idempotencyKey:'finance-test-0001',paymentProvider:'cash',externalReference:'RCPT-1',notes:'Counter receipt'};
test('prepaid top-up writes the live settlement contract and canonical wallet_topup ledger entry',async t=>{
 const calls=mockTransaction(t,sql=>{
  if(sql.includes('pg_advisory_xact_lock'))return{rows:[]};
  if(sql.includes('WHERE idempotency_key'))return{rows:[]};
  if(sql.includes('FOR UPDATE'))return{rows:[{id:'801',reseller_id:41,billing_mode:'prepaid',wallet_balance:'10.00',receivable_balance:'0.00',credit_limit:'0.00',currency:'BDT',account_status:'active'}]};
  if(sql.includes('INSERT INTO public.reseller_settlements'))return{rows:[{id:'1001'}]};
  if(sql.includes('UPDATE public.reseller_billing_accounts'))return{rowCount:1,rows:[{id:'801',wallet_balance:'35.50'}]};
  if(sql.includes('INSERT INTO public.reseller_ledger_entries'))return{rowCount:1,rows:[{id:'2001'}]};
  throw new Error('Unexpected SQL: '+sql);
 });
 const result=await finance.walletTopup(input);assert.equal(result.replayed,false);
 assert.ok(calls.some(c=>/FOR UPDATE/.test(c.sql)));
 const settlement=calls.find(c=>c.sql.includes('INSERT INTO public.reseller_settlements'));
 assert.match(settlement.sql,/\(account_id,reseller_id,settlement_type,amount,payment_provider,external_reference,received_by,received_at,notes\)/);
 assert.deepEqual(settlement.values,['801',41,'wallet_topup','25.50','cash','RCPT-1','9','Counter receipt']);
 const ledger=calls.find(c=>c.sql.includes('INSERT INTO public.reseller_ledger_entries'));
 assert.match(ledger.sql,/\(account_id,billing_account_id,reseller_id,account_type,entry_type/);
 assert.equal(ledger.values[2],'wallet');assert.equal(ledger.values[3],'wallet_topup');
});
test('wallet top-up requires a non-null authenticated actor before opening a transaction',async()=>{
 await assert.rejects(finance.walletTopup({...input,actorUserId:null}),e=>e.code==='AUTHENTICATED_ACTOR_REQUIRED'&&e.statusCode===401);
});

test('postpaid settlement is exclusive and reduces receivable',async t=>{
 const calls=mockTransaction(t,sql=>{
  if(sql.includes('pg_advisory_xact_lock')||sql.includes('WHERE idempotency_key'))return{rows:[]};
  if(sql.includes('FOR UPDATE'))return{rows:[{id:'802',reseller_id:41,billing_mode:'postpaid',wallet_balance:'0.00',receivable_balance:'80.00',credit_limit:'100.00',currency:'BDT',account_status:'active'}]};
  if(sql.includes('INSERT INTO public.reseller_settlements'))return{rows:[{id:'1002'}]};
  if(sql.includes('UPDATE public.reseller_billing_accounts'))return{rowCount:1,rows:[{id:'802',receivable_balance:'54.50'}]};
  if(sql.includes('INSERT INTO public.reseller_ledger_entries'))return{rowCount:1,rows:[{id:'2002'}]};
  throw new Error('Unexpected SQL: '+sql);
 });
 await finance.receivableSettlement(input);
 const update=calls.find(c=>c.sql.includes('UPDATE public.reseller_billing_accounts'));
 assert.match(update.sql,/receivable_balance=receivable_balance-\$1::numeric/);
 const ledger=calls.find(c=>c.sql.includes('INSERT INTO public.reseller_ledger_entries'));
 assert.equal(ledger.values[3],'receivable_settlement');
});
test('mode crossover is rejected before posting',async t=>{
 const calls=mockTransaction(t,sql=>{
  if(sql.includes('pg_advisory_xact_lock')||sql.includes('WHERE idempotency_key'))return{rows:[]};
  if(sql.includes('FOR UPDATE'))return{rows:[{id:'802',reseller_id:41,billing_mode:'prepaid',wallet_balance:'10.00',receivable_balance:'0.00',credit_limit:'0.00',currency:'BDT',account_status:'active'}]};
  throw new Error('Unexpected SQL: '+sql);
 });
 await assert.rejects(finance.receivableSettlement(input),e=>e.code==='BILLING_MODE_OPERATION_MISMATCH');
 assert.equal(calls.some(c=>c.sql.includes('INSERT INTO public.reseller_settlements')),false);
});
test('credit limit cannot be reduced below outstanding receivable',async t=>{
 const calls=mockTransaction(t,sql=>{
  if(sql.includes('FOR UPDATE'))return{rows:[{id:'802',reseller_id:41,billing_mode:'postpaid',wallet_balance:'0.00',receivable_balance:'80.00',credit_limit:'100.00',currency:'BDT',account_status:'active'}]};
  throw new Error('Unexpected SQL: '+sql);
 });
 await assert.rejects(finance.updateCreditLimit({resellerId:41,actorUserId:9,creditLimit:'79.99'}),e=>e.code==='CREDIT_LIMIT_BELOW_RECEIVABLE');
 assert.equal(calls.some(c=>c.sql.includes('UPDATE public.reseller_billing_accounts')),false);
});
test('global idempotency replay prevents a second settlement and ledger write',async t=>{
 const calls=mockTransaction(t,sql=>{
  if(sql.includes('pg_advisory_xact_lock'))return{rows:[]};
  if(sql.includes('WHERE idempotency_key'))return{rows:[{id:'2001',account_id:'801',reseller_id:41,account_type:'wallet',entry_type:'wallet_topup',amount:'25.50',settlement_id:'1001'}]};
  if(sql.includes('WHERE reseller_id=$1 LIMIT 1'))return{rows:[{id:'801',reseller_id:41,billing_mode:'prepaid'}]};
  throw new Error('Unexpected SQL: '+sql);
 });
 const result=await finance.walletTopup(input);assert.equal(result.replayed,true);assert.equal(result.ledgerEntryId,'2001');
 assert.equal(calls.some(c=>c.sql.includes('INSERT INTO public.reseller_settlements')),false);
});
test('global idempotency rejects a conflicting amount',async t=>{
 mockTransaction(t,sql=>{
  if(sql.includes('pg_advisory_xact_lock'))return{rows:[]};
  if(sql.includes('WHERE idempotency_key'))return{rows:[{id:'2001',account_id:'801',reseller_id:41,account_type:'wallet',entry_type:'wallet_topup',amount:'25.50',settlement_id:'1001'}]};
  if(sql.includes('WHERE reseller_id=$1 LIMIT 1'))return{rows:[{id:'801',reseller_id:41,billing_mode:'prepaid'}]};
  throw new Error('Unexpected SQL: '+sql);
 });
 await assert.rejects(finance.walletTopup({...input,amount:'26.00'}),e=>e.code==='IDEMPOTENCY_KEY_CONFLICT');
});
test('finance amount and idempotency inputs are bounded',()=>{
 assert.throws(()=>finance.amountCents('0'),e=>e.code==='INVALID_AMOUNT');
 assert.throws(()=>finance.amountCents('1.999'),e=>e.code==='INVALID_AMOUNT');
 assert.throws(()=>finance.idempotencyKey('short'),e=>e.code==='INVALID_IDEMPOTENCY_KEY');
});

test('zero credit limit is allowed only when the outstanding receivable is zero', async t => {
  const calls=mockTransaction(t,sql=>{
    if(sql.includes('FOR UPDATE'))return{rows:[{id:'802',reseller_id:41,billing_mode:'postpaid',wallet_balance:'0.00',receivable_balance:'0.00',credit_limit:'100.00',currency:'BDT',account_status:'active'}]};
    if(sql.includes('UPDATE public.reseller_billing_accounts'))return{rowCount:1,rows:[{id:'802',credit_limit:'0.00'}]};
    throw new Error('Unexpected SQL: '+sql);
  });
  const result=await finance.updateCreditLimit({resellerId:41,actorUserId:9,creditLimit:'0.00'});
  assert.equal(result.account.credit_limit,'0.00');
  assert.ok(calls.some(c=>c.sql.includes('UPDATE public.reseller_billing_accounts')));
});


test('inspect reads settlement history using the deployed reseller settlement contract', async t => {
  const calls = [];
  const account = {
    id: '801', reseller_id: 41, billing_mode: 'prepaid', wallet_balance: '10.00',
    receivable_balance: '0.00', credit_limit: '0.00', currency: 'BDT',
    account_status: 'active', created_at: '2026-10-31T00:00:00.000Z',
    updated_at: '2026-10-31T00:00:00.000Z'
  };
  const ledgerRows = [{ id: '2001', billing_account_id: '801', entry_type: 'wallet_topup' }];
  const settlementRows = [{
    id: '1001', billing_account_id: '801', idempotency_key: null, amount: '10.00',
    currency: 'BDT', payment_method: 'cash', external_reference: 'RCPT-1',
    settlement_type: 'wallet_topup', status: null, actor_user_id: 9,
    received_at: '2026-10-31T00:00:00.000Z', notes: 'Counter receipt'
  }];
  t.mock.method(db, 'query', async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('FROM public.reseller_billing_accounts WHERE reseller_id=$1')) {
      return { rows: [account] };
    }
    if (sql.includes('FROM public.reseller_ledger_entries')) return { rows: ledgerRows };
    if (sql.includes('FROM public.reseller_settlements s')) return { rows: settlementRows };
    throw new Error('Unexpected inspect SQL: ' + sql);
  });

  const result = await finance.inspect(41);
  assert.equal(result.account.id, '801');
  assert.deepEqual(result.ledgerEntries, ledgerRows);
  assert.deepEqual(result.settlements, settlementRows);
  const settlementQuery = calls.find(call => call.sql.includes('FROM public.reseller_settlements s'));
  assert.ok(settlementQuery);
  assert.match(settlementQuery.sql, /s\.account_id AS billing_account_id/);
  assert.match(settlementQuery.sql, /s\.payment_provider AS payment_method/);
  assert.match(settlementQuery.sql, /s\.received_by AS actor_user_id/);
  assert.match(settlementQuery.sql, /s\.settlement_type/);
  assert.doesNotMatch(settlementQuery.sql, /s?\.billing_account_id|s?\.payment_method|s?\.idempotency_key|s?\.status/);
  assert.deepEqual(settlementQuery.values, ['801']);
});
