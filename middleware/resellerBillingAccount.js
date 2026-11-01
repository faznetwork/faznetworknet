'use strict';

const { ensureBillingAccount } = require('../services/resellerBillingAccountService');

async function loadResellerBillingAccount(req, res, next) {
  try {
    const account = await ensureBillingAccount(req.auth?.resellerId);
    const billingAccount = account || null;
    const billingAccountUnavailable = !billingAccount;
    req.billingAccount = billingAccount;
    req.billingAccountUnavailable = billingAccountUnavailable;
    res.locals.billingAccount = billingAccount;
    res.locals.billingAccountUnavailable = billingAccountUnavailable;
    return next();
  } catch (error) {
    console.error('[Reseller Billing] Shared account snapshot could not be loaded:', {
      resellerId: req.auth?.resellerId || null,
      code: error.code || 'BILLING_ACCOUNT_LOAD_FAILED',
      message: error.message
    });
    req.billingAccount = null;
    req.billingAccountUnavailable = true;
    res.locals.billingAccount = null;
    res.locals.billingAccountUnavailable = true;
    return next();
  }
}

module.exports = { loadResellerBillingAccount };
