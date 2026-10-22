process.env.TZ = 'Asia/Dhaka';
require("dotenv").config();
if (!String(process.env.DATABASE_URL || "").trim()) {
  console.error("[Fatal Error] DATABASE_URL environment variable is missing!");
  process.exit(1);
}
const path=require("path");const express=require("express");const cors=require("cors");const session=require("express-session");const pgSession=require("connect-pg-simple")(session);
const db=require("./db");const routerRoutes=require("./routes/routerRoutes");const pppoeRoutes=require("./routes/pppoeRoutes");const paymentRoutes=require("./routes/paymentRoutes");const paymentController=require("./controllers/paymentController");const publicPaymentController=require("./controllers/publicPaymentController");const hotspotRoutes=require("./routes/hotspotRoutes");const customerRoutes=require("./routes/customerRoutes");const publicRoutes=require("./routes/publicRoutes");const customerSelfCareRoutes=require("./routes/customerSelfCareRoutes");const {initializeDatabase}=require("./db/init");const packageRoutes=require("./routes/packageRoutes");const {startBillingCron}=require("./jobs/billingCron");const {startUsageCollector}=require("./jobs/customerUsageCollector");const {startNetworkDiscovery}=require("./jobs/networkDiscovery");const {startHotspotExpirationCleanup,startHotspotRetentionCleanup}=require("./jobs/hotspotExpirationCleanup");const {syncHotspotProfileScripts}=require("./jobs/hotspotProfileScriptSync");const ipPoolRoutes=require("./routes/ipPoolRoutes");const devicesRoutes=require("./routes/devicesRoutes");const settingsRoutes=require("./routes/settingsRoutes");const reportRoutes=require("./routes/reportRoutes");const {requireAdmin,isAdminAuthenticated,setSessionCookie,clearSessionCookie,adminCredentialsValid}=require("./middleware/adminAuth");
const {requireRole,requireStaffReadOnly}=require("./middleware/rbac");
const dashboardController=require("./controllers/dashboardController");
const rbacAuthController=require("./controllers/rbacAuthController");
const adminUserRoutes=require("./routes/adminUserRoutes");
const adminSecurityRoutes=require("./routes/adminSecurityRoutes");
const appSettingsService=require("./services/appSettings");
const settingsController=require("./controllers/settingsController");
const app=express();app.set("trust proxy",1);const PORT=Number(process.env.PORT)||3000;
app.set("views",path.join(__dirname,"views"));app.set("view engine","ejs");app.use(cors());

// Render liveness probe intentionally runs before session, PostgreSQL, branding, and other middleware.
// It only confirms that the Node.js process can answer HTTP requests; database health is checked separately.
app.get("/healthz",(req,res)=>res.status(200).json({status:"ok",uptime:process.uptime(),timestamp:new Date().toISOString()}));
app.use(session({
  store:new pgSession({
    pool:db.getPool(),
    tableName:"session",
    createTableIfMissing:true,
    pruneSessionInterval:60*15
  }),
  secret:String(process.env.ADMIN_SESSION_SECRET||process.env.SESSION_SECRET||"faz_network_super_secret_session_2026"),
  resave:false,
  saveUninitialized:false,
  rolling:true,
  cookie:{
    maxAge:30*24*60*60*1000,
    httpOnly:true,
    secure:false,
    sameSite:"lax"
  }
}));
app.use(express.json({limit:"1mb"}));app.use(express.urlencoded({extended:true,limit:"1mb"}));app.use(express.text({type:"text/*"}));app.use(express.static(path.join(__dirname,"public")));
app.get("/payment",(req,res)=>res.sendFile(path.join(__dirname,"public","payment.html")));
// Branding is read from a short-lived in-memory cache, never queried per EJS template.
app.use(async(req,res,next)=>{try{res.locals.brandSettings=await appSettingsService.getBrandSettings();}catch(_){res.locals.brandSettings=await appSettingsService.getBrandSettings().catch(()=>({company_name:"FAZ NETWORK",logo_url:"",favicon_url:"",support_phone:"01339932887",whatsapp_number:"",office_address:"FAZ NETWORK, Bangladesh",footer_copyright:"© {year} FAZ NETWORK. All Rights Reserved."}));}next();});
app.get("/api/settings/public",settingsController.publicSettings);
app.get("/health",(req,res)=>res.json({status:"ok",app:"FAZ NETWORK Server",database:db.getStatus(),timestamp:new Date()}));
app.get("/api/health/database",(req,res)=>{const status=db.getStatus();res.status(status.connected?200:503).json({success:status.connected,database:status});});
app.get("/api/dashboard/stats",requireAdmin,requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,dashboardController.stats);
app.get("/api/dashboard/hotspot-overview",requireAdmin,requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,dashboardController.hotspotOverview);
app.get("/api/olt/telemetry",requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,require("./controllers/oltTelemetryController").listTelemetry);
app.get("/login",(req,res)=>{
  if(isAdminAuthenticated(req)) return res.redirect("/admin");
  return res.render("login",{next:String(req.query.next||"/admin"),error:null});
});
app.post("/login",rbacAuthController.login);
app.get("/login/verify-otp",rbacAuthController.showOtp);
app.post("/login/verify-otp",rbacAuthController.verifyOtp);
app.get("/login/set-password",rbacAuthController.showSetPassword);
app.post("/login/set-password",rbacAuthController.setFirstPassword);
app.get("/invite/:token",rbacAuthController.showInvitation);
app.post("/invite/:token/send-otp",rbacAuthController.sendInvitationOtp);
app.post("/invite/:token/accept",rbacAuthController.acceptInvitation);
app.post("/logout",(req,res)=>{
  if(!req.session)return res.redirect("/");
  req.session.destroy(err=>{
    if(err)console.error("[Session Destroy Error]:",err);
    res.clearCookie("connect.sid",{path:"/"});
    return res.redirect("/");
  });
});
app.get("/portal",async(req,res)=>{try{const keys=["mfs_bkash_number","mfs_nagad_number","mfs_rocket_number","mfs_upay_number"];const result=await db.query("SELECT key,value FROM app_settings WHERE key=ANY($1::varchar[])",[keys]);const values=Object.fromEntries((result.rows||[]).map(row=>[row.key,row.value]));return res.render("portal",{title:"FAZ NETWORK Hotspot Portal",paymentAccounts:{bkash:values.mfs_bkash_number||"",nagad:values.mfs_nagad_number||"",rocket:values.mfs_rocket_number||"",upay:values.mfs_upay_number||""}});}catch(error){console.warn("[Hotspot Portal] Payment account settings unavailable:",error.message);return res.render("portal",{title:"FAZ NETWORK Hotspot Portal",paymentAccounts:{bkash:"",nagad:"",rocket:"",upay:""}});}});

app.get("/customer/dashboard",(req,res)=>{res.set("Cache-Control","no-store, no-cache, must-revalidate, private");res.set("Pragma","no-cache");res.set("Expires","0");return res.render("customer-dashboard",{title:"FAZ NETWORK Customer Self-Care"});});
app.get("/admin",requireAdmin,(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));

app.get("/admin/reports/collection",requireRole(["super_admin","admin"]),(req,res)=>res.render("reports",{title:"FAZ NETWORK Reports"}));
app.get("/admin/reports/due",requireRole(["super_admin","admin"]),(req,res)=>res.render("reports",{title:"FAZ NETWORK Reports"}));
app.get("/admin/reports/hotspot-revenue",requireRole(["super_admin","admin"]),(req,res)=>res.render("reports",{title:"FAZ NETWORK Reports"}));
app.get("/admin/reports/expenses",requireRole(["super_admin","admin"]),(req,res)=>res.render("reports",{title:"FAZ NETWORK Reports"}));
 // The Expenses submenu reuses the existing authenticated expense CRUD/reporting UI.
 // /add opens the form, /all shows the expense ledger, and /report shows totals.
 app.get(/^\/admin\/expenses\/(add|all|report)\/?$/,requireRole(["super_admin","admin"]),(req,res)=>res.render("reports",{title:"FAZ NETWORK Expense Sheet"}));
app.get(/^\/admin\/hr\/.*/,requireRole(["super_admin","admin"]),(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));
app.get(/^\/admin\/monitor\/(usage|online)\/?$/,requireRole(["super_admin","admin"]),(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));
app.get(/^\/admin\/monitor\/(usage|online)\/?$/,requireRole(["super_admin","admin"]),(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));
app.get(/^\/admin\/(staff|resellers\/sub-staff)\/?$/,requireRole(["super_admin","admin"]),(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));
app.get(/^\/admin\/account\/(dashboard|manage)\/?$/,requireRole(["super_admin","admin"]),(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));
app.get(/^\/admin\/vpn(?:\/port-forwarding)?\/?$/,requireRole(["super_admin"]),(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0}));
const renderAdminSettingsPage=(req,res)=>res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0});
app.get("/admin/settings",requireRole(["super_admin"]),(req,res)=>res.redirect(302,"/admin/settings/general"));
app.get(/^\/admin\/settings\/(general|brand-identity|billing-expiry|payment-webhooks|sms-alerts|hotspot-portal|webhooks)\/?$/,requireRole(["super_admin"]),renderAdminSettingsPage);
app.get(/^\/admin\/.*/,requireAdmin,(req,res,next)=>{
  const adminPath=String(req.path||"").replace(/\/+$/,"")||"/admin";
  const customerRoute=adminPath.match(/^\/admin\/customers\/([^/]+)$/);
  const customerSectionSlugs=new Set(["add","all","online","offline","active","expired","expiring-today-yesterday","expiring-next-7-days","new","due"]);
  if(customerRoute&&!customerSectionSlugs.has(decodeURIComponent(customerRoute[1]).toLowerCase())) return next();
  return res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0});
});
app.get("/admin/customers/:id",requireAdmin,(req,res)=>res.render("customer-profile",{title:"Customer 360",customerId:String(req.params.id||"")}));
app.get("/dashboard",requireAdmin,(req,res)=>res.redirect("/admin"));
app.get("/hotspot/webhook",requireRole(["super_admin","admin"]),(req,res)=>res.redirect(302,"/admin#hotspot-webhook"));

app.get("/",async (req,res)=>{
  try{
    const officeAddress=String(process.env.OFFICE_ADDRESS||"FAZ NETWORK, Bangladesh");
    const helpline=String(process.env.HELPLINE_PHONE||"01339932887");
    const isExcludedPublicPlan=value=>/(expired|ex-|disabled|block|default|vpn)/i.test(String(value??""));
    let packages=[];
    let hotspotPackages=[];
    try{
      const pkgResult=await db.query("SELECT id,plan_name,pool_name,profile_name,rate_limit,price,duration_months FROM packages WHERE price>0 ORDER BY price ASC");
      packages=(Array.isArray(pkgResult.rows)?pkgResult.rows:[]).filter(pkg=>{
        const name=String(pkg.plan_name||pkg.profile_name||"").trim();
        return name&&!isExcludedPublicPlan(name)&&Number(pkg.price)>0;
      });
    }catch(dbErr){
      console.warn("[Home Route] DB package query warning:",dbErr.message);
    }
    // Public page rendering must never open a RouterOS socket. Read the last
    // saved hotspot price/validity metadata from PostgreSQL; live router sync is
    // reserved for explicit admin actions and background jobs.
    try{
      const metadataRows=await db.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1");
      let metadata={};
      try{metadata=JSON.parse(metadataRows.rows[0]?.value||"{}");}catch(_){metadata={};}
      hotspotPackages=Object.entries(metadata&&typeof metadata==="object"?metadata:{})
        .map(([name,meta])=>({
          ...(meta&&typeof meta==="object"?meta:{}),
          name:String(name||"").trim(),
          price:Number(meta?.price||0),
          validityLabel:String(meta?.validityLabel||meta?.validity||""),
          limitBytesTotal:Number(meta?.limitBytesTotal||0)
        }))
        .filter(profile=>profile.name&&!isExcludedPublicPlan(profile.name)&&Number(profile.price)>0);
    }catch(hotspotErr){
      console.warn("[Home Route] Saved hotspot metadata unavailable:",hotspotErr.message);
    }
    let paymentAccounts={bkash:"",nagad:"",rocket:"",upay:""};
    try{
      const accountRows=await db.query("SELECT key,value FROM app_settings WHERE key=ANY($1::varchar[])",[["mfs_bkash_number","mfs_nagad_number","mfs_rocket_number","mfs_upay_number"]]);
      const accountValues=Object.fromEntries((accountRows.rows||[]).map(row=>[row.key,String(row.value||"").trim()]));
      paymentAccounts={bkash:accountValues.mfs_bkash_number||"",nagad:accountValues.mfs_nagad_number||"",rocket:accountValues.mfs_rocket_number||"",upay:accountValues.mfs_upay_number||""};
    }catch(paymentSettingsError){console.warn("[Home Route] MFS payment accounts unavailable:",paymentSettingsError.message);}
    return res.render("index",{title:res.locals.brandSettings?.company_name||"FAZ NETWORK",officeAddress,helpline,packages,hotspotPackages,paymentAccounts,error:null,success:null});
  }catch(err){
    console.error("[CRITICAL] Error rendering public homepage:",err);
    return res.status(500).send("Service is initializing. Please refresh in a moment.");
  }
});

app.get("/router",requireRole(["super_admin"]),(req,res)=>res.render("settings",{title:"Router Settings",page:"router",routerHost:String(process.env.ROUTER_HOST||""),routerPort:Number.parseInt(process.env.ROUTER_PORT||"8728",10)}));
// Resolve the configured webhook path before other POST routes so an admin-selected
// custom endpoint remains usable even when its path overlaps an existing API path.
app.post("/api/olt/sync-telemetry",require("./controllers/oltTelemetryController").syncTelemetry);app.post("/api/pppoe/sync-sessions",require("./controllers/pppoeController").syncSessions);app.use("/api/admin/hotspot-portal-settings",requireAdmin,require("./routes/hotspotPortalSettingsRoutes"));app.get("/api/public/portal-config",require("./controllers/hotspotPortalSettingsController").publicPortalConfig);app.get("/api/hotspot/public-branding",require("./controllers/hotspotPortalSettingsController").publicBranding);app.get("/api/public/payment/settings",publicPaymentController.paymentSettings);app.post("/api/public/payment/check-bill",publicPaymentController.checkSubscriber);app.post("/api/public/payment/session",publicPaymentController.createPaymentSession);app.post("/api/public/payment/confirm",publicPaymentController.confirmPayment);app.post("*",paymentController.dynamicWebhook);app.use("/api/notifications",requireRole(["super_admin","admin"]),require("./routes/notificationRoutes"));app.use("/api/admin/users",requireAdmin,adminUserRoutes);app.use("/api/admin/security",requireAdmin,adminSecurityRoutes);app.use("/api/hr",require("./routes/hrRoutes"));app.use("/api/router",requireRole(["super_admin"]),routerRoutes);app.post("/api/pppoe/check-subscriber",publicPaymentController.checkSubscriber);app.post("/api/pppoe/verify-renewal",publicPaymentController.verifyRenewal);app.use("/api/pppoe",requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,pppoeRoutes);app.use("/api/customer",customerSelfCareRoutes);app.use("/api/hotspot-auth",require("./routes/hotspotAuthRoutes"));app.use("/api/payments-admin",requireRole(["super_admin","admin"]),paymentRoutes);app.use("/api",paymentRoutes);app.use("/api/customers",requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,customerRoutes);app.use("/api/public",publicRoutes);app.use("/api/packages-admin",requireRole(["super_admin","admin"]),packageRoutes);app.use("/api/packages",requireRole(["super_admin","admin"]),packageRoutes);app.use("/api/ip-pools",requireRole(["super_admin","admin"]),ipPoolRoutes);app.use("/api/mikrotik",requireRole(["super_admin","admin"]),require("./routes/routerDeviceRoutes"));app.use("/api/devices",requireRole(["super_admin","admin"]),devicesRoutes);app.use("/api/network-map",requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,require("./routes/networkMapRoutes"));app.use("/api/settings",requireRole(["super_admin"]),settingsRoutes);app.use("/api/admin/webhook-settings",requireRole(["super_admin"]),require("./routes/webhookSettingsRoutes"));app.use("/api/reports",requireRole(["super_admin","admin"]),reportRoutes);app.post("/api/admin/diagnostics/mikrotik-test",requireRole(["super_admin"]),require("./controllers/adminDiagnosticsController").mikrotikTest);app.post("/forward",paymentController.webhook);app.use("/api/hotspot",requireRole(["super_admin","admin"]),hotspotRoutes);
app.get("/pppoe",requireRole(["super_admin","admin"]),(req,res)=>res.render("pppoe",{title:"PPPoE Management",page:"pppoe"}));app.get("/transactions",requireRole(["super_admin","admin"]),(req,res)=>res.render("transactions",{title:"Transactions",page:"transactions"}));app.get("/hotspot",requireRole(["super_admin","admin"]),(req,res)=>res.render("hotspot",{title:"Hotspot Vouchers",page:"hotspot"}));
app.use((req,res)=>res.status(404).send("Not Found"));
app.listen(PORT,()=>console.log("FAZ NETWORK Server running on port "+PORT));
initializeDatabase().then(()=>{require("./controllers/broadcastController").resumePendingBroadcasts();startBillingCron();startUsageCollector();startNetworkDiscovery();syncHotspotProfileScripts().catch(e=>console.warn("[HOTSPOT PROFILE SYNC] Startup sync failed; retry after the next deployment:",e.message));startHotspotExpirationCleanup();startHotspotRetentionCleanup();require("./services/whatsappService").restoreSession().catch(e=>console.warn("[WhatsApp] Startup restore skipped:",e.message));}).catch(e=>{
  console.error("[Database] Startup initialization failed:",e.message);
  startBillingCron();
  startUsageCollector();
  startHotspotExpirationCleanup();
  startHotspotRetentionCleanup();
  // WhatsApp restore has its own bounded PostgreSQL retry policy and should
  // still be attempted after transient schema/database startup failures.
  require("./services/whatsappService").restoreSession().catch(error=>console.warn("[WhatsApp] Startup restore skipped:",error.message));
});
module.exports=app;