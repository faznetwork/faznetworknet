"use strict";
const express=require("express");
const controller=require("../controllers/webhookSettingsController");
const router=express.Router();
router.get("/",controller.get);
router.put("/",controller.save);
router.post("/regenerate",controller.regenerate);
module.exports=router;
