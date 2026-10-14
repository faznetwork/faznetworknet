'use strict';

const express = require('express');
const controller = require('../controllers/routerDeviceController');
const router = express.Router();

router.post('/test-connection', controller.testConnection);
router.post('/add-device', controller.addDevice);

module.exports = router;
