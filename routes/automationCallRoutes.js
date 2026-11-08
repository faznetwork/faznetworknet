'use strict';

const express = require('express');
const controller = require('../controllers/automationCallController');
const router = express.Router();

router.get('/status', controller.getStatus);
router.post('/test-sms', controller.sendTestSms);
router.post('/test-call', controller.initiateTestCall);

module.exports = router;
