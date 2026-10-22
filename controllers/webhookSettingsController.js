"use strict";
const settings=require("../services/webhookSettingsService");
function actor(req){return req.session?.adminUser||req.session?.username||"admin";}
function error(res,error,status=400){return res.status(status).set("Cache-Control","no-store").json({success:false,message:String(error?.message||"Webhook settings operation failed.")});}
async function get(req,res){try{const s=await settings.get();return res.set("Cache-Control","no-store").json({success:true,settings:s});}catch(e){return error(res,e,503);}}
async function save(req,res){try{const s=await settings.save(req.body||{},actor(req));return res.set("Cache-Control","no-store").json({success:true,message:"Webhook settings saved.",settings:s});}catch(e){return error(res,e,400);}}
async function regenerate(req,res){try{const secret=await settings.regenerate(actor(req));return res.set("Cache-Control","no-store").json({success:true,secret});}catch(e){return error(res,e,503);}}
module.exports={get,save,regenerate};
