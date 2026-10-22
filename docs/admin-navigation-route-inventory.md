# Admin Navigation & Route Inventory — Step 1

Generated from `views/admin.ejs` (branch `refactor/admin-canonical-router-step1`) and `server.js` on `main`. This is a source-level inventory, not a claim that each destination has been browser-tested.

## Sidebar/view target identifiers
- `view-hotspot-dashboard`
- `view-main-dashboard`

## Literal admin hrefs in EJS
- `/admin/account/dashboard`
- `/admin/account/manage`
- `/admin/customers/`
- `/admin/dashboard`
- `/admin/expenses/add`
- `/admin/expenses/all`
- `/admin/expenses/report`
- `/admin/hr/departments`
- `/admin/hr/employees`
- `/admin/hr/employees/added`
- `/admin/monitor/online`
- `/admin/monitor/usage`
- `/admin/network/diagram`
- `/admin/reports/collection`
- `/admin/reports/due`
- `/admin/reports/expenses`
- `/admin/reports/hotspot-revenue`
- `/admin/resellers/sub-staff`
- `/admin/settings/billing-expiry`
- `/admin/settings/brand-identity`
- `/admin/settings/hotspot-portal`
- `/admin/settings/payment-webhooks`
- `/admin/settings/sms-alerts`
- `/admin/support/software`
- `/admin/support/tickets`
- `/admin/support/website`
- `/admin/vpn`
- `/admin/vpn/port-forwarding`

## Express route and mount declarations in server.js
- `server.js:17` — `app.set("views",path.join(__dirname,"views"));app.set("view engine","ejs");app.use(cors());`
- `server.js:21` — `app.get("/healthz",(req,res)=>res.status(200).json({status:"ok",uptime:process.uptime(),timestamp:new Date().toISOString()}));`
- `server.js:25` — `app.use((req,res,next)=>{`
- `server.js:45` — `app.use(session({`
- `server.js:63` — `app.use(express.json({limit:"1mb"}));app.use(express.urlencoded({extended:true,limit:"1mb"}));app.use(express.text({type:"text/*"}));app.use(express.static(path.join(__dirname,"public")));`
- `server.js:64` — `app.get("/payment",(req,res)=>res.sendFile(path.join(__dirname,"public","payment.html")));`
- `server.js:66` — `app.use(async(req,res,next)=>{try{res.locals.brandSettings=await appSettingsService.getBrandSettings();}catch(_){res.locals.brandSettings=await appSettingsService.getBrandSettings().catch(()=>({company_name:"FAZ NETWORK",logo_url:"",favicon_url:"",support_phone:"01339932887",whatsapp_number:"",office_address:"FAZ NETWORK, Bangladesh",footer_copyright:"© {year} FAZ NETWORK. All Rights Reserved."}));}next();});`
- `server.js:67` — `app.get("/api/settings/public",settingsController.publicSettings);`
- `server.js:68` — `app.get("/health",(req,res)=>res.json({status:"ok",app:"FAZ NETWORK Server",database:db.getStatus(),timestamp:new Date()}));`
- `server.js:69` — `app.get("/api/health/database",(req,res)=>{const status=db.getStatus();res.status(status.connected?200:503).json({success:status.connected,database:status});});`
- `server.js:70` — `app.get("/api/dashboard/stats",requireAdmin,requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,dashboardController.stats);`
- `server.js:71` — `app.get("/api/dashboard/hotspot-overview",requireAdmin,requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,dashboardController.hotspotOverview);`
- `server.js:72` — `app.get("/api/olt/telemetry",requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,require("./controllers/oltTelemetryController").listTelemetry);`
- `server.js:73` — `app.get("/login",(req,res)=>{`
- `server.js:77` — `app.post("/login",rbacAuthController.login);`
- `server.js:78` — `app.get("/login/verify-otp",rbacAuthController.showOtp);`
- `server.js:79` — `app.post("/login/verify-otp",rbacAuthController.verifyOtp);`
- `server.js:80` — `app.get("/login/set-password",rbacAuthController.showSetPassword);`
- `server.js:81` — `app.post("/login/set-password",rbacAuthController.setFirstPassword);`
- `server.js:82` — `app.get("/invite/:token",rbacAuthController.showInvitation);`
- `server.js:83` — `app.post("/invite/:token/send-otp",rbacAuthController.sendInvitationOtp);`
- `server.js:84` — `app.post("/invite/:token/accept",rbacAuthController.acceptInvitation);`
- `server.js:85` — `app.post("/logout",(req,res)=>{`
- `server.js:93` — `app.get("/portal",async(req,res)=>{try{const keys=["mfs_bkash_number","mfs_nagad_number","mfs_rocket_number","mfs_upay_number"];const result=await db.query("SELECT key,value FROM app_settings WHERE key=ANY($1::varchar[])",[keys]);const values=Object.fromEntries((result.rows||[]).map(row=>[row.key,row.value]));return res.render("portal",{title:"FAZ NETWORK Hotspot Portal",paymentAccounts:{bkash:values.mfs_bkash_number||"",nagad:values.mfs_nagad_number||"",rocket:values.mfs_rocket_number||"",upay:values.mfs_upay_number||""}});}catch(error){console.warn("[Hotspot Portal] Payment account settings unavailable:",error.message);return res.render("portal",{title:"FAZ NETWORK Hotspot Portal",paymentAccounts:{bkash:"",nagad:"",rocket:"",upay:""}});}});`
- `server.js:95` — `app.get("/customer/dashboard",(req,res)=>{res.set("Cache-Control","no-store, no-cache, must-revalidate, private");res.set("Pragma","no-cache");res.set("Expires","0");return res.render("customer-dashboard",{title:"FAZ NETWORK Customer Self-Care"});});`
- `server.js:96` — `app.get("/admin",requireAdmin,(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));`
- `server.js:98` — `app.get("/admin/reports/collection",requireRole(["super_admin","admin"]),(req,res)=>res.render("reports",{title:"FAZ NETWORK Reports"}));`
- `server.js:99` — `app.get("/admin/reports/due",requireRole(["super_admin","admin"]),(req,res)=>res.render("reports",{title:"FAZ NETWORK Reports"}));`
- `server.js:100` — `app.get("/admin/reports/hotspot-revenue",requireRole(["super_admin","admin"]),(req,res)=>res.render("reports",{title:"FAZ NETWORK Reports"}));`
- `server.js:101` — `app.get("/admin/reports/expenses",requireRole(["super_admin","admin"]),(req,res)=>res.render("reports",{title:"FAZ NETWORK Reports"}));`
- `server.js:104` — `app.get(/^\/admin\/expenses\/(add|all|report)\/?$/,requireRole(["super_admin","admin"]),(req,res)=>res.render("reports",{title:"FAZ NETWORK Expense Sheet"}));`
- `server.js:105` — `app.get(/^\/admin\/hr\/.*/,requireRole(["super_admin","admin"]),(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));`
- `server.js:106` — `app.get(/^\/admin\/monitor\/(usage|online)\/?$/,requireRole(["super_admin","admin"]),(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));`
- `server.js:107` — `app.get(/^\/admin\/monitor\/(usage|online)\/?$/,requireRole(["super_admin","admin"]),(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));`
- `server.js:108` — `app.get(/^\/admin\/(staff|resellers\/sub-staff)\/?$/,requireRole(["super_admin","admin"]),(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));`
- `server.js:109` — `app.get(/^\/admin\/account\/(dashboard|manage)\/?$/,requireRole(["super_admin","admin"]),(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));`
- `server.js:110` — `app.get(/^\/admin\/vpn(?:\/port-forwarding)?\/?$/,requireRole(["super_admin"]),(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));`
- `server.js:112` — `app.get("/admin/settings",requireRole(["super_admin"]),(req,res)=>res.redirect(302,"/admin/settings/general"));`
- `server.js:113` — `app.get(/^\/admin\/settings\/(general|brand-identity|billing-expiry|payment-webhooks|sms-alerts|hotspot-portal)\/?$/,requireRole(["super_admin"]),renderAdminSettingsPage);`
- `server.js:114` — `app.get("/admin/settings/webhooks",requireRole(["super_admin"]),(req,res)=>res.redirect(302,"/admin/settings/payment-webhooks"));`
- `server.js:115` — `app.get(/^\/admin\/.*/,requireAdmin,(req,res,next)=>{`
- `server.js:122` — `app.get("/admin/customers/:id",requireAdmin,(req,res)=>res.render("customer-profile",{title:"Customer 360",customerId:String(req.params.id||"")}));`
- `server.js:123` — `app.get("/dashboard",requireAdmin,(req,res)=>res.redirect("/admin"));`
- `server.js:124` — `app.get("/hotspot/webhook",requireRole(["super_admin","admin"]),(req,res)=>res.redirect(302,"/admin#hotspot-webhook"));`
- `server.js:126` — `app.get("/",async (req,res)=>{`
- `server.js:174` — `app.get("/router",requireRole(["super_admin"]),(req,res)=>res.render("settings",{title:"Router Settings",page:"router",routerHost:String(process.env.ROUTER_HOST||""),routerPort:Number.parseInt(process.env.ROUTER_PORT||"8728",10)}));`
- `server.js:177` — `app.post("/api/olt/sync-telemetry",require("./controllers/oltTelemetryController").syncTelemetry);app.post("/api/pppoe/sync-sessions",require("./controllers/pppoeController").syncSessions);app.use("/api/admin/hotspot-portal-settings",requireAdmin,require("./routes/hotspotPortalSettingsRoutes"));app.get("/api/public/portal-config",require("./controllers/hotspotPortalSettingsController").publicPortalConfig);app.get("/api/hotspot/public-branding",require("./controllers/hotspotPortalSettingsController").publicBranding);app.get("/api/public/payment/settings",publicPaymentController.paymentSettings);app.post("/api/public/payment/check-bill",publicPaymentController.checkSubscriber);app.post("/api/public/payment/session",publicPaymentController.createPaymentSession);app.post("/api/public/payment/confirm",publicPaymentController.confirmPayment);app.post("/api/webhooks/forward",paymentController.dynamicWebhook);app.post("*",paymentController.dynamicWebhook);app.use("/api/notifications",requireRole(["super_admin","admin"]),require("./routes/notificationRoutes"));app.use("/api/admin/users",requireAdmin,adminUserRoutes);app.use("/api/admin/security",requireAdmin,adminSecurityRoutes);app.use("/api/hr",require("./routes/hrRoutes"));app.use("/api/router",requireRole(["super_admin"]),routerRoutes);app.post("/api/pppoe/check-subscriber",publicPaymentController.checkSubscriber);app.post("/api/pppoe/verify-renewal",publicPaymentController.verifyRenewal);app.use("/api/pppoe",requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,pppoeRoutes);app.use("/api/customer",customerSelfCareRoutes);app.use("/api/hotspot-auth",require("./routes/hotspotAuthRoutes"));app.use("/api/payments-admin",requireRole(["super_admin","admin"]),paymentRoutes);app.use("/api",paymentRoutes);app.use("/api/customers",requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,customerRoutes);app.use("/api/public",publicRoutes);app.use("/api/packages-admin",requireRole(["super_admin","admin"]),packageRoutes);app.use("/api/packages",requireRole(["super_admin","admin"]),packageRoutes);app.use("/api/ip-pools",requireRole(["super_admin","admin"]),ipPoolRoutes);app.use("/api/mikrotik",requireRole(["super_admin","admin"]),require("./routes/routerDeviceRoutes"));app.use("/api/devices",requireRole(["super_admin","admin"]),devicesRoutes);app.use("/api/network-map",requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,require("./routes/networkMapRoutes"));app.use("/api/settings",requireRole(["super_admin"]),settingsRoutes);app.use("/api/reports",requireRole(["super_admin","admin"]),reportRoutes);app.post("/api/admin/diagnostics/mikrotik-test",requireRole(["super_admin"]),require("./controllers/adminDiagnosticsController").mikrotikTest);app.post("/forward",paymentController.webhook);app.use("/api/hotspot",requireRole(["super_admin","admin"]),hotspotRoutes);`
- `server.js:178` — `app.get("/pppoe",requireRole(["super_admin","admin"]),(req,res)=>res.render("pppoe",{title:"PPPoE Management",page:"pppoe"}));app.get("/transactions",requireRole(["super_admin","admin"]),(req,res)=>res.render("transactions",{title:"Transactions",page:"transactions"}));app.get("/hotspot",requireRole(["super_admin","admin"]),(req,res)=>res.render("hotspot",{title:"Hotspot Vouchers",page:"hotspot"}));`
- `server.js:179` — `app.use((req,res)=>res.status(404).send("Not Found"));`

## Step 1 change
- Unknown `/admin/*` paths now resolve to an explicit in-panel 404 state instead of silently rendering the dashboard.
- Existing registered routes and view loaders are intentionally retained in this first increment to reduce regression risk.
- Step 2 will replace the legacy function wrappers and unify URL, active submenu, expanded parent, and title state.
- The route inventory must be compared against all submenu anchors and route handlers before deleting any legacy handler.


## Step 2 — URL-driven navigation state

- Added `syncRouteNavigationState()` and call it from `commitRoute()`.
- The canonical route URL now drives sidebar anchor active state and `aria-current="page"`.
- Existing collapsible/submenu ancestors of the active link are expanded using their current DOM structure; no duplicate controls or CSS overrides are introduced.
- The shared `#pageTitle` is synchronized from the active link label as an initial heading. Existing view loaders may set a more specific translated title while loading.
- Legacy view handlers and `wrapNavigation()` remain in place in this step. Removing them before every direct caller is mapped would risk breaking existing hotspot/customer/settings workflows; that removal is deferred until call sites and route coverage have explicit regression tests.

### Step 2 validation checklist

1. Open each canonical route directly and confirm its sidebar item becomes active.
2. Navigate between two different submenu items and confirm only one item has `aria-current="page"`.
3. Use browser Back/Forward and confirm active item, expanded parent, URL, and content stay aligned.
4. Check settings, Hotspot, Customers, Payments, OLT, and mobile sidebar behavior.
5. Run CI/build/tests; do not merge or deploy until checks are green and browser smoke tests are complete.
