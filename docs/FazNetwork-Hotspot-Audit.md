# FazNetwork Hotspot — সম্পূর্ণ কোড অডিট

**তারিখ:** ২৭ অক্টোবর ২০২৬  
**পরিধি:** Hotspot-এর সাবমেনু/UI, backend/API, MikroTik RouterOS, voucher lifecycle, captive portal এবং Hotspot payment flow।  
**পদ্ধতি:** সোর্স কোড read-only review। Live DB, RouterOS, PM2 log বা production traffic দেখা হয়নি; কোনো পরীক্ষা চালানো হয়নি; অডিটে কোড পরিবর্তন করা হয়নি।

## সারাংশ

Hotspot access ও sales দুই জায়গায় থাকে: PostgreSQL-এ voucher/customer/payment/expiry audit এবং RouterOS-এ profile, quota ও live session। Profile price/alias/validity/quota metadata `app_settings.hotspot_profile_metadata`-এ থাকে। Public MFS checkout সরাসরি provider API যাচাই করে না; SMS/webhook-এ আসা transaction-এর TrxID, amount, provider ও profile price মিলিয়ে voucher stage/activate করে।

সবচেয়ে বড় ঝুঁকি: data-only quota exhaustion cleanup job-এ শনাক্ত হয় না; পুরোনো `/portal` static package/price ব্যবহার করে; renew-এ RouterOS ও DB update atomic নয়; Manual Match DB-তে pending stage করে, RouterOS-এ সঙ্গে সঙ্গে recharge করে না।

## সাবমেনু ও ফাংশনালিটি

বর্তমান sidebar `views/admin.ejs:1915-1930`, dynamic subnav `:2982-2989`; route registry `routes/hotspotRoutes.js`।

| সাবমেনু | কাজ | মূল API/কোড |
|---|---|---|
| Dashboard | users/sessions, sales, expiry ও cleanup KPI; recent customers/recharges, drill-down | `/dashboard-metrics`; `hotspotController.dashboardMetrics :666-697`; dashboard overview `dashboardController.hotspotOverview` |
| Add Hotspot User | profile/package, customer/MAC ও optional custom expiry দিয়ে account তৈরি/bind | `/manual-bind`, `/users`; `hotspotController.createUser :293+` |
| All Users | DB subscribers + RouterOS live session; search/export/detail/edit/renew | `/users`; `hotspotUserController.list :52-148`; `public/js/hotspot-users-clean.js` |
| Active Users/Sessions | live RouterOS session, IP/MAC/uptime/traffic; kick/disconnect | `/active`, `/active/disconnect`, `/users/kick`; disconnect route আলাদা করে active remove করে |
| Profiles & Packages | RouterOS profiles ও DB price/validity/quota metadata; create/edit/delete/sync/script preview | `/profiles`, `/profiles/create|update|delete|sync`, `/profiles/script-preview`; `hotspotController`, `hotspotProfileConfig`, `hotspotProfileScriptSync` |
| Generate/Print | profile-ভিত্তিক ১–৫০০ scratch voucher batch, PIN/password/print | `/vouchers/generate`, `/vouchers/batches`; `hotspotVoucherGenerator.js` |
| Voucher & Recharge Ledger | unused/active/offline/expired/cleanup vouchers, batches/payment references | `/voucher-records`, `/vouchers`, `/vouchers/batches`; `hotspotController.voucherRecords :727-759` |
| Expired & Cleanup | expiry ও RouterOS purge pending/failed status দেখা | `voucher-records?status=cleanup`; `jobs/hotspotExpirationCleanup.js` |
| Sales History | date/category অনুযায়ী MFS/scratch/admin sales, amount/transaction/voucher count | `/voucher-sales`; `hotspotController.voucherSales :760-788` |

সম্পর্কিত কিন্তু sidebar-এর বাইরে: **Payments → Hotspot Payments** manual match/force provision (`routes/paymentRoutes.js`, `paymentController.js`); **General Settings → Hotspot Portal** branding, logo/banner/custom text, package visibility, MFS receivers ও portal feature toggles (`hotspotPortalSettingsController.js`, `public/js/hotspot-portal-settings.js`); **Hotspot Webhook Settings** SMS forwarding config। `public/js/admin.js`-এর পুরোনো menu-তে Online Users/Server Profiles আছে, কিন্তু বর্তমান sidebar/subnav এক নয় (`views/admin.ejs:8874-8876`)।

## সিস্টেম কীভাবে কাজ করে

### Profile ও package

`hotspotController.profiles` RouterOS profiles এবং `hotspot_profile_metadata` merge করে (`controllers/hotspotController.js:43`)। `services/hotspotProfileConfig.js` validity/quota normalize করে; startup-এ profile script sync হয়। Time-only package-এ expiry timestamp/comment, data-only-তে quota bytes ও null expiry, combo-তে উভয় থাকা উচিত।

### Voucher/captive login

Scratch voucher PostgreSQL-এ `unused` হিসেবে তৈরি হয়; intended validity first successful login-এ শুরু (`hotspotController.generate :252-291`, `hotspotVoucherGenerator.js`)। Admin-created account custom expiry validate করে Asia/Dhaka timezone-এ সংরক্ষণ করে (`hotspotController.createUser :293-359+`)। Public `claim-voucher` PIN/password ও MAC lock যাচাই করে; `activate` package resolve, DB first-login/expiry/status write এবং RouterOS user provision/recharge করে (`hotspotAuthController.js:115-217,219-271`)। Device lookup subscriber খুঁজে এবং expired হলে RouterOS cleanup trigger করতে পারে (`:76-113`)। Auth route CORS `*`; activate/claim rate-limited, তবে limiter process memory-তে (`:44-49,115,221`)।

### Online payment

1. Dynamic homepage enabled package/provider ও price দেখায় (`server.js:114-149`, `views/index.ejs`)। Customer MFS-এ টাকা পাঠিয়ে TrxID দেয়।
2. SMS/webhook transaction DB-তে আসে। `/api/verify-trx` transaction, amount/provider/profile-price যাচাই ও duplicate-claim lock করে (`paymentController.verifyTrx :596+`)।
3. `hotspot_vouchers` ও `hotspot_voucher_payments`-এ payment/package stage হয়; MAC জানা থাকলে RouterOS apply চেষ্টা হয়। Failure হলে activation pending/reconciliation state থাকতে পারে।
4. Captive auth activate/login চালায়। Routes/mount `routes/hotspotAuthRoutes.js`, `routes/paymentRoutes.js`, `server.js:159`। এটি SMS-forwarded transaction record যাচাই, direct MFS provider settlement API নয়।

### Admin renew, manual match ও force provision

- Manual Renew: বর্তমান tree-তে `/api/hotspot/manual-renew` ও `/users/:id/renew` দুটিই `hotspotController.manualRenew` (`routes/hotspotRoutes.js:8,14`)। Voucher lock/profile resolve/expiry stack/quota/comment; RouterOS recharge তারপর DB update (`hotspotController.js:799-829`)। `rechargeHotspotUser` user set + reset-counters করে, active remove করে না (`mikrotikService.js:1302-1325`)।
- Manual Match: unmatched transaction + phone + package price যাচাই করে PostgreSQL voucher/payment stage করে; handler নিজে RouterOS recharge করে না, response pending activation বলে (`paymentController.js:285-358`)।
- Force Provision: payment+MAC+package দিয়ে RouterOS set/add, এরপর DB finalize করে; reconciliation flow আছে (`paymentController.js:463-589`)।

### Expiry/cleanup

`jobs/hotspotExpirationCleanup.js` DB expiry, RouterOS comment/snapshot/counter দেখে due account চিহ্নিত করে; hard purge verified হলে DB MAC binding clear করে, ব্যর্থ হলে cleanup pending/failed রেখে retry করে (`:53-84,86+,156-267`)। Startup-এ job চালু (`server.js:180-185`)।

## Findings

### P1 — Data-only quota exhaustion DB-তে expire/cleanup হয় না

`routerUserExpired()` comment-এ `FAZ|PROFILE=` marker না পেলে quota compare-এর আগেই false ফেরায় (`jobs/hotspotExpirationCleanup.js:53-72`)। Data-only account-এর comment `FAZ|DATA_ONLY`; ফলে `limitBytesTotal` বনাম bytes counter check হয় না। RouterOS quota enforce করলেও PostgreSQL subscriber `active` থাকতে পারে; dashboard, cleanup ও eligibility stale হয়।

**সুপারিশ:** package type/data-only marker ধরে exhausted quota শনাক্ত, counter semantics যাচাই, idempotent DB expire ও cleanup যোগ।

### P1 — Manual renew-এ RouterOS/DB atomicity gap

Renew handler DB transaction/row lock-এর মধ্যে RouterOS mutation করে, পরে SQL update (`hotspotController.js:803-819`)। RouterOS সফল কিন্তু DB update/commit ব্যর্থ হলে RouterOS নতুন, DB পুরোনো থাকবে; এ path-এ `needs_reconciliation` audit দেখা যায় না।

**সুপারিশ:** operation ID/idempotency, staged state, RouterOS outcome journal, DB finalize failure-এ reconciliation record ও retry।

### P1 — `/portal` static package ও hard-coded API origin

`server.js` `/portal`-এ `views/portal.ejs` render করে। Package IDs/prices hard-coded (`views/portal.ejs:9-12`) এবং verify/activate URL `https://faznetwork-web.onrender.com` hard-coded (`:32,38`); homepage dynamic metadata ব্যবহার করে (`server.js:114-149`, `views/index.ejs`)। Profile alias/price/deployment hostname বদলালে wrong listing বা backend exact-price/profile mismatch হতে পারে।

**সুপারিশ:** দুই checkout এক করা; enabled profiles/price same source থেকে নেওয়া; same-origin API বা পুরোনো portal redirect/deprecate।

### P1/P2 — Manual Match-এ existing RouterOS account সঙ্গে সঙ্গে renew হয় না

`manualMatchHotspot` DB stage/finalize করে, RouterOS service call নেই (`paymentController.js:285-358`)। Active account payment assignment-এর পর নতুন profile/quota router-এ কখন apply হবে handler তা নির্ধারণ করে না।

**সুপারিশ:** MAC-bound account-এর জন্য queued/non-disruptive RouterOS sync; UI-তে staged বনাম router-applied state দেখানো।

### P2 — Force Provision success message ভুল

Service active session remove করে না এবং `clearedActiveSessions:0` ফেরায়; controller text তবু stale session/cookie clear হওয়ার কথা বলে (`paymentController.js:565-574`; `mikrotikService.js:1267+`)। Operator ভুল status বুঝতে পারেন।

**সুপারিশ:** actual RouterOS result অনুযায়ী message/status দেখানো।

### P2 — Device lookup public হলেও limiter নেই

`/api/hotspot-auth/device-lookup` open CORS; MAC/phone query ও expiry case-এ RouterOS cleanup trigger করতে পারে (`hotspotAuthRoutes.js`, `hotspotAuthController.js:76-112`)। Activate/claim limiter ব্যবহার করলেও lookup করে না। Limiter-গুলোও process-local memory (`:44-49`)।

**সুপারিশ:** lookup throttling/abuse monitoring এবং PM2 multi-process-এ shared rate limit store।

### P2 — RouterOS lookup failure-কে offline হিসেবে দেখানো হয়

`hotspotUserController.list` live session lookup ব্যর্থ হলে empty sessions নিয়ে DB users ফেরায় (`:54-60,82-87`); প্রকৃত offline ও RouterOS unavailable UI-তে আলাদা নয়।

**সুপারিশ:** `router_status=unavailable`/health flag এবং UI-তে unknown বনাম offline পৃথক করা।

### P2/P3 — Validity ও quota-এর একাধিক authority

Validity `session-timeout`, metadata, voucher `validity/time_limit`, DB `expires_at`, RouterOS comment—সব জায়গায় থাকে। Metadata validity পরীক্ষা endpoint-ভেদে truthy বনাম defined check (`hotspotController.js:43,811`; `paymentController.js:303,438,506,656`; `hotspotAuthController.js:51-64`)। Month normalization ৩০ দিনের RouterOS duration (`hotspotProfileConfig.js:19`)।

**সুপারিশ:** canonical typed package schema/helper; invalid metadata-তে silent fallback নয়; month=30 days/calendar month business rule নির্দিষ্ট করা।

### P3 — Time expiry metrics data quota lifecycle দেখায় না

Dashboard expiry KPI `expires_at`-নির্ভর (`hotspotController.js:673-675`); data-only null expiry time-expired count-এ আসবে না। আলাদা quota-exhausted state/report না থাকায় quota exhaustion রিপোর্টও অসম্পূর্ণ। Sales history transaction/payment archive-নির্ভর (`hotspotController.js:774-787`); usage snapshot history স্পষ্ট নয়।

**সুপারিশ:** time expiry ও quota depletion পৃথক status/metric; usage snapshot + timestamp রাখা।

## অগ্রাধিকারভিত্তিক সমাধান পরিকল্পনা

1. Data quota exhaustion detect/reconcile; RouterOS counter semantics safe test account-এ যাচাই।
2. `/portal` ও homepage checkout এক dynamic package source-এ আনা।
3. Manual match, online verify, force provision ও renew-এর shared stage→RouterOS apply→DB finalize/reconcile lifecycle।
4. Router timeout, DB finalize failure, duplicate TrxID ও notification failure-এ support-visible state/retry।
5. Public lookup/verify shared rate limit; RouterOS unavailable বনাম offline আলাদা।
6. Canonical validity/quota schema ও মাসের মেয়াদের নির্দিষ্ট semantics।
7. Regression cases: time/data/combo, first login, active renewal, manual match, repeated TrxID, router timeout, DB failure, expiry cleanup, multi-worker rate limiting।

## সীমাবদ্ধতা ও snapshot

লাইভ DB/RouterOS/PM2 logs, worker count, webhook settings বা deployed commit দেখা হয়নি। Audit শুরুতে working tree clean ছিল না: আগের কাজ থেকে `controllers/hotspotController.js`, `public/js/hotspot-users-clean.js`, `routes/hotspotRoutes.js`, `services/hotspotProfileConfig.js`, `services/mikrotikService.js`, `views/admin.ejs` modified ছিল। রিপোর্ট বর্তমান working-tree snapshot ধরে, clean HEAD নয়।

**প্রধান প্রমাণ ফাইল:** `views/admin.ejs`, `public/js/hotspot-users-clean.js`, `views/index.ejs`, `views/portal.ejs`, `routes/hotspotRoutes.js`, `routes/hotspotAuthRoutes.js`, `routes/paymentRoutes.js`, `controllers/hotspotController.js`, `controllers/hotspotUserController.js`, `controllers/hotspotAuthController.js`, `controllers/paymentController.js`, `controllers/hotspotPortalSettingsController.js`, `services/hotspotProfileConfig.js`, `services/mikrotikService.js`, `services/hotspotVoucherGenerator.js`, `jobs/hotspotExpirationCleanup.js`, `db/schema.sql`, `server.js`।
