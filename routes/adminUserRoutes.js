'use strict';
const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbac');
const controller = require('../controllers/rbacAuthController');

router.use(requireRole(['super_admin', 'admin']));
router.get('/', controller.listUsers);
router.post('/', controller.createUser);
router.get('/invitations', controller.listInvitations);
router.post('/:id/resend-invitation', controller.resendInvitation);
router.delete('/invitations/:id', controller.cancelInvitation);
router.patch('/:id/status', controller.updateUserStatus);
router.delete('/:id', controller.deleteUser);
module.exports = router;
