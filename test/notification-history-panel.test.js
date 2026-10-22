"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const admin=fs.readFileSync(path.join(__dirname,"..","views","admin.ejs"),"utf8");
test("notification history is a sibling of the broadcast panel, not hidden inside it",()=>{
 const broadcastStart=admin.indexOf('<section data-notify-panel="broadcast"');
 const historyStart=admin.indexOf('<section data-notify-panel="history" id="notificationHistoryPanel"');
 assert.ok(broadcastStart>=0&&historyStart>broadcastStart);
 const close=admin.lastIndexOf("</section>",historyStart);
 assert.ok(close>broadcastStart,"broadcast panel must close before notification history begins");
 const between=admin.slice(close,historyStart);
 assert.match(between,/<\/section>\s*$/,"history must not be nested in the broadcast section");
 assert.match(admin,/<script src="\/js\/notification-history\.js[^"]*" defer><\/script>/);
});
