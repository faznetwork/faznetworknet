"use strict";
const history = require("../services/notificationDeliveryLog");

const CHANNELS = new Set(["all","whatsapp","sms","email","telegram","messenger"]);
const STATUSES = new Set(["all","pending","sent","delivered","failed","skipped"]);
function fail(res, error) {
  console.error("[Notification History] Request failed:", error.message);
  return res.status(503).set("Cache-Control","no-store").json({success:false,message:"Notification history is temporarily unavailable."});
}
async function list(req,res) {
  try {
    const query = req.query || {};
    const channel = String(query.channel || "all").toLowerCase();
    const status = String(query.status || "all").toLowerCase();
    const provider = String(query.provider || "all").slice(0,100);
    if (!CHANNELS.has(channel) || !STATUSES.has(status)) {
      return res.status(400).set("Cache-Control","no-store").json({success:false,message:"Invalid channel or status filter."});
    }
    const page = Math.max(1, Number.parseInt(query.page,10) || 1);
    const data = await history.list({channel,provider, status,search:String(query.search || ""),limit:100,offset:(page-1)*100});
    return res.set("Cache-Control","no-store").json({success:true,...data,page,pageSize:100});
  } catch(error) { return fail(res,error); }
}
module.exports = { list };
