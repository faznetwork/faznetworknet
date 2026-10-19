'use strict';

const express = require('express');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const controller = require('../controllers/serverSettingsController');

const router = express.Router();
router.use(requireSuperAdmin);
router.get('/', controller.listSettings);
router.post('/generate-token', controller.generateToken);
module.exports = router;
