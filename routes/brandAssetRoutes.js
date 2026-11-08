'use strict';
const express=require('express');
const router=express.Router();
const controller=require('../controllers/brandAssetController');
router.post('/:asset',controller.upload.single('image'),controller.uploadError,controller.save);
module.exports=router;
