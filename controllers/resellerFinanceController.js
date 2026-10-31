'use strict';
const financeService = require('../services/resellerFinanceService');
function fail(res, error, operation) {
  console.error('[Reseller Finance] ' + operation + ' failed:', { code:error.code||'UNEXPECTED_ERROR', databaseCode:/^[0-9A-Z]{5}$/.test(String(error.code||''))?error.code:null, constraint:error.constraint||null, message:error.message, stack:error.stack });
  const status=Number.isInteger(error.statusCode)?error.statusCode:503;
  return res.status(status).json({success:false,code:error.code||'FINANCE_OPERATION_FAILED',message:status>=500?'Finance operation failed. Contact support with the error code.':error.message});
}
function resellerId(req){const id=Number(req.params.resellerId);return Number.isSafeInteger(id)&&id>0?id:null;}
function actorId(req){return req.auth?.userId||req.session?.userId||null;}
async function inspect(req,res){
  const id=resellerId(req);if(!id)return res.status(400).json({success:false,code:'INVALID_RESELLER_ID',message:'Invalid reseller ID.'});
  try{const result=await financeService.inspect(id);if(!result)return res.status(404).json({success:false,code:'BILLING_ACCOUNT_NOT_FOUND',message:'Reseller billing account not found.'});return res.set('Cache-Control','no-store').json({success:true,...result});}
  catch(error){return fail(res,error,'Inspection');}
}
async function walletTopup(req,res){
  const id=resellerId(req);if(!id)return res.status(400).json({success:false,code:'INVALID_RESELLER_ID',message:'Invalid reseller ID.'});
  try{const result=await financeService.walletTopup({...req.body,resellerId:id,actorUserId:actorId(req),idempotencyKey:req.get('Idempotency-Key')});return res.status(result.replayed?200:201).json({success:true,...result,message:result.replayed?'Original wallet top-up returned.':'Wallet top-up posted.'});}
  catch(error){return fail(res,error,'Wallet top-up');}
}
async function receivableSettlement(req,res){
  const id=resellerId(req);if(!id)return res.status(400).json({success:false,code:'INVALID_RESELLER_ID',message:'Invalid reseller ID.'});
  try{const result=await financeService.receivableSettlement({...req.body,resellerId:id,actorUserId:actorId(req),idempotencyKey:req.get('Idempotency-Key')});return res.status(result.replayed?200:201).json({success:true,...result,message:result.replayed?'Original receivable settlement returned.':'Receivable settlement posted.'});}
  catch(error){return fail(res,error,'Receivable settlement');}
}
async function updateCreditLimit(req,res){
  const id=resellerId(req);if(!id)return res.status(400).json({success:false,code:'INVALID_RESELLER_ID',message:'Invalid reseller ID.'});
  try{const result=await financeService.updateCreditLimit({resellerId:id,creditLimit:req.body?.creditLimit,actorUserId:actorId(req)});return res.json({success:true,...result,message:'Postpaid credit limit updated.'});}
  catch(error){return fail(res,error,'Credit limit update');}
}
module.exports={inspect,walletTopup,receivableSettlement,updateCreditLimit};
