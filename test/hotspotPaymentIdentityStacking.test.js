"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../db");
const mikrotik=require("../services/mikrotikService");
const paymentController=require("../controllers/paymentController");

function responseRecorder(){return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function profile(){return [{name:"1-Hour",sharedUsers:"1",sessionTimeout:"1h",raw:{}}];}
function metadata(){return {"1-Hour":{id:"pkg-1-hour",profile_id:"pkg-1-hour",price:10,validityValue:1,validityUnit:"hours",limitBytesTotal:0}};}
function transaction(){return {id:905,trx_id:"STACK-TEST-905",channel:"bkash",sender_phone:"01712345678",amount:10,status:"unmatched",used:false,matched_username:null};}
function formatDhaka(value){
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(value);
 const get=k=>p.find(x=>x.type===k).value;
 return get("year")+"-"+get("month")+"-"+get("day")+" "+get("hour")+":"+get("minute")+":"+get("second");
}
async function withPaymentMocks({voucherRows=[],onStage=()=>{},claimBehavior}={},run){
 const oldQuery=db.query,oldTx=db.withTransaction,oldProfiles=mikrotik.getHotspotProfiles;
 let claimCount=0,stageCount=0,associationCount=0;
 const tx=transaction();
 try{
  db.query=async(sql,params=[])=>{
   if(sql.startsWith("SELECT * FROM transactions"))return {rows:[{...tx}]};
   if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(metadata())}]};
   if(sql.startsWith("UPDATE transactions SET status='processing'")){
    claimCount++;
    const ok=claimBehavior?claimBehavior(claimCount):claimCount===1;
    if(!ok)return {rows:[]};
    return {rows:[{id:tx.id}]};
   }
   if(sql.startsWith("SELECT status FROM transactions"))return {rows:[{status:claimCount>1?"processed":"processing"}]};
   throw new Error("Unexpected db.query SQL: "+sql);
  };
  db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
   if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
   if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:voucherRows};
   if(sql.startsWith("UPDATE hotspot_vouchers SET username=$1")){
    stageCount++;onStage({sql,params});
    const row={id:41,username:params[0],phone:params[6],profile:params[2],status:"pending_claim",mac_address:params[10],first_login_at:params[11],expires_at:params[12],transaction_id:params[13],renewal_stacked:params[14],comment:params[5]};
    return {rows:[row]};
   }
   if(sql.startsWith("INSERT INTO hotspot_vouchers")){
    stageCount++;onStage({sql,params});
    return {rows:[{id:41,username:params[0],phone:params[6],profile:params[2],status:"pending_claim",mac_address:params[10],transaction_id:params[11]}]};
   }
   if(sql.startsWith("INSERT INTO hotspot_voucher_payments")){
    associationCount++;assert.equal(params[0],tx.id);assert.equal(params[1],41);assert.equal(params[2],"01712345678");assert.equal(params[3],10);return {rows:[]};
   }
   if(sql.startsWith("UPDATE transactions SET status='processed'"))return {rows:[{id:tx.id}]};
   throw new Error("Unexpected transaction SQL: "+sql);
  }});
  mikrotik.getHotspotProfiles=async()=>profile();
  const result=await run({tx,stats:()=>({claimCount,stageCount,associationCount})});
  return result;
 }finally{
  db.query=oldQuery;db.withTransaction=oldTx;mikrotik.getHotspotProfiles=oldProfiles;
 }
}

test("verifyTrx persists the voucher foreign key and a durable payment-to-voucher association",async()=>{
 let staged;
 await withPaymentMocks({onStage:value=>{staged=value;}},async({stats})=>{
  const res=responseRecorder();
  await paymentController.verifyTrx({ip:"identity-link-test",body:{service_type:"hotspot",phone:"01712345678",trxId:"STACK-TEST-905",amount:10,profile_id:"pkg-1-hour",paymentMethod:"bkash"}},res);
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(res.body.pending_activation,true);
  assert.equal(stats().associationCount,1);
 });
 assert.match(staged.sql,/transaction_id/);
 assert.equal(staged.params[11],905,"new voucher stores the claimed transaction ID");
});

test("active Hotspot renewal stacks new duration from the saved future expires_at",async()=>{
 const oldExpiry=new Date(Date.now()+2*60*60*1000);
 const firstLogin=new Date(Date.now()-30*60*1000);
 let staged;
 const voucher={id:41,username:"AA:BB:CC:DD:EE:FF",password:"01712345678",profile:"1-Hour",profile_id:"pkg-1-hour",validity:"1h",price:10,status:"active",phone:"01712345678",server:"all",time_limit:"1h",data_limit:null,mac_address:"AA:BB:CC:DD:EE:FF",comment:"Exp: "+formatDhaka(oldExpiry),first_login_at:firstLogin,expires_at:oldExpiry,transaction_id:904};
 await withPaymentMocks({voucherRows:[voucher],onStage:value=>{staged=value;}},async({stats})=>{
  const res=responseRecorder();
  await paymentController.verifyTrx({ip:"expiry-stack-test",body:{service_type:"hotspot",phone:"01712345678",trxId:"STACK-TEST-905",amount:10,profile_id:"pkg-1-hour",paymentMethod:"bkash"}},res);
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(res.body.pending_activation,true);
  assert.equal(stats().associationCount,1);
 });
 assert.ok(staged,"existing voucher should be updated rather than replaced");
 assert.match(staged.sql,/transaction_id=\$14/);
 assert.match(staged.sql,/renewal_stacked=\$15/);
 assert.equal(staged.params[13],905,"current transaction ID is persisted on the voucher");
 assert.equal(staged.params[14],true,"active expiry stacking is marked for activation");
 assert.equal(new Date(staged.params[12]).getTime(),oldExpiry.getTime()+60*60*1000,"new expiry is old expiry plus package duration");
 assert.equal(staged.params[11].getTime(),firstLogin.getTime(),"original first-login time is preserved");
 assert.equal(staged.params[5],"Exp: "+formatDhaka(new Date(oldExpiry.getTime()+60*60*1000)),"RouterOS comment uses the stacked absolute expiry");
});

test("concurrent verification requests cannot claim or stage the same TrxID twice",async()=>{
 let staged=0;
 const result=await withPaymentMocks({onStage:()=>{staged++;}},async()=>{
  const req=()=>({ip:"concurrent-"+Math.random().toString(36).slice(2),body:{service_type:"hotspot",phone:"01712345678",trxId:"STACK-TEST-905",amount:10,profile_id:"pkg-1-hour",paymentMethod:"bkash"}});
  const a=responseRecorder(),b=responseRecorder();
  await Promise.all([paymentController.verifyTrx(req(),a),paymentController.verifyTrx(req(),b)]);
  const responses=[a,b];
  assert.equal(responses.filter(r=>r.statusCode===200).length,1,JSON.stringify(responses.map(r=>({status:r.statusCode,body:r.body}))));
  assert.equal(responses.filter(r=>r.statusCode===409).length,1);
  assert.equal(staged,1,"only the winning claim can stage a voucher");
  return responses;
 });
 assert.equal(result.length,2);
});
