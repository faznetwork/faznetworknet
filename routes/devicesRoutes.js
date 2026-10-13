const express = require("express");
const controller = require("../controllers/devicesController");
const router = express.Router();
router.get("/", controller.list);
router.post("/", controller.create);\nrouter.put("/:id", controller.update);
router.delete("/:id", controller.remove);
router.get("/mikrotik/discover", controller.discoverMikrotik);
router.post("/network-map/discover", controller.discoverNetworkMap);
module.exports = router;
