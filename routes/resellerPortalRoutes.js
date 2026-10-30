'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/resellerPortalController');
const { requireRole } = require('../middleware/rbac');
const { loadTenantScope } = require('../middleware/tenantScope');

// Every endpoint in this router is a read-only reseller operation.
// requireRole verifies the active reseller record before tenant scope is loaded.
router.use(requireRole(['reseller']));
router.use(loadTenantScope);

router.get('/overview', controller.overview);
router.get('/customers', controller.listCustomers);
router.get('/customers/:id/live-session', controller.liveSession);
router.get('/customers/:id/payments', controller.paymentHistory);
router.get('/customers/:id', controller.getCustomer);

// No mutation handlers are intentionally registered on the reseller portal API.
module.exports = router;
