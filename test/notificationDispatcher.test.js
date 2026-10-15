"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {normalizePhone,eventKey}=require("../services/notificationDispatcher");
test("notification dispatcher normalizes Bangladeshi mobile numbers for channel gateways",()=>{
 assert.equal(normalizePhone("01712345678"),"8801712345678");
 assert.equal(normalizePhone("+8801712345678"),"8801712345678");
 assert.equal(normalizePhone("008801712345678"),"8801712345678");
});
test("notification dispatcher canonicalizes payment and expiry event names",()=>{
 assert.equal(eventKey("payment_receipt"),"payment");
 assert.equal(eventKey("line_expiry"),"expired");
 assert.equal(eventKey("recharge"),"recharge");
});
