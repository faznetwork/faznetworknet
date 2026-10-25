"use strict";
const LEGACY_CATEGORY_MAP=Object.freeze({online_mfs:"mfs",scratch_card:"scratch_voucher",manual:"admin_voucher"});
const ALLOWED_CATEGORIES=Object.freeze(["all","mfs","scratch_voucher","admin_voucher","other"]);
function normalizeSalesCategory(value){
 const raw=String(value??"").trim().toLowerCase();
 return LEGACY_CATEGORY_MAP[raw]||raw||"all";
}
function transactionCategorySql(alias="t"){
 if(!/^[a-z_][a-z0-9_]*$/i.test(alias))throw new TypeError("Invalid SQL table alias for Hotspot sales category.");
 const t=alias;
 return "CASE WHEN EXISTS(SELECT 1 FROM hotspot_voucher_payments hp_cat JOIN hotspot_vouchers v_cat ON v_cat.id=hp_cat.voucher_id WHERE hp_cat.transaction_id="+t+".id AND v_cat.subscriber_type='mfs') OR EXISTS(SELECT 1 FROM hotspot_vouchers v_cat WHERE v_cat.transaction_id="+t+".id AND v_cat.subscriber_type='mfs') THEN 'mfs' "+
  "WHEN EXISTS(SELECT 1 FROM hotspot_voucher_payments hp_cat JOIN hotspot_vouchers v_cat ON v_cat.id=hp_cat.voucher_id WHERE hp_cat.transaction_id="+t+".id AND v_cat.subscriber_type='scratch_voucher') OR EXISTS(SELECT 1 FROM hotspot_vouchers v_cat WHERE v_cat.transaction_id="+t+".id AND v_cat.subscriber_type='scratch_voucher') THEN 'scratch_voucher' "+
  "WHEN EXISTS(SELECT 1 FROM hotspot_voucher_payments hp_cat JOIN hotspot_vouchers v_cat ON v_cat.id=hp_cat.voucher_id WHERE hp_cat.transaction_id="+t+".id AND v_cat.subscriber_type='admin_voucher') OR EXISTS(SELECT 1 FROM hotspot_vouchers v_cat WHERE v_cat.transaction_id="+t+".id AND v_cat.subscriber_type='admin_voucher') THEN 'admin_voucher' "+
  "WHEN COALESCE("+t+".sale_type,'other')='online_mfs' THEN 'mfs' WHEN COALESCE("+t+".sale_type,'other')='scratch_card' THEN 'scratch_voucher' WHEN COALESCE("+t+".sale_type,'other')='manual' THEN 'admin_voucher' ELSE 'other' END";
}
module.exports={ALLOWED_CATEGORIES,normalizeSalesCategory,transactionCategorySql};
