"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");
function loadController(){
 const controllerPath=path.resolve(__dirname,"../controllers/hotspotController.js"),originalLoad=Module._load;
 const state={queries:[],creates:[],removes:[],vouchers:[],profileReads:0};
 const db={
  async query(sql,params=[]){state.queries.push({sql,params});return {rows:[]};},
  async withTransaction(fn){return fn({async query(sql,params=[]){state.queries.push({sql,params});if(/INSERT INTO hotspot_vouchers/i.test(sql)){const row={id:state.vouchers.length+1,username:params[0],password:params[1],profile:params[2],validity:params[3],price:params[4],status:"unused"};state.vouchers.push(row);return {rows:[row]};}return {rows:[]};}});}
 };
 const mikrotik={async getHotspotProfiles(){state.profileReads++;return [{name:"Gold",sessionTimeout:"1d"}];},async getHotspotUsers(){return [];},async createHotspotUser(user){state.creates.push(user);},async removeHotspotUser(username){state.removes.push(username);}};
 delete require.cache[controllerPath];
 Module._load=function(request,parent,isMain){if(parent&&parent.filename===controllerPath&&request==="../db")return db;if(parent&&parent.filename===controllerPath&&request==="../services/mikrotikService")return mikrotik;return originalLoad.call(this,request,parent,isMain);};
 try{return {controller:require(controllerPath),state};}finally{Module._load=originalLoad;}
}
function responseRecorder(){return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
test("generates scratch vouchers in the DB ledger without provisioning RouterOS users",async()=>{
 const {controller,state}=loadController(),res=responseRecorder();
 await controller.generate({body:{quantity:3,profile:"Gold",price:10,userPrefix:"FAZ-",charLength:6}},res);
 assert.equal(res.statusCode,201);assert.equal(res.body.success,true);assert.equal(res.body.count,3);
 assert.equal(state.vouchers.length,3);assert.equal(state.creates.length,0);
 assert.ok(state.queries.every(q=>/scratch_voucher|SELECT value FROM app_settings/.test(q.sql)));
 assert.ok(state.vouchers.every(v=>v.status==="unused"&&v.profile==="Gold"&&v.validity==="1d"));
 assert.equal(new Set(state.vouchers.map(v=>v.username)).size,3);
 const insertQuery=state.queries.find(q=>/INSERT INTO hotspot_vouchers/i.test(q.sql));
 assert.ok(insertQuery);assert.match(insertQuery.sql,/ON CONFLICT DO NOTHING RETURNING/i);
 assert.doesNotMatch(insertQuery.sql,/ON CONFLICT\\s*\\(username\\)/i);
});
test("rejects invalid quantities before database or RouterOS work",async()=>{
 const {controller,state}=loadController(),res=responseRecorder();
 await controller.generate({body:{quantity:501,profile:"Gold",validity:"1d",price:10}},res);
 assert.equal(res.statusCode,400);assert.equal(res.body.success,false);
 assert.equal(state.vouchers.length,0);assert.equal(state.profileReads,0);assert.equal(state.queries.length,0);
});
test("rejects nonexistent profiles and inherits validity from selected profile",async()=>{
 const {controller,state}=loadController(),badProfile=responseRecorder();
 await controller.generate({body:{quantity:1,profile:"NotReal",validity:"1d",price:10}},badProfile);
 assert.equal(badProfile.statusCode,400);assert.equal(badProfile.body.code,"PROFILE_NOT_FOUND");
 const validProfile=responseRecorder();
 await controller.generate({body:{quantity:1,profile:"Gold",price:10}},validProfile);
 assert.equal(validProfile.statusCode,201);assert.equal(validProfile.body.validity,"1d");
 assert.equal(state.vouchers.length,1);
});
