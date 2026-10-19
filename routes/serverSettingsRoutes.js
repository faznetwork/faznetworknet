'use strict';

const express = require('express');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const controller = require('../controllers/serverSettingsController');

const router = express.Router();
router.use(requireSuperAdmin);
router.get('/', controller.listSettings);
router.post('/generate-token', controller.generateToken);
router.post('/generate-android-token', controller.generateAndroidToken);
router.put('/core-settings', controller.saveCoreSettings);
router.get('/tenants', controller.listTenants);
router.post('/tenants', controller.createTenant);
router.patch('/tenants/:id', controller.updateTenant);
module.exports = router;
