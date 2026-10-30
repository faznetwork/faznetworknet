'use strict';

const express = require('express');
const router = express.Router();
const resellerController = require('../controllers/resellerController');
const resellerAuthController = require('../controllers/resellerAuthController');
const { requireRole } = require('../middleware/rbac');

// Public reseller authentication endpoints. These must remain above the admin guard.
router.post('/accept-invite', resellerAuthController.acceptInvite);
router.post('/login', resellerAuthController.login);
router.post('/logout', resellerAuthController.logout);

// Administrative invitation lifecycle.
router.post('/invite', requireRole(['super_admin', 'admin']), resellerAuthController.invite);
router.post('/:id/resend-invite', requireRole(['super_admin', 'admin']), resellerAuthController.resendInvite);
router.post('/:id/cancel-invite', requireRole(['super_admin', 'admin']), resellerAuthController.cancelInvite);

// Existing reseller administration remains administrator-only.
router.use(requireRole(['super_admin', 'admin']));
router.get('/', resellerController.list);
router.put('/:id', resellerController.update);
router.patch('/:id/status', resellerController.updateStatus);

module.exports = router;
