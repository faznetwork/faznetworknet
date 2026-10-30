'use strict';
const db=require('../db');
function validId(v){const id=Number(v);return Number.isSafeInteger(id)&&id>0?id:null;}
function fail(res,e,op){console.error('[RESELLER API] '+op+':',e.message);return res.status(e.statusCode||503).json({success:false,message:e.statusCode?e.message:'Reseller operation failed.'});}
async function list(req,res){
 try{const r=await db.query('SELECT r.id,r.name,r.username,r.phone,r.status,r.created_at,r.updated_at,COUNT(DISTINCT p.id)::int AS pop_count,COUNT(DISTINCT c.id)::int AS customer_count FROM resellers r LEFT JOIN pops p ON p.reseller_id=r.id LEFT JOIN customers c ON c.pop_id=p.id GROUP BY r.id ORDER BY r.name ASC,r.id ASC');return res.json({success:true,resellers:r.rows});}
 catch(e){return fail(res,e,'List');}
}
async function update(req,res){
 const id=validId(req.params.id);if(!id)return res.status(400).json({success:false,message:'Invalid reseller ID.'});
 const b=req.body||{},d={};for(const k of ['name','username','phone'])if(Object.prototype.hasOwnProperty.call(b,k))d[k]=String(b[k]||'').trim();
 const keys=Object.keys(d);if(!keys.length)return res.status(400).json({success:false,message:'Provide at least one profile/contact field.'});
 if(d.name!==undefined&&(!d.name||d.name.length>100))return res.status(400).json({success:false,message:'Name is required and limited to 100 characters.'});
 if(d.username!==undefined&&!/^[A-Za-z0-9._-]{3,50}$/.test(d.username))return res.status(400).json({success:false,message:'Username must be 3-50 valid characters.'});
 if(d.phone!==undefined&&(!d.phone||d.phone.length>40))return res.status(400).json({success:false,message:'Phone is required and limited to 40 characters.'});
 try{
  const cols={name:'name',username:'username',phone:'phone'},values=keys.map(k=>d[k]),sets=keys.map((k,i)=>cols[k]+'=$'+(i+1));values.push(id);
  const r=await db.query('UPDATE resellers SET '+sets.join(',')+',updated_at=NOW() WHERE id=$'+values.length+' RETURNING id,name,username,phone,status,updated_at',values);
  if(!r.rows.length)return res.status(404).json({success:false,message:'Reseller not found.'});
  return res.json({success:true,reseller:r.rows[0]});
 }catch(e){if(e.code==='23505')return res.status(409).json({success:false,message:'This reseller username is already in use.'});return fail(res,e,'Update');}
}
async function updateStatus(req,res){
 const id=validId(req.params.id),status=String(req.body?.status||'').toLowerCase();
 if(!id)return res.status(400).json({success:false,message:'Invalid reseller ID.'});
 if(!['active','inactive'].includes(status))return res.status(400).json({success:false,message:'Status must be active or inactive.'});
 try{
  const r=await db.query(
   "UPDATE resellers SET status=$1,updated_at=NOW() WHERE id=$2 AND ($1 <> 'active' OR password_hash IS NOT NULL) RETURNING id,name,status",
   [status,id]
  );
  if(!r.rows.length){
   const existing=await db.query('SELECT id,password_hash FROM resellers WHERE id=$1 LIMIT 1',[id]);
   if(!existing.rows.length)return res.status(404).json({success:false,message:'Reseller not found.'});
   if(status==='active'&&!existing.rows[0].password_hash)return res.status(409).json({success:false,message:'This reseller must accept the email invitation and set a password before activation.'});
   return res.status(404).json({success:false,message:'Reseller not found or status was not changed.'});
  }
  return res.json({success:true,reseller:r.rows[0],message:'Reseller status updated; POP and customer records were preserved.'});
 }catch(e){return fail(res,e,'Status update');}
}
module.exports={list,update,updateStatus};
