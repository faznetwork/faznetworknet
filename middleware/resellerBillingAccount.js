'use strict';

const { ensureBillingAccount } = require('../services/resellerBillingAccountService');

async function loadResellerBillingAccount(req, res, next) {
  try {
    const account = await ensureBillingAccount(req.auth?.resellerId);
    req.billingAccount = account;
    res.locals.billingAccount = account;
    return next();
  } catch (error) {
    console.error('[Reseller Billing] Shared account snapshot could not be loaded:', {
      resellerId: req.auth?.resellerId || null,
      code: error.code || 'BILLING_ACCOUNT_LOAD_FAILED',
      message: error.message
    });
    req.billingAccount = null;
    res.locals.billingAccount = null;
    res.locals.billingAccountUnavailable = true;
    return next();
  }
}

module.exports = { loadResellerBillingAccount };
