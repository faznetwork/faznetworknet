"use strict";
const express=require("express");
const controller=require("../controllers/broadcastController");
const router=express.Router();
router.get("/audience-count",controller.audienceCount);
router.get("/broadcast/history",controller.history);
router.get("/broadcast/:id",controller.progress);
router.post("/broadcast",controller.create);
module.exports=router;
