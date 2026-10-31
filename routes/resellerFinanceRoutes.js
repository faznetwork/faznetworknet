'use strict';
const express=require('express');
const router=express.Router();
const controller=require('../controllers/resellerFinanceController');
// Parent mount requires an authenticated administrator with finance-write privileges.
router.get('/accounts/:resellerId',controller.inspect);
router.post('/accounts/:resellerId/wallet-topups',controller.walletTopup);
router.post('/accounts/:resellerId/receivable-settlements',controller.receivableSettlement);
router.patch('/accounts/:resellerId/credit-limit',controller.updateCreditLimit);
module.exports=router;
