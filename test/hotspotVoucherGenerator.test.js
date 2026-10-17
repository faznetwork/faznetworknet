"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
function loadController() {
 const controllerPath=path.resolve(__dirname,"../controllers/hotspotController.js"),originalLoad=Module._load;
 const state={queries:[],creates:[],removes:[]};
 const db={async query(sql,params=[]){state.queries.push({sql,params});return {rows:[]};}};
 const mikrotik={async getHotspotProfiles(){return [{name:"Gold"}];},async getHotspotUsers(){return [];},async createHotspotUser(user){state.creates.push(user);},async removeHotspotUser(username){state.removes.push(username);}};
 delete require.cache[controllerPath];
 Module._load=function(request,parent,isMain){if(parent&&parent.filename===controllerPath&&request==="../db")return db;if(parent&&parent.filename===controllerPath&&request==="../services/mikrotikService")return mikrotik;return originalLoad.call(this,request,parent,isMain);};
 try{return {controller:require(controllerPath),state};}finally{Module._load=originalLoad;}
}
function responseRecorder(){return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
test("voucher generator refuses random credentials under MAC-based authentication",async()=>{
 const {controller,state}=loadController(),res=responseRecorder();
 await controller.generate({body:{quantity:2,profile:"Gold",validity:"1d",price:10}},res);
 assert.equal(res.statusCode,409);assert.equal(res.body.code,"MAC_REQUIRED");assert.equal(state.creates.length,0);assert.equal(state.queries.length,0);
});
test("voucher generator refuses invalid legacy requests without RouterOS or DB work",async()=>{
 const {controller,state}=loadController(),res=responseRecorder();
 await controller.generate({body:{quantity:501,profile:"Gold",validity:"1d",price:10}},res);
 assert.equal(res.statusCode,409);assert.equal(res.body.success,false);assert.equal(state.creates.length,0);assert.equal(state.removes.length,0);assert.equal(state.queries.length,0);
});
