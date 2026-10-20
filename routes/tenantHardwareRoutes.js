'use strict';

const express = require('express');
const controller = require('../controllers/tenantHardwareController');
const requireTenantAdmin = require('../middleware/requireTenantAdmin');
const { requireTenantModule } = require('../middleware/tenantAccess');
const router = express.Router();
router.use(requireTenantAdmin);

router.get('/', controller.list);
router.post('/routers', requireTenantModule('mikrotik'), controller.createRouter);
router.put('/routers/:id', requireTenantModule('mikrotik'), controller.updateRouter);
router.delete('/routers/:id', requireTenantModule('mikrotik'), controller.deleteRouter);
router.post('/olts', requireTenantModule('olt'), controller.createOlt);
router.delete('/olts/:id', requireTenantModule('olt'), controller.deleteOlt);

module.exports = router;
