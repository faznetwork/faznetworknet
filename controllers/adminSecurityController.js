'use strict';
const db=require('../db');

async function listAuditLogs(req,res){
  try{
    const limit=Math.min(200,Math.max(1,Number(req.query.limit)||100));
    const result=await db.query('SELECT id,actor_username,actor_role,action,target_user_id,details,ip_address,created_at FROM admin_audit_logs ORDER BY created_at DESC,id DESC LIMIT $1',[limit]);
    return res.json({success:true,logs:result.rows});
  }catch(error){console.error('[Security] Audit log query failed:',error.message);return res.status(500).json({success:false,message:'Unable to load audit logs.'});}
}
async function listTickets(req,res){
  try{
    const role=req.auth?.role;
    const category=String(req.query?.category||'all').trim().toLowerCase();
    if(!['all','general','software','website'].includes(category))return res.status(400).json({success:false,message:'Invalid ticket category.'});
    const params=[];
    const where=[];
    if(category!=='all'){params.push(category);where.push(`t.category=${params.length}`);}
    if(role==='staff'){
      if(!req.session.userId)return res.json({success:true,tickets:[]});
      params.push(req.session.userId);where.push(`t.assigned_to_user_id=${params.length}`);
    }
    const result=await db.query('SELECT t.id,t.title,t.description,t.category,t.status,t.priority,t.customer_username,t.assigned_to_user_id,u.username AS assigned_to_username,t.created_by,t.created_at,t.updated_at FROM support_tickets t LEFT JOIN admin_users u ON u.id=t.assigned_to_user_id '+(where.length?'WHERE '+where.join(' AND '):'')+' ORDER BY CASE t.status WHEN \'open\' THEN 0 WHEN \'in_progress\' THEN 1 ELSE 2 END,t.created_at DESC LIMIT 300',params);
    return res.json({success:true,category,tickets:result.rows});
  }catch(error){console.error('[Security] Ticket list failed:',error.message);return res.status(500).json({success:false,message:'Unable to load support tickets.'});}
}
async function createTicket(req,res){
  const title=String(req.body?.title||'').trim(),description=String(req.body?.description||'').trim();
  const priority=String(req.body?.priority||'normal').toLowerCase();
  const category=String(req.body?.category||'general').trim().toLowerCase();
  const customerUsername=String(req.body?.customer_username||'').trim()||null;
  const assigned= req.body?.assigned_to_user_id ? Number(req.body.assigned_to_user_id) : null;
  if(title.length<3||title.length>180||description.length<3||description.length>10000)return res.status(400).json({success:false,message:'Title and description are required.'});
  if(!['low','normal','high','urgent'].includes(priority))return res.status(400).json({success:false,message:'Invalid priority.'});
  if(!['general','software','website'].includes(category))return res.status(400).json({success:false,message:'Invalid ticket category.'});
  try{
    if(assigned){
      const staff=await db.query("SELECT id FROM admin_users WHERE id=$1 AND role='staff' AND status='active'",[assigned]);
      if(!staff.rows.length)return res.status(400).json({success:false,message:'Select an active staff account.'});
    }
    const result=await db.query("INSERT INTO support_tickets(title,description,category,status,priority,customer_username,assigned_to_user_id,created_by) VALUES($1,$2,$3,'open',$4,$5,$6,$7) RETURNING id,title,description,category,status,priority,customer_username,assigned_to_user_id,created_by,created_at,updated_at",[title,description,category,priority,customerUsername,assigned,req.session.adminUser||'admin']);
    await db.query('INSERT INTO admin_audit_logs(actor_user_id,actor_username,actor_role,action,details,ip_address) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[req.session.userId||null,req.session.adminUser||'admin',req.auth?.role||'super_admin','support_ticket_created',JSON.stringify({ticket_id:result.rows[0].id,title}),String(req.ip||'').slice(0,64)||null]).catch(()=>{});
    return res.status(201).json({success:true,ticket:result.rows[0]});
  }catch(error){console.error('[Security] Ticket creation failed:',error.message);return res.status(500).json({success:false,message:'Unable to create support ticket.'});}
}
async function updateTicket(req,res){
  const id=Number(req.params.id),status=String(req.body?.status||'').toLowerCase();
  const assigned=req.body?.assigned_to_user_id===null||req.body?.assigned_to_user_id===''?null:Number(req.body?.assigned_to_user_id);
  if(!Number.isSafeInteger(id)||id<1||!['open','in_progress','resolved','closed'].includes(status))return res.status(400).json({success:false,message:'Invalid ticket or status.'});
  try{
    if(assigned!==null){
      const staff=await db.query("SELECT id FROM admin_users WHERE id=$1 AND role='staff' AND status='active'",[assigned]);
      if(!staff.rows.length)return res.status(400).json({success:false,message:'Select an active staff account.'});
    }
    const result=await db.query('UPDATE support_tickets SET status=$1,assigned_to_user_id=$2,updated_at=NOW() WHERE id=$3 RETURNING id,title,status,assigned_to_user_id,updated_at',[status,assigned,id]);
    if(!result.rows.length)return res.status(404).json({success:false,message:'Ticket not found.'});
    await db.query('INSERT INTO admin_audit_logs(actor_user_id,actor_username,actor_role,action,target_user_id,details,ip_address) VALUES($1,$2,$3,$4,NULL,$5::jsonb,$6)',[req.session.userId||null,req.session.adminUser||'admin',req.auth?.role||'super_admin','support_ticket_updated',JSON.stringify({ticket_id:id,status,assigned_to_user_id:assigned}),String(req.ip||'').slice(0,64)||null]).catch(()=>{});
    return res.json({success:true,ticket:result.rows[0]});
  }catch(error){console.error('[Security] Ticket update failed:',error.message);return res.status(500).json({success:false,message:'Unable to update support ticket.'});}
}
async function listStaff(req,res){
  try{const result=await db.query("SELECT id,username,email FROM admin_users WHERE role='staff' AND status='active' ORDER BY username ASC");return res.json({success:true,staff:result.rows});}
  catch(error){return res.status(500).json({success:false,message:'Unable to load staff list.'});}
}
module.exports={listAuditLogs,listTickets,createTicket,updateTicket,listStaff};
