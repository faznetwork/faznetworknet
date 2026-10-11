'use strict';
const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbac');
const controller = require('../controllers/hrController');

router.use(requireRole(['super_admin','admin']));
router.get('/departments', controller.listDepartments);
router.post('/departments', controller.createDepartment);
router.put('/departments/:id', controller.updateDepartment);
router.delete('/departments/:id', controller.deleteDepartment);
router.get('/employees', controller.listEmployees);
router.post('/employees', controller.createEmployee);
router.put('/employees/:id', controller.updateEmployee);
router.delete('/employees/:id', controller.deleteEmployee);

module.exports = router;
