const express = require("express");
const routerController = require("../controllers/routerController");

const router = express.Router();

router.get("/test", routerController.test);
router.get("/resources", routerController.resources);
router.get("/interfaces", routerController.interfaces);
router.get("/traffic", routerController.traffic);
router.get("/vpn", routerController.vpn);
router.get("/port-forwarding", routerController.portForwarding);

module.exports = router;
