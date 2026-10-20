'use strict';

const express = require('express');
const requireTenantAdmin = require('../middleware/requireTenantAdmin');
const { requireTenantModule } = require('../middleware/tenantAccess');
const controller = require('../controllers/tenantProvisioningController');
const router = express.Router();

router.use(requireTenantAdmin);
router.post('/hotspot', requireTenantModule('hotspot'), controller.hotspot);
router.post('/pppoe', requireTenantModule('pppoe'), controller.pppoe);

module.exports = router;
