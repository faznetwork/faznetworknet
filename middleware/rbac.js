'use strict';
const ROLES=Object.freeze(['super_admin','admin','staff','reseller']);
const db=require('../db');
function normalizeRole(role){
 const value=String(role||'').toLowerCase().replace(/[\s_-]/g,'');
 if(value==='superadmin')return 'super_admin';
 if(value==='admin')return 'admin';
 if(value==='staff')return 'staff';
 if(value==='reseller')return 'reseller';
 return null;
}
function currentRole(req){
 if(req.session?.legacySuperAdmin===true)return 'super_admin';
 if(req.session?.isAdmin===true&&!req.session?.role&&!req.session?.userId)return 'super_admin';
 return normalizeRole(req.session?.role);
}
function requireRole(allowedRoles){
 const allowed=(Array.isArray(allowedRoles)?allowedRoles:[allowedRoles]).map(normalizeRole).filter(Boolean);
 return async function roleGuard(req,res,next){
  const roleFromSession=currentRole(req);
  const resellerSession=req.session?.isReseller===true&&roleFromSession==='reseller';
  if(!req.session?.isAdmin&&!resellerSession){
   const api=String(req.originalUrl||'').startsWith('/api/');
   return api?res.status(401).json({success:false,message:'Authentication required'}):res.redirect('/login?next='+encodeURIComponent(req.originalUrl||'/admin'));
  }
  let role=roleFromSession;
  if(req.session.userId&&role!=='reseller'){
   try{
    const result=await db.query('SELECT role,status FROM admin_users WHERE id=$1 LIMIT 1',[req.session.userId]);
    const account=result.rows?.[0];
    if(!account||account.status!=='active'){
     return req.session.destroy(()=>{
      res.clearCookie('connect.sid',{path:'/'});
      const api=String(req.originalUrl||'').startsWith('/api/');
      return api?res.status(401).json({success:false,message:'Account is inactive. Sign in again.'}):res.redirect('/login');
     });
    }
    role=normalizeRole(account.role);
    if(!role)return res.status(403).json({success:false,message:'Forbidden: invalid account role'});
    req.session.role=role;
   }catch(error){
    console.error('[RBAC] Could not verify account status:',error.message);
    return res.status(503).json({success:false,message:'Authorization service unavailable'});
   }
  }
  if(role==='reseller'){
   const resellerId=Number(req.session?.resellerId??req.session?.reseller_id);
   if(!Number.isSafeInteger(resellerId)||resellerId<1)return res.status(403).json({success:false,message:'Forbidden: verified reseller identity is required'});
   try{
    const verified=await db.query('SELECT id,status FROM resellers WHERE id=$1 LIMIT 1',[resellerId]);
    const reseller=verified.rows?.[0];
    if(!reseller||String(reseller.status).toLowerCase()!=='active')return res.status(403).json({success:false,message:'Forbidden: reseller account is missing or inactive'});
    req.auth={...(req.auth||{}),role,resellerId:Number(reseller.id)};
   }catch(error){
    console.error('[RBAC] Could not verify reseller identity:',error.message);
    return res.status(503).json({success:false,message:'Authorization service unavailable'});
   }
  }
  if(!role||!allowed.includes(role))return res.status(403).json({success:false,message:'Forbidden: insufficient role permissions'});
  req.auth={...(req.auth||{}),role,userId:req.session.userId||null,username:req.session.adminUser||'',...(role==='reseller'?{resellerId:Number(req.session.resellerId??req.session.reseller_id)}:{})};
  return next();
 };
}
function requireStaffReadOnly(req,res,next){
 const role=currentRole(req);
 if(role==='staff'&&!['GET','HEAD','OPTIONS'].includes(String(req.method||'').toUpperCase()))return res.status(403).json({success:false,message:'Staff accounts are read-only for this resource'});
 return next();
}
module.exports={ROLES,normalizeRole,currentRole,requireRole,requireStaffReadOnly};
