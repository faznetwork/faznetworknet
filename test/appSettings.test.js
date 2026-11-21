"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const service=require("../services/appSettings");
test("default branding and billing policy are conservative",()=>{
 assert.equal(service.DEFAULTS.company_name,"FAZ NETWORK");
 assert.equal(service.DEFAULTS.billing_cycle_type,"same_date_monthly");
 assert.equal(service.DEFAULTS.grace_period_days,"0");
 assert.equal(service.DEFAULTS.expiry_action,"quarantine");
 assert.match(service.DEFAULTS.footer_copyright,/{year}/);
});
test("outbound SMS remains disabled until explicitly configured",()=>{
 assert.equal(service.DEFAULTS.sms_gateway_mode,"disabled");
 assert.equal(service.DEFAULTS.sms_provider_mode,"disabled");
 assert.match(service.DEFAULTS.sms_template_expiry_warning,/{expiry_date}/);
 assert.match(service.DEFAULTS.sms_template_payment_receipt,/{trx_id}/);
 assert.match(service.DEFAULTS.sms_template_line_block,/{support_phone}/);
 assert.equal(service.DEFAULTS.sms_event_expiry_warning,"true");
 assert.equal(service.DEFAULTS.sms_event_payment_receipt,"true");
 assert.equal(service.DEFAULTS.sms_event_line_expiry,"true");
});
test("boolean parser accepts explicit true values only",()=>{
 assert.equal(service.bool(true),true);
 assert.equal(service.bool("true"),true);
 assert.equal(service.bool("1"),true);
 assert.equal(service.bool("false"),false);
});
