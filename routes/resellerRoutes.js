'use strict';
const express=require('express'),router=express.Router();
const controller=require('../controllers/resellerController');
const {requireRole}=require('../middleware/rbac');
router.use(requireRole(['super_admin','admin']));
router.get('/',controller.list);
router.put('/:id',controller.update);
router.patch('/:id/status',controller.updateStatus);
module.exports=router;
