const express = require("express");
const controller = require("../controllers/networkMapController");
const router = express.Router();

router.get("/diagram", controller.getDiagram);
router.get("/customers/:id", controller.getCustomerMap);
router.get("/runs", controller.getLatestSummary);

module.exports = router;
