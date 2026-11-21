"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const service=require("../services/renewalService");

test("uses the Dhaka calendar date at the UTC/Dhaka midnight boundary",()=>{
  const instant=new Date("2026-01-31T18:30:00.000Z");
  assert.equal(service.dhakaDate(instant),"2026-02-01");
  assert.equal(service.calculateSameDateExpiry(1,null,instant),"2026-03-01");
});

test("normalizes Date objects and ISO timestamps to the Dhaka calendar date",()=>{
  const instant=new Date("2026-01-31T18:30:00.000Z");
  assert.equal(service.normalizeDate(instant),"2026-02-01");
  assert.equal(service.normalizeDate("2026-01-31T18:30:00.000Z"),"2026-02-01");
  assert.equal(service.normalizeDate("2026-01-31"),"2026-01-31");
  assert.equal(service.calculateSameDateExpiry(1,service.normalizeDate("2026-01-31T18:30:00.000Z"),new Date("2026-01-01T00:00:00.000Z")),"2026-03-01");
});

test("same-date monthly expiry clamps the 29th, 30th and 31st to target month end",()=>{
  assert.equal(service.calculateSameDateExpiry(1,"2026-01-31",new Date("2026-01-01T00:00:00.000Z")),"2026-02-28");
  assert.equal(service.calculateSameDateExpiry(1,"2026-03-30",new Date("2026-01-01T00:00:00.000Z")),"2026-04-30");
  assert.equal(service.calculateSameDateExpiry(1,"2024-01-29",new Date("2024-01-01T00:00:00.000Z")),"2024-02-29");
});

test("same-date monthly renewal stacks from a future expiry and returns date-only output",()=>{
  const result=service.calculateSameDateExpiry(2,"2026-11-30",new Date("2026-10-25T00:00:00.000Z"));
  assert.equal(result,"2027-01-30");
  assert.match(result,/^\d{4}-\d{2}-\d{2}$/);
});

test("expiry always uses same-date monthly (21 Nov -> 21 Dec, 31 Jan -> 28 Feb, 1st -> 1st)",async()=>{
  // There is no billing-cycle setting anymore: the result depends only on
  // the base date, never on a legacy policy value.
  assert.equal(await service.calculateExpiry({durationMonths:1,currentExpiryDate:"2026-11-21",now:new Date("2026-11-21T00:00:00.000Z")}),"2026-12-21");
  assert.equal(await service.calculateExpiry({durationMonths:1,currentExpiryDate:"2026-01-31",now:new Date("2026-01-01T00:00:00.000Z")}),"2026-02-28");
  assert.equal(await service.calculateExpiry({durationMonths:1,currentExpiryDate:"2026-01-01",now:new Date("2026-01-01T00:00:00.000Z")}),"2026-02-01");
});

test("shared RouterOS renewal retains the existing mutation callback and session-kick contract",async()=>{
  const calls=[];
  const router={
    async updateSecret(username,options){calls.push(["update",username,options]);},
    async kickActiveUser(username){calls.push(["kick",username]);return {kicked:true};}
  };
  let mutationNotified=false;
  await service.applyRouterRenewal(router,"pppoe-user",{password:"p",profile:"HOME",comment:"EXP: 2026-11-30",onMutation(){mutationNotified=true;}});
  assert.equal(mutationNotified,true);
  assert.deepEqual(calls.map(item=>item[0]),["update","kick"]);
});
