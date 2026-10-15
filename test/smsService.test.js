"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {renderTemplate,eventTemplate,EVENT_CONFIG,parseMapping}=require("../services/smsService");
test("SMS template parser replaces all known dynamic variables",()=>{
 const rendered=renderTemplate("Dear {name}, Tk {amount} due {expiry_date}. Help: {support_phone}",{
  name:"Rahim",amount:550,expiry_date:"2026-11-01",support_phone:"01339932887"
 });
 assert.equal(rendered,"Dear Rahim, Tk 550 due 2026-11-01. Help: 01339932887");
});
test("SMS template parser preserves unknown placeholders and safely stringifies values",()=>{
 assert.equal(renderTemplate("{name} {unknown}",{name:"Customer"}),"Customer {unknown}");
 assert.equal(renderTemplate("{trx_id}",{trx_id:12345}),"12345");
});
test("event templates map to all three settings and support payment variables",()=>{
 const settings={
  sms_template_expiry_warning:"Expires {expiry_date}",
  sms_template_payment_receipt:"Tk {amount} received via {gateway}; {trx_id}; {new_expiry_date}",
  sms_template_line_block:"Hello {name} {support_phone}"
 };
 assert.equal(eventTemplate(settings,"expiry_warning",{expiry_date:"2026-11-01"}),"Expires 2026-11-01");
 assert.equal(eventTemplate(settings,"payment_receipt",{amount:200,gateway:"bKash",trx_id:"ABC123",new_expiry_date:"2026-12-01"}),"Tk 200 received via bKash; ABC123; 2026-12-01");
 assert.equal(eventTemplate(settings,"line_expiry",{name:"Rahim",support_phone:"01339932887"}),"Hello Rahim 01339932887");
 assert.deepEqual(Object.keys(EVENT_CONFIG).sort(),["expired","expiry_warning","line_expiry","payment","payment_receipt","recharge","renewal","welcome"]);
});

test("dynamic provider mapping accepts object or JSON and safely falls back",()=>{
 assert.deepEqual(parseMapping('{"receiver":"{to}","msg":"{message}"}'),{receiver:"{to}",msg:"{message}"});
 assert.deepEqual(parseMapping("not-json",{to:"{to}"}),{to:"{to}"});
});
