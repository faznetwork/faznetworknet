"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {normalizePhone,dedupeRecipients,renderBroadcastMessage,randomDelayMs,MIN_DELAY_MS,MAX_DELAY_MS}=require("../controllers/broadcastController");

test("broadcast phone normalization accepts only valid Bangladesh mobile numbers",()=>{
 assert.equal(normalizePhone("01712345678"),"8801712345678");
 assert.equal(normalizePhone("+8801712345678"),"8801712345678");
 assert.equal(normalizePhone("008801712345678"),"8801712345678");
 assert.equal(normalizePhone("01212345678"),"");
 assert.equal(normalizePhone("017123"),"");
});

test("broadcast audience recipients are normalized and deduplicated by international phone",()=>{
 const rows=dedupeRecipients([
  {phone:"01712345678",name:"Alice",username:"alice"},
  {phone:"+8801712345678",name:"Duplicate",username:"alice-2"},
  {phone:"01812345678",username:"bob"}
 ]);
 assert.equal(rows.length,2);
 assert.equal(rows[0].phone,"8801712345678");
 assert.equal(rows[0].name,"Alice");
 assert.equal(rows[1].phone,"8801812345678");
});

test("broadcast message supports customer and company variables",()=>{
 const text=renderBroadcastMessage("Hi {name}: {package} costs {amount}. Valid till {expiry_date}. {company_name}.",{name:"Alice",package:"30 Mbps",amount:525,expiry_date:"2026-11-16"},"FAZ NETWORK");
 assert.equal(text,"Hi Alice: 30 Mbps costs 525. Valid till 2026-11-16. FAZ NETWORK.");
});

test("broadcast pacing stays between 1.5 and 3 seconds",()=>{
 assert.equal(randomDelayMs(()=>0),MIN_DELAY_MS);
 assert.equal(randomDelayMs(()=>0.99999),MAX_DELAY_MS);
 for(let i=0;i<50;i++)assert.ok(randomDelayMs()>=1500&&randomDelayMs()<=3000);
});
