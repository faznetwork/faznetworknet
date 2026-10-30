'use strict';
const db=require('../db');
function validId(v){const id=Number(v);return Number.isSafeInteger(id)&&id>0?id:null;}
function fail(res,e,op){console.error('[POP API] '+op+':',e.message);return res.status(e.statusCode||503).json({success:false,message:e.statusCode?e.message:'POP operation failed.'});}
function parse(b={},partial=false){
 const d={};
 for(const k of ['name','area_zone','reseller_id','vlan_id','mikrotik_ip_pool','commission_type','commission_rate']){
  if(partial&&!Object.prototype.hasOwnProperty.call(b,k))continue;
  if(k==='name'||k==='area_zone')d[k]=String(b[k]||'').trim();
  else if(k==='reseller_id')d[k]=b[k]==null||b[k]===''?null:validId(b[k]);
  else if(k==='vlan_id')d[k]=b[k]==null||b[k]===''?null:Number(b[k]);
  else if(k==='mikrotik_ip_pool')d[k]=String(b[k]||'').trim()||null;
  else if(k==='commission_type')d[k]=String(b[k]||'percentage').trim().toLowerCase();
  else if(k==='commission_rate')d[k]=Number(b[k]??0);
 }
 if(d.name!==undefined&&(!d.name||d.name.length>100))throw Object.assign(new Error('POP name is required and limited to 100 characters.'),{statusCode:400});
 if(d.area_zone!==undefined&&d.area_zone.length>150)throw Object.assign(new Error('Area/zone is limited to 150 characters.'),{statusCode:400});
 if(d.reseller_id===null&&b.reseller_id!=null&&b.reseller_id!=='')throw Object.assign(new Error('Invalid reseller_id.'),{statusCode:400});
 if(d.vlan_id!==undefined&&d.vlan_id!==null&&(!Number.isInteger(d.vlan_id)||d.vlan_id<1||d.vlan_id>4094))throw Object.assign(new Error('VLAN ID must be between 1 and 4094.'),{statusCode:400});
 if(d.commission_type!==undefined&&!['percentage','fixed'].includes(d.commission_type))throw Object.assign(new Error('Invalid commission_type.'),{statusCode:400});
 if(d.commission_rate!==undefined&&(!Number.isFinite(d.commission_rate)||d.commission_rate<0||(d.commission_type==='percentage'&&d.commission_rate>100)))throw Object.assign(new Error('Invalid commission_rate.'),{statusCode:400});
 return d;
}
async function list(req,res){
 try{
  const reseller=req.auth?.role==='reseller';
  const sql='SELECT p.id,p.reseller_id,p.name,p.area_zone,p.commission_type,p.commission_rate,p.status,p.vlan_id,p.mikrotik_ip_pool,p.created_at,p.updated_at,r.name AS reseller_name,r.username AS reseller_username,COUNT(c.id)::int AS customer_count FROM pops p LEFT JOIN resellers r ON r.id=p.reseller_id LEFT JOIN customers c ON c.pop_id=p.id '+(reseller?'WHERE p.reseller_id=$1 ':'')+'GROUP BY p.id,r.id ORDER BY p.name ASC,p.id ASC';
  const result=await db.query(sql,reseller?[req.auth.resellerId]:[]);
  return res.json({success:true,pops:result.rows});
 }catch(e){return fail(res,e,'List');}
}
async function create(req,res){
 try{
  const d=parse(req.body);
  if(d.reseller_id!==null){const owner=await db.query("SELECT id FROM resellers WHERE id=$1 AND status='active' LIMIT 1",[d.reseller_id]);if(!owner.rows.length)return res.status(400).json({success:false,message:'Selected reseller does not exist or is inactive.'});}
  const r=await db.query('INSERT INTO pops(name,area_zone,reseller_id,vlan_id,mikrotik_ip_pool,commission_type,commission_rate) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,reseller_id,name,area_zone,vlan_id,mikrotik_ip_pool,commission_type,commission_rate,status,created_at,updated_at',[d.name,d.area_zone,d.reseller_id,d.vlan_id,d.mikrotik_ip_pool,d.commission_type,d.commission_rate]);
  return res.status(201).json({success:true,pop:r.rows[0]});
 }catch(e){return fail(res,e,'Create');}
}
async function update(req,res){
 const id=validId(req.params.id);if(!id)return res.status(400).json({success:false,message:'Invalid POP ID.'});
 try{
  const d=parse(req.body,true),keys=Object.keys(d);if(!keys.length)return res.status(400).json({success:false,message:'Provide at least one POP property.'});
  if(d.reseller_id!=null){const owner=await db.query("SELECT id FROM resellers WHERE id=$1 AND status='active' LIMIT 1",[d.reseller_id]);if(!owner.rows.length)return res.status(400).json({success:false,message:'Selected reseller does not exist or is inactive.'});}
  const cols={name:'name',area_zone:'area_zone',reseller_id:'reseller_id',vlan_id:'vlan_id',mikrotik_ip_pool:'mikrotik_ip_pool',commission_type:'commission_type',commission_rate:'commission_rate'};
  const values=keys.map(k=>d[k]),sets=keys.map((k,i)=>cols[k]+'=$'+(i+1));values.push(id);
  const r=await db.query('UPDATE pops SET '+sets.join(',')+',updated_at=NOW() WHERE id=$'+values.length+' RETURNING id,reseller_id,name,area_zone,vlan_id,mikrotik_ip_pool,commission_type,commission_rate,status,updated_at',values);
  if(!r.rows.length)return res.status(404).json({success:false,message:'POP not found.'});
  return res.json({success:true,pop:r.rows[0]});
 }catch(e){return fail(res,e,'Update');}
}
async function updateStatus(req,res){
 const id=validId(req.params.id),status=String(req.body?.status||'').toLowerCase();
 if(!id)return res.status(400).json({success:false,message:'Invalid POP ID.'});
 if(!['active','inactive'].includes(status))return res.status(400).json({success:false,message:'Status must be active or inactive.'});
 try{const r=await db.query('UPDATE pops SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,name,status',[status,id]);if(!r.rows.length)return res.status(404).json({success:false,message:'POP not found.'});return res.json({success:true,pop:r.rows[0],message:'POP status updated. Customer records were preserved.'});}
 catch(e){return fail(res,e,'Status update');}
}
module.exports={list,create,update,updateStatus};
