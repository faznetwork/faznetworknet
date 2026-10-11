const express=require("express");
const controller=require("../controllers/customerController");
const router=express.Router();

// Fail closed on destructive customer actions: a numeric route ID may refer to
// a different record in the customers and pppoe_users tables. Require the
// explicit PPPoE username sent by the admin UI before the controller is called.
function requireExactDeleteUsername(req,res,next){
  const username=String(req.body?.username||"").trim();
  if(!username)return res.status(400).json({
    success:false,
    code:"CUSTOMER_DELETE_USERNAME_REQUIRED",
    message:"Exact PPPoE username is required. No customer records were changed."
  });
  next();
}

router.get("/packages",controller.packages);
router.post("/sync-expiry-dates",controller.syncExpiryDatesToMikroTik);
router.post("/sync-panel-to-mikrotik",controller.syncPanelCustomersToMikroTik);
router.get("/diagnostics/counts",controller.getCustomerSyncDiagnostics);
router.get("/",controller.listCustomers);
router.post("/",controller.createCustomer);
router.post("/provision",controller.createCustomer);
router.post("/customers",controller.createCustomer);
router.get("/profile",controller.profile);
// REST-compatible Customer 360 endpoint: GET /api/customers/:id
router.get("/:id",controller.getCustomerProfileById);
router.get("/:id/audit-logs",controller.getAuditLogs);
router.get("/:id/live-session",controller.getCustomerLiveSession);
router.get("/:id/usage-records",controller.getCustomerUsageRecords);
router.get("/:id/profile",controller.getCustomerProfileById);
router.post("/:id/sync-mikrotik",controller.syncSingleCustomerToMikroTik);
router.put("/:id",controller.updateCustomer);
router.delete("/:id",requireExactDeleteUsername,controller.removeCustomer);
router.post("/:id/kick",controller.kickCustomerById);
router.post("/:id/toggle-status",controller.toggleCustomerStatus);
router.post("/:id/renew",controller.renewCustomerById);
router.put("/:id/change-package",controller.changeCustomerPackage);
router.get("/customers/:id",controller.getCustomer);
router.put("/customers/:id",controller.updateCustomer);
router.post("/update",(req,res)=>{req.params.id=String(req.body?.id||req.body?.username||"").trim();return controller.updateCustomer(req,res);});
router.post("/renew",controller.renew);
router.post("/mark-paid",controller.markPaid);
router.post("/delete",requireExactDeleteUsername,controller.removeCustomer);
router.post("/kick",async(req,res)=>{
  const username=String(req.body?.username||"").trim();
  if(!username)return res.status(400).json({success:false,message:"Username is required."});
  try{
    const result=await require("../services/mikrotikService").kickActiveUser(username);
    return res.json({success:true,message:result.kicked?"Active session disconnected. Client will re-dial.":"User is not currently online.",...result});
  }catch(error){return res.status(503).json({success:false,message:error.message||"Unable to disconnect active session."});}
});


module.exports=router;
