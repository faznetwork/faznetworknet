"use strict";
const express=require("express");
const controller=require("../controllers/notificationTemplateController");
const router=express.Router();
router.get("/notifications/templates",controller.list);
router.post("/notifications/templates",controller.save);
module.exports=router;
