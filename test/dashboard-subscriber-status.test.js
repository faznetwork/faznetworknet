"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");

function response(){
  return{statusCode:200,headers:{},body:null,set(name,value){this.headers[name]=value;return this;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
}
function load({customers,sessions,failMonthQuery=false,failCustomerQuery=false,failSessions=false,proberState="online"}={}){
  const file=path.resolve(__dirname,"../controllers/dashboardController.js");
  const original=Module._load;
  const db={
    async query(sql){
      if(sql.includes("olt_telemetry"))throw new Error("retired OLT telemetry table must not be queried");
      if(sql.includes("SELECT username FROM customers WHERE status NOT IN")){if(failCustomerQuery)throw new Error("customer query failed");return{rows:customers||[]};}
      if(sql.includes("SELECT COALESCE(SUM(amount),0) AS amount,COUNT(*)::int AS count FROM transactions"))return{rows:[{amount:"120",count:2}]};
      if(sql.includes("SELECT COALESCE(SUM(amount),0) AS amount FROM transactions")){if(failMonthQuery)throw new Error("month totals query failed");return{rows:[{amount:"900"}]};}
      if(sql.includes("SELECT c.id,c.full_name,c.username"))return{rows:[]};
      if(sql.includes("SELECT trx_id,channel,amount,status,created_at"))return{rows:[]};
      throw new Error("Unexpected dashboard SQL: "+sql.slice(0,100));
    }
  };
  const mikrotik=new Proxy({}, {get(_target,method){
    return async()=> {
      if(method==="getSystemResources")return{boardName:"RB4011",cpuLoad:5,memoryUsagePercent:25,uptime:"1d"};
      if(method==="getInterfaces")return[];
      if(method==="getActiveSessions"){if(failSessions)throw new Error("active session source unavailable");return sessions||[];}
      if(method==="testConnection")return{model:"RB4011"};
      if(method==="getInterfaceTraffic")return null;
      throw new Error("Unexpected RouterOS method: "+String(method));
    };
  }});
  const prober={
    getRouterStatusSnapshot(){
      if(proberState==="checking")return{state:"checking",online:null,lastSeenAt:null,lastAttemptAt:null,lastError:null,ageMs:null,consecutiveFailures:0,data:null};
      if(proberState==="offline")return{state:"offline",online:false,lastSeenAt:null,lastAttemptAt:null,lastError:"Router unreachable",ageMs:null,consecutiveFailures:1,data:null};
      return{state:"online",online:true,lastSeenAt:new Date().toISOString(),lastAttemptAt:new Date().toISOString(),lastError:null,ageMs:0,consecutiveFailures:0,data:{
        resources:{boardName:"RB4011",cpuLoad:5,memoryUsagePercent:25,uptime:"1d"},
        interfaces:[],
        sessions:failSessions?null:sessions||[],
        identity:{model:"RB4011"},
        trafficByInterface:{}
      }};
    }
  };
  delete require.cache[file];
  Module._load=function(request,parent,isMain){
    if(parent&&parent.filename===file&&request==="../db")return db;
    if(parent&&parent.filename===file&&request==="../services/mikrotikService")return mikrotik;
    if(parent&&parent.filename===file&&request==="../services/routerStatusProber")return prober;
    return original.call(this,request,parent,isMain);
  };
  try{return require(file);}finally{Module._load=original;}
}
function fixture(){
 const customers=Array.from({length:21},(_,i)=>({username:"customer-"+String(i+1).padStart(2,"0")}));
 const sessions=customers.slice(0,18).map(row=>({username:row.username}));
 sessions.push({username:"CUSTOMER-01"},{username:"router-only-session"});
 return{customers,sessions};
}

test("subscriber summary matches unique active MikroTik sessions to current panel customers",async()=>{
 const{customers,sessions}=fixture();
 const controller=load({customers,sessions});
 const res=response();
 await controller.stats({query:{interface:"aggregate"}},res);
 assert.equal(res.statusCode,200);
 assert.deepEqual(
  {total:res.body.subscribers.total,online:res.body.subscribers.online,offline:res.body.subscribers.offline},
  {total:21,online:18,offline:3}
 );
 assert.ok(Math.abs(res.body.subscribers.availability-(18/21*100))<1e-9);
 assert.equal(res.body.subscribers.available,true);
});

test("an unrelated month-to-date query failure does not zero subscriber metrics",async()=>{
 const{customers,sessions}=fixture();
 const controller=load({customers,sessions,failMonthQuery:true});
 const res=response();
 await controller.stats({query:{interface:"aggregate"}},res);
 assert.equal(res.body.subscribers.total,21);
 assert.equal(res.body.subscribers.online,18);
 assert.equal(res.body.subscribers.availability,18/21*100);
});

test("unavailable live session source is marked unavailable rather than reported as zero online",async()=>{
 const{customers}=fixture();
 const controller=load({customers,sessions:[],failSessions:true});
 const res=response();
 await controller.stats({query:{interface:"aggregate"}},res);
 assert.equal(res.body.subscribers.available,false);
});

test("dashboard controller no longer queries retired OLT telemetry",async()=>{
 const{customers,sessions}=fixture();
 const controller=load({customers,sessions});
 const res=response();
 await controller.stats({query:{interface:"aggregate"}},res);
 assert.equal(res.statusCode,200);
});

test("stats reports router.online true from the prober cache",async()=>{
  const{customers,sessions}=fixture();
  const controller=load({customers,sessions});
  const res=response();
  await controller.stats({query:{interface:"aggregate"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.router.online,true);
  assert.equal(res.body.routerStatus.state,"online");
  assert.equal(res.body.router.model,"RB4011");
  assert.equal(res.body.subscribers.online,18);
  assert.equal(res.body.subscribers.available,true);
});

test("stats reports Checking (router.online null) before any probe succeeds",async()=>{
  const{customers,sessions}=fixture();
  const controller=load({customers,sessions,proberState:"checking"});
  const res=response();
  await controller.stats({query:{interface:"aggregate"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.router.online,null);
  assert.equal(res.body.routerStatus.state,"checking");
  assert.equal(res.body.subscribers.available,false);
});

test("stats reports Offline (router.online false) when the prober reports a failed probe",async()=>{
  const{customers,sessions}=fixture();
  const controller=load({customers,sessions,proberState:"offline"});
  const res=response();
  await controller.stats({query:{interface:"aggregate"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.router.online,false);
  assert.equal(res.body.routerStatus.state,"offline");
  assert.equal(res.body.subscribers.available,false);
});
