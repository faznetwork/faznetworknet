'use strict';
const db=require('../db');
function moneyCents(value){const m=String(value??'').trim().match(/^(\d{1,12})(?:\.(\d{1,2}))?$/);if(!m)throw Object.assign(new Error('The configured POP package price is invalid.'),{statusCode:503,code:'INVALID_PACKAGE_PRICE'});return BigInt(m[1])*100n+BigInt((m[2]||'').padEnd(2,'0')||'0');}
function moneyFromCents(value){const n=BigInt(value);return(n/100n).toString()+'.'+(n%100n).toString().padStart(2,'0');}
function resellerKey(value){const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw Object.assign(new Error('Verified reseller identity is required.'),{statusCode:403,code:'RESELLER_ID_REQUIRED'});return id;}
async function getCatalog(resellerIdValue){
 const resellerId=resellerKey(resellerIdValue);
 const [accountResult,catalogueResult]=await Promise.all([
  db.query(\`SELECT id,billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status FROM public.reseller_billing_accounts WHERE reseller_id=$1 LIMIT 1\`,[resellerId]),
  db.query(\`SELECT p.id AS pop_id,p.name AS pop_name,p.area_zone,
    b.id AS binding_id,b.router_key,b.hotspot_server,b.hotspot_interface,b.vlan_id,b.ip_pool,
    pkg.id AS package_id,pkg.package_name,pkg.profile_key,pkg.validity,pkg.time_limit,pkg.data_limit,pkg.retail_price,pkg.wholesale_price
    FROM public.pops p
    LEFT JOIN public.pop_hotspot_bindings b ON b.pop_id=p.id AND b.status='active'
    LEFT JOIN public.pop_hotspot_packages pkg ON pkg.pop_id=p.id AND pkg.status='active' AND b.id IS NOT NULL
    WHERE p.reseller_id=$1 AND p.status='active'
    ORDER BY p.name ASC,pkg.display_order ASC,pkg.package_name ASC,pkg.id ASC\`,[resellerId])
 ]);
 const popsById=new Map();
 for(const row of catalogueResult.rows||[]){
  const key=String(row.pop_id);let pop=popsById.get(key);
  if(!pop){pop={id:Number(row.pop_id),name:row.pop_name,areaZone:row.area_zone||'',bindingConfigured:Boolean(row.binding_id),packages:[]};popsById.set(key,pop);}
  if(row.package_id===null||row.package_id===undefined)continue;
  pop.packages.push({id:String(row.package_id),name:row.package_name,profileKey:row.profile_key,validity:row.validity,timeLimit:row.time_limit||null,dataLimit:row.data_limit||null,retailPrice:String(row.retail_price),wholesalePrice:String(row.wholesale_price),expectedMargin:moneyFromCents(moneyCents(row.retail_price)-moneyCents(row.wholesale_price))});
 }
 const account=accountResult.rows?.[0]||null;
 return {success:true,account:account?{id:String(account.id),billingMode:account.billing_mode,walletBalance:String(account.wallet_balance),receivableBalance:String(account.receivable_balance),creditLimit:String(account.credit_limit),currency:account.currency,status:account.account_status}:null,pops:Array.from(popsById.values())};
}
module.exports={getCatalog};
