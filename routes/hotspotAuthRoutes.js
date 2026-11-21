"use strict";
const express=require("express");
const cors=require("cors");
const controller=require("../controllers/hotspotAuthController");
const rateLimit=require("../services/hotspotAuthRateLimit");
const router=express.Router();
const openCors=cors({origin:"*",methods:["POST","OPTIONS"],allowedHeaders:["Content-Type","Authorization"]});
// M14/H6: device lookup is a pure read (no router/DB writes) and is
// limited per-IP (30/min, as before) + per-phone (10/min) on the shared
// limiter, so a spoofed X-Forwarded-For cannot open a fresh bucket for
// the same phone.
function limitDeviceLookup(req,res,next){
  const ipLimit=rateLimit.checkLimit({keys:["ip:"+(req.ip||req.socket?.remoteAddress||"unknown")],limit:30,windowMs:60000});
  if(!ipLimit.allowed)return res.status(429).set("Retry-After","60").json({success:false,code:"RATE_LIMITED",message:"Too many device lookups. Please try again shortly."});
  const phone=String(req.body?.phone||req.body?.account_phone||req.query?.phone||"").replace(/\D/g,"");
  if(phone){
    const phoneLimit=rateLimit.checkLimit({keys:["phone:"+phone],limit:10,windowMs:60000});
    if(!phoneLimit.allowed)return res.status(429).set("Retry-After","60").json({success:false,code:"RATE_LIMITED",message:"Too many device lookups for this phone number. Please try again shortly."});
  }
  return next();
}
router.options("/device-lookup",openCors);
router.post("/device-lookup",openCors,limitDeviceLookup,controller.deviceLookup);
router.options("/activate",openCors);
router.options("/claim-voucher",openCors);
router.post("/claim-voucher",openCors,controller.claimVoucher);
router.post("/activate",openCors,controller.activate);
router.options("/request-claim-otp",openCors);
router.post("/request-claim-otp",openCors,controller.requestClaimOtp);
module.exports=router;
