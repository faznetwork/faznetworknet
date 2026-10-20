'use strict';

const express = require('express');
const controller = require('../controllers/tenantDataController');
const requireTenantAdmin = require('../middleware/requireTenantAdmin');
const { requireTenantModule } = require('../middleware/tenantAccess');
const router = express.Router();

router.use(requireTenantAdmin);
router.get('/customers', requireTenantModule('customers'), controller.listCustomers);
router.post('/customers', requireTenantModule('customers'), controller.createCustomer);
router.put('/customers/:id', requireTenantModule('customers'), controller.updateCustomer);
router.delete('/customers/:id', requireTenantModule('customers'), controller.deleteCustomer);
router.get('/vouchers', requireTenantModule('hotspot'), controller.listVouchers);
router.post('/vouchers', requireTenantModule('hotspot'), controller.createVoucher);
router.put('/vouchers/:id', requireTenantModule('hotspot'), controller.updateVoucher);
router.delete('/vouchers/:id', requireTenantModule('hotspot'), controller.deleteVoucher);
router.get('/transactions', requireTenantModule('billing'), controller.listTransactions);
router.post('/transactions', requireTenantModule('billing'), controller.createTransaction);

module.exports = router;
