'use strict';

const db=require('../db');

function buildTenantScope(role,resellerId,popIds=[]){
 const r=String(role||'').toLowerCase();
 if(['super_admin','admin','staff'].includes(r))return Object.freeze({role:r,global:true,resellerId:null,popIds:null});
 if(r!=='reseller')throw Object.assign(new Error('Forbidden: unsupported tenant role.'),{statusCode:403});
 const id=Number(resellerId);
 if(!Number.isSafeInteger(id)||id<1)throw Object.assign(new Error('Forbidden: verified reseller identity is required.'),{statusCode:403});
 return Object.freeze({role:r,global:false,resellerId:id,popIds:Object.freeze(popIds.map(Number))});
}

function customerBelongsToScope(customer,scope){
 if(!scope)return false;
 if(scope.global)return true;
 return scope.role==='reseller'&&Array.isArray(scope.popIds)&&customer?.pop_id!=null&&scope.popIds.includes(Number(customer.pop_id));
}

async function loadTenantScope(req,res,next){
 try{
  if(req.auth?.role==='reseller'){
   const id=Number(req.auth.resellerId);
   if(!Number.isSafeInteger(id)||id<1)return res.status(403).json({success:false,message:'Verified reseller identity is required.'});
   const result=await db.query('SELECT id FROM pops WHERE reseller_id=$1',[id]);
   req.tenantScope=buildTenantScope('reseller',id,result.rows.map(row=>row.id));
   return next();
  }
  if(['super_admin','admin','staff'].includes(req.auth?.role)){req.tenantScope=buildTenantScope(req.auth.role,null);return next();}
  return res.status(403).json({success:false,message:'Tenant access is not authorized.'});
 }catch(error){
  console.error('[TENANT SCOPE] Context resolution failed:',error.message);
  return res.status(error.statusCode||503).json({success:false,message:error.statusCode?error.message:'Tenant authorization service unavailable.'});
 }
}

/**
 * Resolve a customer against the authenticated tenant before a handler runs.
 * The default preserves API semantics (404 for a genuinely missing customer).
 * Page routes may select notFoundStatus: 403 to avoid rendering or disclosing
 * whether an arbitrary customer identifier exists.
 */
function createCustomerOwnershipGuard(options={}){
 const notFoundStatus=options.notFoundStatus===403?403:404;
 return async function customerOwnershipGuard(req,res,next){
  const scope=req.tenantScope;
  if(!scope)return res.status(403).json({success:false,message:'Tenant scope is missing.'});
  const key=String(req.params?.id??req.query?.username??req.body?.id??req.body?.username??'').trim();
  if(!key)return res.status(400).json({success:false,message:'Customer identifier is required.'});
  try{
   const result=await db.query('SELECT id,username,pop_id FROM customers WHERE (id::text=$1 OR LOWER(username)=LOWER($1)) AND ($2::bigint[] IS NULL OR pop_id=ANY($2::bigint[])) LIMIT 1',[key,scope.global?null:scope.popIds]);
   const customer=result.rows[0];
   if(!customer){
    if(!scope.global){
     const exists=await db.query('SELECT 1 FROM customers WHERE (id::text=$1 OR LOWER(username)=LOWER($1)) LIMIT 1',[key]);
     if(exists.rows.length)return res.status(403).json({success:false,message:'Customer belongs to another reseller or POP.'});
    }
    return res.status(notFoundStatus).json({success:false,message:notFoundStatus===403?'Customer access is forbidden.':'Customer not found.'});
   }
   req.tenantCustomer=customer;
   return next();
  }catch(error){
   console.error('[TENANT SCOPE] Ownership verification failed:',error.message);
   return res.status(503).json({success:false,message:'Customer authorization service unavailable.'});
  }
 };
}

// Backward compatible as a direct Express middleware; passing options creates a configured guard.
function requireCustomerOwnership(reqOrOptions,res,next){
 if(typeof next==='function')return createCustomerOwnershipGuard({})(reqOrOptions,res,next);
 return createCustomerOwnershipGuard(reqOrOptions||{});
}

function requireAdminOnly(req,res,next){
 if(!['super_admin','admin'].includes(req.auth?.role))return res.status(403).json({success:false,message:'Administrator access is required.'});
 return next();
}

module.exports={buildTenantScope,customerBelongsToScope,loadTenantScope,requireCustomerOwnership,requireAdminOnly};
