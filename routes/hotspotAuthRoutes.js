"use strict";
const express=require("express");
const cors=require("cors");
const controller=require("../controllers/hotspotAuthController");
const router=express.Router();
const openCors=cors({origin:"*",methods:["POST","OPTIONS"],allowedHeaders:["Content-Type","Authorization"]});
router.options("/activate",openCors);
router.post("/activate",openCors,controller.activate);
module.exports=router;
