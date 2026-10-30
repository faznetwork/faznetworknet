'use strict';

const express = require('express');
const router = express.Router();
const resellerController = require('../controllers/resellerController');
const resellerAuthController = require('../controllers/resellerAuthController');
const { requireRole } = require('../middleware/rbac');
const rateLimiter = require('../middleware/postgresRateLimiter');

// Public reseller authentication endpoints. These must remain above the admin guard.
router.post('/accept-invite', rateLimiter.resellerAcceptInvite, resellerAuthController.acceptInvite);
router.post('/login', rateLimiter.resellerLogin, resellerAuthController.login);
router.post('/logout', resellerAuthController.logout);

// Administrative invitation lifecycle.
router.post('/invite', requireRole(['super_admin', 'admin']), rateLimiter.resellerAdminInvite, resellerAuthController.invite);
router.post('/:id/resend-invite', requireRole(['super_admin', 'admin']), rateLimiter.resellerAdminResend, resellerAuthController.resendInvite);
router.post('/:id/cancel-invite', requireRole(['super_admin', 'admin']), resellerAuthController.cancelInvite);

// Existing reseller administration remains administrator-only.
router.use(requireRole(['super_admin', 'admin']));
router.get('/', resellerController.list);
router.put('/:id', resellerController.update);
router.patch('/:id/status', resellerController.updateStatus);

module.exports = router;
