"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");
function recorder(){return{statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function loadController(){
 const file=path.resolve(__dirname,"../controllers/dashboardController.js"),original=Module._load;
 const state={queries:[],routerCalls:[]};
 const db={async query(sql,params=[]){state.queries.push({sql,params});if(sql.includes("SELECT username,status,expires_at FROM hotspot_vouchers"))return{rows:[{username:"FZ-1001",status:"active",expires_at:null},{username:"FZ-EXPIRED",status:"expired",expires_at:"2026-10-10T00:00:00.000Z"}]};if(sql.includes("WITH clock AS")&&sql.includes("SUM(s.amount) FILTER"))return{rows:[{today:"120.00",yesterday:"45.00",last7days:"350.00",thismonth:"900.00",last30days:"1200.00",thisyear:"6500.00"}]};if(sql.includes("SELECT username,phone,profile,status,created_at FROM hotspot_vouchers"))return{rows:[{username:"FZ-1001",phone:"01700000000",profile:"30 Mbps",status:"active",created_at:"2026-10-15T05:00:00.000Z"}]};if(sql.includes("FROM transactions t INNER JOIN hotspot_vouchers v"))return{rows:[{matched_username:"FZ-1001",profile:"30 Mbps",amount:"120.00",channel:"bkash",trx_id:"TEST-123",created_at:"2026-10-15T05:00:00.000Z"}]};return{rows:[]};}};
 const mikrotik=new Proxy({}, {get(_target,method){return async()=>{state.routerCalls.push(String(method));if(method==="getHotspotUsers")return[{username:"FZ-1001"},{username:"FZ-ROUTER"}];if(method==="getActiveHotspotSessions")return[{username:"FZ-1001"},{username:"FZ-LIVE"}];throw new Error("Unexpected RouterOS method: "+String(method));};}});
 delete require.cache[file];
 Module._load=function(request,parent,isMain){if(parent&&parent.filename===file&&request==="../db")return db;if(parent&&parent.filename===file&&request=="../services/mikrotikService")return mikrotik;return original.call(this,request,parent,isMain);};
 try{return{controller:require(file),state};}finally{Module._load=original;}
}
test("Hotspot dashboard overview counts unique database and MikroTik users plus live sessions",async()=>{
 const{controller,state}=loadController(),res=recorder();
 await controller.hotspotOverview({query:{}},res);
 assert.equal(res.statusCode,200);assert.equal(res.body.success,true);
 assert.deepEqual(res.body.counts,{totalUsers:3,activeUsers:2,expiredUsers:1});
 assert.equal(res.body.rechargeTotals.today,120);assert.equal(res.body.rechargeTotals.last30days,1200);
 assert.equal(res.body.recentCustomers[0].username,"FZ-1001");assert.equal(res.body.recentRecharges[0].trx_id,"TEST-123");
 assert.deepEqual(state.routerCalls.sort(),["getActiveHotspotSessions","getHotspotUsers"].sort());assert.ok(state.queries.every(q=>/^\s*(SELECT|WITH)/i.test(q.sql)));
});
test("Hotspot recharge period filter is whitelisted and uses a Bangladesh-time SQL boundary",async()=>{
 const{controller,state}=loadController(),res=recorder();
 await controller.hotspotOverview({query:{filter:"today"}},res);
 assert.equal(res.statusCode,200);assert.equal(res.body.filter,"today");
 const sales=state.queries.find(q=>q.sql.includes("SELECT s.matched_username,s.profile")&&q.sql.includes("LIMIT 200"));
 assert.ok(sales);assert.match(sales.sql,/Asia\/Dhaka/);assert.equal(sales.sql.includes("LIMIT 200"),true);
});
test("Invalid Hotspot recharge filter is rejected before querying the database",async()=>{
 const{controller,state}=loadController(),res=recorder();
 await controller.hotspotOverview({query:{filter:"today;DROP TABLE transactions"}},res);
 assert.equal(res.statusCode,400);assert.equal(state.queries.length,0);
});
