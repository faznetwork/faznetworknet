'use strict';

const express = require('express');
const controller = require('../controllers/routerDeviceController');
const router = express.Router();

router.get('/devices', controller.listDevices);
router.post('/test-connection', controller.testConnection);
router.post('/add-device', controller.addDevice);
router.put('/devices/:id', controller.updateDevice);
router.post('/devices/:id/test-connection', controller.testSavedDevice);
router.post('/devices/:id/activate', controller.activateDevice);
router.delete('/devices/:id', controller.deleteDevice);
router.post('/devices/:id/deactivate', controller.deactivateDevice);

module.exports = router;
