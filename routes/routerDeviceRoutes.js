'use strict';

const express = require('express');
const controller = require('../controllers/routerDeviceController');
const router = express.Router();

router.get('/devices', controller.listDevices);
router.post('/test-connection', controller.testConnection);
router.post('/add-device', controller.addDevice);
router.put('/devices/:id', controller.updateDevice);

module.exports = router;
