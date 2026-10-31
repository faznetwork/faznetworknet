"use strict";
const crypto = require("crypto");
function randomPin(length = 8) {
  return crypto.randomBytes(Math.ceil(length * 1.5)).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, length).toUpperCase();
}
async function generateVoucherBatch({ client, profileName, validity, price, server = "all", quantity = 1, userPrefix = "", charLength = 6, passwordEqualsUsername = false, batchId = crypto.randomUUID(), transactionId = null, comment = "Scratch voucher; profile validity applies on first successful login.", subscriberType = "scratch_voucher", profileId = "", timeLimit = "", dataLimit = "" }) {
  if (!client || typeof client.query !== "function") throw new TypeError("A transactional database client is required.");
  if (!String(profileName || "").trim()) throw new TypeError("A Hotspot profile is required.");
  if (!["scratch_voucher", "reseller_voucher"].includes(String(subscriberType))) throw new TypeError("Unsupported Hotspot voucher subscriber type.");
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 500) throw new RangeError("Voucher quantity must be between 1 and 500.");
  if (!Number.isSafeInteger(charLength) || charLength < 4 || charLength > 16) throw new RangeError("Voucher PIN length must be between 4 and 16 characters.");
  const vouchers = [];
  for (let i = 0; i < quantity; i++) {
    let inserted = null;
    for (let attempt = 0; attempt < 8 && !inserted; attempt++) {
      const username = String(userPrefix || "").replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase() + randomPin(charLength);
      const password = passwordEqualsUsername ? username : randomPin(8);
      const result = await client.query(
        "INSERT INTO hotspot_vouchers (username,password,profile,validity,price,status,comment,subscriber_type,activation_type,server,mac_lock,batch_id,transaction_id,profile_id,time_limit,data_limit) VALUES ($1,$2,$3,$4,$5,'unused',$6,COALESCE(NULLIF($10::varchar,''),'scratch_voucher'),'first_login',$7,false,$8,$9::bigint,NULLIF($11::text,''),NULLIF($12::text,''),NULLIF($13::text,'')) ON CONFLICT DO NOTHING RETURNING id,username,password,profile,validity,price,status,created_at,batch_id,transaction_id,profile_id,time_limit,data_limit",
        [username,password,String(profileName),String(validity || ""),Number(price),String(comment),String(server || "all"),batchId,transactionId,String(subscriberType),String(profileId || ""),String(timeLimit || ""),String(dataLimit || "")]
      );
      inserted = result.rows?.[0] || null;
    }
    if (!inserted) throw new Error("Could not allocate a unique voucher PIN after eight attempts.");
    vouchers.push(inserted);
  }
  return { batchId, vouchers };
}
module.exports = { generateVoucherBatch, randomPin };
