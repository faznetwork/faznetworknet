process.env.TZ = 'Asia/Dhaka';
require("dotenv").config();
require("./services/liveLogger"); // Install recursion-safe in-memory console capture before application startup.
const deploymentInfoService = require("./services/deploymentInfo");
let deploymentInfo = null;
try {
  deploymentInfo = deploymentInfoService.readDeploymentInfo();
  if (!deploymentInfo) console.warn("[DEPLOY] deployment-info.json is missing; deployment banner will be omitted.");
} catch (error) {
  console.error("[DEPLOY] Could not read deployment-info.json; deployment banner will be omitted:", error.message);
}
if (!String(process.env.DATABASE_URL || "").trim()) {
  console.error("[Fatal Error] DATABASE_URL environment variable is missing!");
  process.exit(1);
}
const path=require("path");const http=require("http");const express=require("express");const cors=require("cors");const session=require("express-session");const pgSession=require("connect-pg-simple")(session);
const db=require("./db");const resellerPortalController=require("./controllers/resellerPortalController");const resellerPortalRoutes=require("./routes/resellerPortalRoutes");const routerRoutes=require("./routes/routerRoutes");const pppoeRoutes=require("./routes/pppoeRoutes");const paymentRoutes=require("./routes/paymentRoutes");const paymentController=require("./controllers/paymentController");const publicPaymentController=require("./controllers/publicPaymentController");const hotspotRoutes=require("./routes/hotspotRoutes");const customerRoutes=require("./routes/customerRoutes");const popRoutes=require("./routes/popRoutes");const resellerRoutes=require("./routes/resellerRoutes");const publicRoutes=require("./routes/publicRoutes");const customerSelfCareRoutes=require("./routes/customerSelfCareRoutes");const {initializeDatabase}=require("./db/init");const packageRoutes=require("./routes/packageRoutes");const {startBillingCron}=require("./jobs/billingCron");const {startUsageCollector}=require("./jobs/customerUsageCollector");const {startNetworkDiscovery}=require("./jobs/networkDiscovery");const {startHotspotExpirationCleanup,startHotspotRetentionCleanup}=require("./jobs/hotspotExpirationCleanup");const {syncHotspotProfileScripts}=require("./jobs/hotspotProfileScriptSync");const {startHotspotAutoHeal}=require("./jobs/hotspotAutoHeal");const ipPoolRoutes=require("./routes/ipPoolRoutes");const devicesRoutes=require("./routes/devicesRoutes");const settingsRoutes=require("./routes/settingsRoutes");const reportRoutes=require("./routes/reportRoutes");const {requireAdmin,isAdminAuthenticated,setSessionCookie,clearSessionCookie,adminCredentialsValid}=require("./middleware/adminAuth");
const {requireRole,requireStaffReadOnly}=require("./middleware/rbac");
const {loadResellerBillingAccount}=require("./middleware/resellerBillingAccount");
const {loadTenantScope,requireCustomerOwnership}=require("./middleware/tenantScope");
const dashboardController=require("./controllers/dashboardController");
const rbacAuthController=require("./controllers/rbacAuthController");
const resellerAuthController=require("./controllers/resellerAuthController");
const resellerHotspotController=require("./controllers/resellerHotspotController");const resellerFinanceRoutes=require("./routes/resellerFinanceRoutes");
const adminUserRoutes=require("./routes/adminUserRoutes");
const adminSecurityRoutes=require("./routes/adminSecurityRoutes");
const automationCallController=require("./controllers/automationCallController");
const automationCallRoutes=require("./routes/automationCallRoutes");
const androidGateway=require("./services/androidGateway");
const appSettingsService=require("./services/appSettings");
const settingsController=require("./controllers/settingsController");
const isProduction=String(process.env.NODE_ENV||"").toLowerCase()==="production";
// WhatsApp socket runs on ONE instance only: this PC. Render sets RENDER=true
// automatically, and it shares the same PostgreSQL auth state — a second
// socket there fights this one and WhatsApp unlinks the device. Explicit
// WHATSAPP_ENABLED=true forces it on; =false turns it off everywhere.
const WHATSAPP_AUTOSTART = process.env.WHATSAPP_ENABLED ? process.env.WHATSAPP_ENABLED === "true" : process.env.RENDER !== "true";
const configuredSessionSecret=String(process.env.ADMIN_SESSION_SECRET||process.env.SESSION_SECRET||"").trim();
if(isProduction&&!configuredSessionSecret)throw new Error("ADMIN_SESSION_SECRET or SESSION_SECRET is required in production.");
const sessionSecret=configuredSessionSecret||(isProduction?"":require("crypto").randomBytes(48).toString("hex"));
if(!sessionSecret)throw new Error("A session signing secret is required.");
const app=express();app.set("trust proxy",1);const PORT=Number(process.env.PORT)||3000;
app.set("views",path.join(__dirname,"views"));app.set("view engine","ejs");app.use(cors());

// Render liveness probe intentionally runs before session, PostgreSQL, branding, and other middleware.
// It only confirms that the Node.js process can answer HTTP requests; database health is checked separately.
app.get("/healthz",(req,res)=>res.status(200).json({status:"ok",uptime:process.uptime(),timestamp:new Date().toISOString()}));
const sessionMiddleware=session({
  store:new pgSession({
    pool:db.getPool(),
    tableName:"session",
    createTableIfMissing:true,
    pruneSessionInterval:60*15
  }),
  secret:sessionSecret,
  resave:false,
  saveUninitialized:false,
  rolling:true,
  cookie:{
    maxAge:30*24*60*60*1000,
    httpOnly:true,
    secure:isProduction,
    sameSite:"lax"
  }
});
app.use(sessionMiddleware);
app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true,limit:"1mb"}));app.use(express.text({type:"text/*"}));app.use(express.static(path.join(__dirname,"public")));
app.get("/payment",(req,res)=>res.sendFile(path.join(__dirname,"public","payment.html")));
// Branding is read from a short-lived in-memory cache, never queried per EJS template.
app.use(async(req,res,next)=>{try{res.locals.brandSettings=await appSettingsService.getBrandSettings();}catch(_){res.locals.brandSettings=await appSettingsService.getBrandSettings().catch(()=>({company_name:"FAZ NETWORK",logo_url:"",favicon_url:"",support_phone:"01339932887",whatsapp_number:"",office_address:"FAZ NETWORK, Bangladesh",footer_copyright:"© {year} FAZ NETWORK. All Rights Reserved."}));}next();});
app.get("/api/settings/public",settingsController.publicSettings);
app.get("/health",(req,res)=>res.json({status:"ok",app:"FAZ NETWORK Server",database:db.getStatus(),timestamp:new Date()}));
app.get("/api/health/database",(req,res)=>{const status=db.getStatus();res.status(status.connected?200:503).json({success:status.connected,database:status});});
app.get("/api/dashboard/stats",requireAdmin,requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,dashboardController.stats);
app.get("/api/dashboard/business-overview",requireAdmin,requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,dashboardController.businessOverview);
app.get("/api/dashboard/hotspot-overview",requireAdmin,requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,dashboardController.hotspotOverview);
app.get("/login",(req,res)=>{
  if(isAdminAuthenticated(req)) return res.redirect("/admin");
  return res.render("login",{next:String(req.query.next||"/admin"),error:null});
});
app.post("/login",rbacAuthController.login);
app.get("/reseller/accept-invite",resellerAuthController.showAcceptInvite);
app.get("/reseller/login",(req,res)=>res.set("Cache-Control","no-store").render("reseller-login",{title:"FAZ NETWORK Reseller Sign In",error:null}));
app.get("/reseller/dashboard",requireRole(["reseller"]),loadTenantScope,loadResellerBillingAccount,resellerPortalController.renderDashboard);
app.get("/reseller/vouchers/generate",requireRole(["reseller"]),loadTenantScope,loadResellerBillingAccount,(req,res)=>res.set("Cache-Control","no-store, no-cache, must-revalidate, private").render("reseller-vouchers",{title:"Generate Vouchers · Reseller Workspace",pageMode:"generate",resellerName:req.session.auth?.name||req.session.resellerName||"Reseller",activePath:req.path,currentPath:req.path}));
app.get("/reseller/vouchers/history",requireRole(["reseller"]),loadTenantScope,loadResellerBillingAccount,(req,res)=>res.set("Cache-Control","no-store, no-cache, must-revalidate, private").render("reseller-vouchers",{title:"Voucher History · Reseller Workspace",pageMode:"history",resellerName:req.session.auth?.name||req.session.resellerName||"Reseller",activePath:req.path,currentPath:req.path}));
app.get("/reseller/customers",requireRole(["reseller"]),loadTenantScope,loadResellerBillingAccount,(req,res)=>res.set("Cache-Control","no-store, no-cache, must-revalidate, private").render("reseller-customers",{title:"All Subscribers · Reseller Workspace",pageMode:"directory",resellerName:req.session.auth?.name||req.session.resellerName||"Reseller",activePath:req.path,currentPath:req.path}));
app.get("/reseller/customers/add",requireRole(["reseller"]),loadTenantScope,loadResellerBillingAccount,(req,res)=>res.set("Cache-Control","no-store, no-cache, must-revalidate, private").render("reseller-customers",{title:"Add New Customer · Reseller Workspace",pageMode:"add",resellerName:req.session.auth?.name||req.session.resellerName||"Reseller",activePath:req.path,currentPath:req.path}));
app.get("/reseller/payments",requireRole(["reseller"]),loadTenantScope,loadResellerBillingAccount,(req,res)=>res.set("Cache-Control","no-store, no-cache, must-revalidate, private").render("reseller-payments",{title:"Reports & Payments · Reseller Workspace",resellerName:req.session.auth?.name||req.session.resellerName||"Reseller",activePath:req.path,currentPath:req.path}));
app.get("/reseller/hotspot/voucher-batches/:batchKey/print",requireRole(["reseller"]),loadTenantScope,loadResellerBillingAccount,resellerHotspotController.printBatchPage);
app.get("/reseller/customers/:id",requireRole(["reseller"]),loadTenantScope,loadResellerBillingAccount,requireCustomerOwnership({notFoundStatus:403}),(req,res)=>res.set("Cache-Control","no-store, no-cache, must-revalidate, private").render("reseller-customer-profile",{title:"FAZ NETWORK Reseller Customer Profile",customerId:String(req.params.id||"")}));
app.get("/login/verify-otp",rbacAuthController.showOtp);
app.post("/login/verify-otp",rbacAuthController.verifyOtp);
app.get("/login/set-password",rbacAuthController.showSetPassword);
app.post("/login/set-password",rbacAuthController.setFirstPassword);
app.get("/invite/:token",rbacAuthController.showInvitation);
app.post("/invite/:token/accept",rbacAuthController.acceptInvitation);
app.post("/logout",async(req,res)=>{
  if(!req.session)return res.redirect("/");
  const staffUser={id:req.session.userId||null,username:req.session.adminUser||"unknown",role:req.session.role||(req.session.legacySuperAdmin?"super_admin":"staff")};
  if(staffUser.id&&["staff","admin","super_admin"].includes(String(staffUser.role).toLowerCase())){
    try{await rbacAuthController.sendSecurityNotification(staffUser,"logout",req);}
    catch(error){console.error("[RBAC logout alert] Email enqueue failed:",error.message);}
  }
  req.session.destroy(err=>{
    if(err)console.error("[Session Destroy Error]:",err);
    res.clearCookie("connect.sid",{path:"/"});
    return res.redirect("/");
  });
});
app.get("/portal",(_req,res)=>res.render("portal",{title:"FAZ NETWORK Hotspot Portal"}));

app.get("/customer/dashboard",(req,res)=>{res.set("Cache-Control","no-store, no-cache, must-revalidate, private");res.set("Pragma","no-cache");res.set("Expires","0");return res.render("customer-dashboard",{title:"FAZ NETWORK Customer Self-Care"});});
// Normalize the trailing-slash admin entry point before the SPA router reads window.location.pathname.
app.get("/admin/live-logs",requireAdmin,requireRole(["super_admin"]),(req,res)=>{res.set("Cache-Control","no-store, no-cache, must-revalidate, private");return res.render("live-logs",{title:"FAZ NETWORK Live Server Console",deploymentInfo});});
app.get("/admin/",requireAdmin,(req,res)=>res.redirect(302,"/admin/dashboard"));
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
app.get("/admin/settings/automation-call",requireRole(["super_admin"]),automationCallController.renderPage);
app.get(/^\/admin\/settings\/(general|brand-identity|billing-expiry|payment-webhooks|sms-alerts|hotspot-portal|webhooks)\/?$/,requireRole(["super_admin"]),renderAdminSettingsPage);
app.get(/^\/admin\/.*/,requireAdmin,(req,res,next)=>{
  const adminPath=String(req.path||"").replace(/\/+$/,"")||"/admin";
  const customerRoute=adminPath.match(/^\/admin\/customers\/([^/]+)$/);
  const customerSectionSlugs=new Set(["add","all","online","offline","active","expired","expiring-today-yesterday","expiring-next-7-days","new","due"]);
  if(customerRoute&&!customerSectionSlugs.has(decodeURIComponent(customerRoute[1]).toLowerCase())) return next();
  return res.render("admin",{title:"FAZ NETWORK Enterprise Admin",dbConnected:db.getStatus().connected,currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff"),currentAdminUser:req.session.adminUser||"admin",currentAdminId:req.session.userId||0});
});
app.get("/admin/customers/:id",requireAdmin,(req,res)=>res.render("customer-profile",{title:"Customer 360",customerId:String(req.params.id||""),currentRole:req.session.role||(req.session.legacySuperAdmin||!req.session.userId?"super_admin":"staff")}));
app.get("/dashboard",requireAdmin,(req,res)=>res.redirect("/admin"));
app.get("/hotspot/webhook",requireRole(["super_admin","admin"]),(req,res)=>res.redirect(302,"/admin#hotspot-webhook"));

app.get("/",async (req,res)=>{
  try{
    const officeAddress=String(process.env.OFFICE_ADDRESS||"FAZ NETWORK, Bangladesh");
    const helpline=String(process.env.HELPLINE_PHONE||"01339932887");
    const isExcludedPublicPlan=value=>/(expired|ex-|disabled|block|default|vpn)/i.test(String(value??""));
    let packages=[];
    try{
      const pkgResult=await db.query("SELECT id,plan_name,pool_name,profile_name,rate_limit,price,duration_months FROM packages WHERE price>0 ORDER BY price ASC");
      packages=(Array.isArray(pkgResult.rows)?pkgResult.rows:[]).filter(pkg=>{
        const name=String(pkg.plan_name||pkg.profile_name||"").trim();
        return name&&!isExcludedPublicPlan(name)&&Number(pkg.price)>0;
      });
    }catch(dbErr){
      console.warn("[Home Route] DB package query warning:",dbErr.message);
    }
    return res.render("index",{title:res.locals.brandSettings?.company_name||"FAZ NETWORK",officeAddress,helpline,packages,error:null,success:null});
  }catch(err){
    console.error("[CRITICAL] Error rendering public homepage:",err);
    return res.status(500).send("Service is initializing. Please refresh in a moment.");
  }
});

app.get("/router",requireRole(["super_admin"]),(req,res)=>res.render("settings",{title:"Router Settings",page:"router",routerHost:String(process.env.ROUTER_HOST||""),routerPort:Number.parseInt(process.env.ROUTER_PORT||"8728",10)}));
// Resolve the configured webhook path before other POST routes so an admin-selected
// custom endpoint remains usable even when its path overlaps an existing API path.
app.post("/api/pppoe/sync-sessions",require("./controllers/pppoeController").syncSessions);app.use("/api/admin/automation-call",requireAdmin,requireRole(["super_admin"]),automationCallRoutes);app.use("/api/admin/hotspot-portal-settings",requireAdmin,require("./routes/hotspotPortalSettingsRoutes"));app.get("/api/public/portal-config",require("./controllers/hotspotPortalSettingsController").publicPortalConfig);app.get("/api/hotspot/public-branding",require("./controllers/hotspotPortalSettingsController").publicBranding);app.get("/api/public/payment/settings",publicPaymentController.paymentSettings);app.post("/api/public/payment/check-bill",publicPaymentController.checkSubscriber);app.post("/api/public/payment/session",publicPaymentController.createPaymentSession);app.post("/api/public/payment/confirm",publicPaymentController.confirmPayment);app.use("/api/resellers",resellerRoutes);app.use("/api/reseller-portal",resellerPortalRoutes);app.post("*",paymentController.dynamicWebhook);app.use("/api/notifications",requireRole(["super_admin","admin"]),require("./routes/notificationRoutes"));app.use("/api/admin/live-logs",requireAdmin,requireRole(["super_admin"]),require("./routes/adminLiveLogsRoutes"));app.use("/api/admin/reseller-finance",requireAdmin,requireRole(["super_admin","admin"]),resellerFinanceRoutes);app.use("/api/admin/users",requireAdmin,adminUserRoutes);app.use("/api/admin/security",requireAdmin,adminSecurityRoutes);app.use("/api/hr",require("./routes/hrRoutes"));app.use("/api/router",requireRole(["super_admin"]),routerRoutes);app.post("/api/pppoe/check-subscriber",publicPaymentController.checkSubscriber);app.post("/api/pppoe/verify-renewal",publicPaymentController.verifyRenewal);app.use("/api/pppoe",requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,pppoeRoutes);app.use("/api/customer",customerSelfCareRoutes);app.use("/api/hotspot-auth",require("./routes/hotspotAuthRoutes"));app.use("/api/payments-admin",requireRole(["super_admin","admin"]),paymentRoutes);app.use("/api",paymentRoutes);app.use("/api/pops",popRoutes);app.use("/api/customers",requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,customerRoutes);app.use("/api/public",publicRoutes);app.use("/api/packages-admin",requireRole(["super_admin","admin"]),packageRoutes);app.use("/api/packages",requireRole(["super_admin","admin"]),packageRoutes);app.use("/api/ip-pools",requireRole(["super_admin","admin"]),ipPoolRoutes);app.use("/api/mikrotik",requireRole(["super_admin","admin"]),require("./routes/routerDeviceRoutes"));app.use("/api/devices",requireRole(["super_admin","admin"]),devicesRoutes);app.use("/api/network-map",requireRole(["super_admin","admin","staff"]),requireStaffReadOnly,require("./routes/networkMapRoutes"));app.use("/api/settings",requireRole(["super_admin"]),settingsRoutes);app.use("/api/settings/brand-assets",requireRole(["super_admin"]),require("./routes/brandAssetRoutes"));app.use("/api/admin/webhook-settings",requireRole(["super_admin"]),require("./routes/webhookSettingsRoutes"));app.use("/api/reports",requireRole(["super_admin","admin"]),reportRoutes);app.post("/api/admin/diagnostics/mikrotik-test",requireRole(["super_admin"]),require("./controllers/adminDiagnosticsController").mikrotikTest);app.post("/forward",paymentController.webhook);app.use("/api/hotspot",requireRole(["super_admin","admin"]),hotspotRoutes);
app.get("/pppoe",requireRole(["super_admin","admin"]),(req,res)=>res.render("pppoe",{title:"PPPoE Management",page:"pppoe"}));app.get("/transactions",requireRole(["super_admin","admin"]),(req,res)=>res.render("transactions",{title:"Transactions",page:"transactions"}));app.get("/hotspot",requireRole(["super_admin","admin"]),(req,res)=>res.render("hotspot",{title:"Hotspot Vouchers",page:"hotspot"}));
app.use((req,res)=>res.status(404).send("Not Found"));
const httpServer=http.createServer(app);
const { Server: SocketIOServer }=require("socket.io");
const io=new SocketIOServer(httpServer,{serveClient:true,transports:["websocket","polling"],maxHttpBufferSize:1e6});
androidGateway.attach(io,sessionMiddleware);
httpServer.listen(PORT,()=>{
  console.log("FAZ NETWORK Server running on port "+PORT);
  console.log("[Android Gateway] Socket.IO namespaces ready; device token "+(androidGateway.status().configured?"configured":"not configured"));
  if (deploymentInfo) {
    console.log("[DEPLOY] ========================================================");
    console.log("[DEPLOY] 🚀 DEPLOY LIVE: commit "+deploymentInfo.commitHash+" - \""+deploymentInfo.commitMessage+"\"");
    console.log("[DEPLOY] Deployed at: "+deploymentInfo.deployedAt+" (Asia/Dhaka)");
    console.log("[DEPLOY] Node/PM2 process restarted successfully");
    console.log("[DEPLOY] ========================================================");
  }
});
let shutdownStarted=false;
async function shutdown(signal){
  if(shutdownStarted)return;
  shutdownStarted=true;
  console.info("[Shutdown] Received "+signal+"; stopping background workers and HTTP server.");
  try{await require("./services/emailWorker").stopEmailWorker();}
  catch(error){console.error("[Shutdown] Email worker shutdown failed:",error.message);}
  io.close(async()=>{
    try{await db.getPool().end();}
    catch(dbError){console.error("[Shutdown] PostgreSQL pool shutdown failed:",dbError.message);}
    process.exitCode=0;
  });
  setTimeout(()=>{console.error("[Shutdown] Graceful shutdown timed out.");process.exit(1);},15000).unref();
}
process.on("SIGTERM",()=>{shutdown("SIGTERM").catch(error=>console.error("[Shutdown] Unexpected SIGTERM handler error:",error.message));});
process.on("SIGINT",()=>{shutdown("SIGINT").catch(error=>console.error("[Shutdown] Unexpected SIGINT handler error:",error.message));});
initializeDatabase().then(initResult=>{if(initResult?.skipped)console.warn("[EmailWorker] Not started because database schema initialization was skipped.");else require("./services/emailWorker").startEmailWorker();require("./controllers/broadcastController").resumePendingBroadcasts();startBillingCron();startUsageCollector();startNetworkDiscovery();require("./services/routerStatusProber").startRouterStatusProber();syncHotspotProfileScripts().catch(e=>console.warn("[HOTSPOT PROFILE SYNC] Startup sync failed; retry after the next deployment:",e.message));startHotspotAutoHeal();startHotspotExpirationCleanup();startHotspotRetentionCleanup();require("./jobs/hotspotRenewalReconciliation").start();require("./jobs/notificationHistoryCleanup").startNotificationHistoryCleanup();if(WHATSAPP_AUTOSTART)require("./services/whatsappService").restoreSession().catch(e=>console.warn("[WhatsApp] Startup restore skipped:",e.message));}).catch(e=>{
  console.error("[Database] Startup initialization failed:",e.message);
  startBillingCron();
  startUsageCollector();
  require("./services/routerStatusProber").startRouterStatusProber();
  startHotspotExpirationCleanup();
  startHotspotRetentionCleanup();
  // WhatsApp restore has its own bounded PostgreSQL retry policy and should
  // still be attempted after transient schema/database startup failures.
  // (Skipped on Render: only the PC owns the WhatsApp socket.)
  if(WHATSAPP_AUTOSTART)require("./services/whatsappService").restoreSession().catch(error=>console.warn("[WhatsApp] Startup restore skipped:",error.message));
});
module.exports=app;
