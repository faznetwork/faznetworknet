'use strict';

const bcrypt = require('bcryptjs');
const db = require('../db');

function renderLogin(res, status, error) { return res.status(status).set('Cache-Control', 'no-store').render('tenant-login', { error, tenantNumber: '' }); }
function showLogin(req, res) {
  if (req.session?.tenantAdmin === true && req.session?.tenantId) return res.redirect('/tenant/dashboard');
  return res.set('Cache-Control', 'no-store').render('tenant-login', { error: req.query?.error === 'inactive' ? 'This tenant is inactive or its 30-day subscription has expired.' : null, tenantNumber: '' });
}
async function authenticate(username, password) {
  const result = await db.query(`SELECT t.id AS tenant_id,t.name AS tenant_name,t.status AS tenant_status,s.ends_at,u.id AS user_id,u.username,u.email,u.password_hash,u.role,u.status AS user_status
    FROM public.admin_users u JOIN public.tenants t ON t.id=u.tenant_id
    JOIN LATERAL (SELECT ends_at FROM public.tenant_subscriptions WHERE tenant_id=t.id AND status='active' ORDER BY ends_at DESC LIMIT 1) s ON TRUE
    WHERE t.status='active' AND s.ends_at>NOW() AND u.status='active' AND u.role IN ('admin','staff') AND (lower(u.email)=lower($1) OR lower(u.username)=lower($1)) ORDER BY u.id LIMIT 2`, [username]);
  if (result.rows.length !== 1) return null;
  const user=result.rows[0];
  if (!(await bcrypt.compare(password,user.password_hash))) return null;
  return user;
}
function startSession(req,res,user,jsonMode) {
  return new Promise(resolve=>req.session.regenerate(err=>{
    if(err)return resolve(jsonMode?res.status(500).json({success:false,message:'Could not initialize a secure session.'}):renderLogin(res,500,'Could not initialize a secure session. Please retry.'));
    Object.assign(req.session,{tenantAdmin:true,tenantId:Number(user.tenant_id),tenantName:user.tenant_name,isAdmin:false,adminUser:user.username,userId:user.user_id,role:user.role,legacySuperAdmin:false,loginAt:Date.now()});
    req.session.save(saveError=>{
      if(saveError)return resolve(jsonMode?res.status(500).json({success:false,message:'Could not save your session.'}):renderLogin(res,500,'Could not save your session. Please retry.'));
      db.query('UPDATE public.admin_users SET last_login_at=NOW(),updated_at=NOW() WHERE id=$1 AND tenant_id=$2',[user.user_id,user.tenant_id]).catch(()=>{});
      resolve(jsonMode?res.json({success:true,redirect:'/tenant/dashboard',tenantId:Number(user.tenant_id)}):res.redirect('/tenant/dashboard'));
    });
  }));
}
async function login(req,res) {
  const username=String(req.body?.username||req.body?.email||'').trim(); const password=String(req.body?.password||'');
  if(!username||!password)return renderLogin(res,400,'Enter your username or email and password.');
  try { const user=await authenticate(username,password); if(!user)return renderLogin(res,401,'Invalid credentials, inactive tenant, or expired subscription.'); return await startSession(req,res,user,false); }
  catch(error){console.error('[Tenant Auth] Smart login failed:',error.message);return renderLogin(res,503,'Tenant authentication is temporarily unavailable. Please retry.');}
}
async function apiLogin(req,res) {
  const username=String(req.body?.username||req.body?.email||'').trim(); const password=String(req.body?.password||'');
  if(!username||!password)return res.status(400).json({success:false,message:'Username/email and password are required.'});
  try { const user=await authenticate(username,password); if(!user)return res.status(401).json({success:false,message:'Invalid credentials, inactive tenant, or expired subscription.'}); return await startSession(req,res,user,true); }
  catch(error){console.error('[Tenant Auth] API smart login failed:',error.message);return res.status(503).json({success:false,message:'Tenant authentication is temporarily unavailable.'});}
}
function logout(req,res){if(!req.session)return res.redirect('/login');req.session.destroy(error=>{if(error)console.error('[Tenant Auth] Logout failed:',error.message);res.clearCookie('connect.sid',{path:'/'});return res.redirect('/login');});}
module.exports={showLogin,login,apiLogin,logout,authenticate,startSession};
