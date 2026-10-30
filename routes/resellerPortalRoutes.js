'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/resellerPortalController');
const hotspotController = require('../controllers/resellerHotspotController');
const { requireRole } = require('../middleware/rbac');
const { loadTenantScope } = require('../middleware/tenantScope');

// All reseller routes are authenticated and tenant-scoped before controller execution.
// Voucher issuance is the only reseller write operation; issued batches have no mutation routes.
// requireRole verifies the active reseller record before tenant scope is loaded.
router.use(requireRole(['reseller']));
router.use(loadTenantScope);

router.get('/overview', controller.overview);
router.get('/customers', controller.listCustomers);
router.get('/customers/:id/live-session', controller.liveSession);
router.get('/customers/:id/payments', controller.paymentHistory);
router.get('/customers/:id', controller.getCustomer);

router.get('/hotspot/catalog', hotspotController.catalog);
router.post('/hotspot/voucher-batches', hotspotController.issueBatch);
router.get('/hotspot/voucher-batches', hotspotController.listBatches);
router.get('/hotspot/voucher-batches/:batchKey', hotspotController.getBatch);

// No reseller batch edit, delete, cancel, void, disable, or mutation routes are registered.
module.exports = router;
