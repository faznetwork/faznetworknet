'use strict';

const express = require('express');
const controller = require('../controllers/tenantHardwareController');
const router = express.Router();

router.get('/', controller.list);
router.post('/routers', controller.createRouter);
router.put('/routers/:id', controller.updateRouter);
router.delete('/routers/:id', controller.deleteRouter);
router.post('/olts', controller.createOlt);
router.delete('/olts/:id', controller.deleteOlt);

module.exports = router;
