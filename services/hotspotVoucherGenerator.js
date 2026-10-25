"use strict";
const crypto = require("crypto");

function randomPin(length = 8) {
  if (!Number.isSafeInteger(length) || length < 6 || length > 8) {
    throw new RangeError("Voucher PIN length must be between 6 and 8 digits.");
  }
  let pin = "";
  for (let i = 0; i < length; i++) pin += String(crypto.randomInt(0, 10));
  return pin;
}

async function generateVoucherBatch({
  client,
  profileName,
  validity,
  price,
  server = "all",
  quantity = 1,
  batchId = crypto.randomUUID(),
  transactionId = null,
  comment = "Scratch voucher; profile validity applies on first successful login."
}) {
  if (!client || typeof client.query !== "function") throw new TypeError("A transactional database client is required.");
  if (!String(profileName || "").trim()) throw new TypeError("A Hotspot profile is required.");
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 500) throw new RangeError("Voucher quantity must be between 1 and 500.");

  const vouchers = [];
  for (let i = 0; i < quantity; i++) {
    let inserted = null;
    for (let attempt = 0; attempt < 20 && !inserted; attempt++) {
      const pin = randomPin(8);
      const result = await client.query(
        "INSERT INTO hotspot_vouchers (username,password,profile,validity,price,status,comment,subscriber_type,activation_type,server,mac_lock,batch_id,transaction_id) VALUES ($1,$1,$2,$3,$4,'unused',$5,'scratch_voucher','first_login',$6,false,$7,$8::bigint) ON CONFLICT DO NOTHING RETURNING id,username,password,profile,validity,price,status,created_at,batch_id,transaction_id",
        [pin, String(profileName), String(validity || ""), Number(price), String(comment), String(server || "all"), batchId, transactionId]
      );
      inserted = result.rows?.[0] || null;
    }
    if (!inserted) throw new Error("Could not allocate a unique voucher PIN after 20 attempts.");
    vouchers.push(inserted);
  }
  return { batchId, vouchers };
}

module.exports = { generateVoucherBatch, randomPin };
