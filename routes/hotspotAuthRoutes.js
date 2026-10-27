"use strict";
const express=require("express");
const cors=require("cors");
const controller=require("../controllers/hotspotAuthController");
const router=express.Router();
const openCors=cors({origin:"*",methods:["POST","OPTIONS"],allowedHeaders:["Content-Type","Authorization"]});
const deviceLookupAttempts=new Map();
function limitDeviceLookup(req,res,next){
 const now=Date.now(),key=String(req.ip||req.socket?.remoteAddress||"unknown");
 let bucket=deviceLookupAttempts.get(key);
 if(!bucket||now-bucket.startedAt>=60000){bucket={startedAt:now,count:0};deviceLookupAttempts.set(key,bucket);}
 bucket.count++;
 if(deviceLookupAttempts.size>5000)for(const [ip,item] of deviceLookupAttempts)if(now-item.startedAt>=60000)deviceLookupAttempts.delete(ip);
 if(bucket.count>30)return res.status(429).set("Retry-After","60").json({success:false,code:"RATE_LIMITED",message:"Too many device lookups. Please try again shortly."});
 return next();
}
router.options("/device-lookup",openCors);
router.post("/device-lookup",openCors,limitDeviceLookup,controller.deviceLookup);
router.options("/activate",openCors);
router.options("/claim-voucher",openCors);
router.post("/claim-voucher",openCors,controller.claimVoucher);
router.post("/activate",openCors,controller.activate);
module.exports=router;
