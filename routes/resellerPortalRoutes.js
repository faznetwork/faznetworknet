'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/resellerPortalController');
const hotspotController = require('../controllers/resellerHotspotController');
const { requireRole } = require('../middleware/rbac');
const { loadTenantScope } = require('../middleware/tenantScope');

// All reseller routes are authenticated and tenant-scoped before controller execution.
// Customer creation is limited to POPs owned by the authenticated reseller.
// Voucher batches have no edit, delete, cancel, void, disable, or mutation routes.
// requireRole verifies the active reseller record before tenant scope is loaded.
router.use(requireRole(['reseller']));
router.use(loadTenantScope);

router.get('/overview', controller.overview);
router.get('/customers', controller.listCustomers);
router.post('/customers', controller.createCustomer);
router.get('/customers/:id/live-session', controller.liveSession);
router.get('/customers/:id/payments', controller.paymentHistory);
router.get('/customers/:id', controller.getCustomer);

router.get('/hotspot/catalog', hotspotController.catalog);
router.post('/hotspot/voucher-batches', hotspotController.issueBatch);
router.get('/hotspot/voucher-batches', hotspotController.listBatches);
router.get('/hotspot/voucher-batches/:batchKey', hotspotController.getBatch);

// No reseller batch edit, delete, cancel, void, disable, or mutation routes are registered.
module.exports = router;
