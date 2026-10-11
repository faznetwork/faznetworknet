'use strict';
const db = require('../db');
const clean = (v, n = 255) => String(v ?? '').trim().slice(0, n);
const idOrNull = v => v === null || v === undefined || v === '' ? null : (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : NaN);
const statusOf = v => ['active','inactive'].includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : null;
const dateOf = v => {
  const s = String(v || '').trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(s + 'T00:00:00.000Z');
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== s ? undefined : s;
};
const validId = v => Number.isSafeInteger(Number(v)) && Number(v) > 0;
function conflict(res, e, message) {
  if (e?.code === '23505') return res.status(409).json({success:false,message:'That name or employee code is already in use.'});
  console.error('[HR]', e?.message || e);
  return res.status(500).json({success:false,message});
}

exports.listDepartments = async (req,res) => {
  try {
    const r = await db.query(\`SELECT d.id,d.name,d.description,d.status,d.created_by,d.created_at,d.updated_at,COUNT(e.id)::int employee_count
      FROM hr_departments d LEFT JOIN hr_employees e ON e.department_id=d.id
      GROUP BY d.id ORDER BY CASE WHEN d.status='active' THEN 0 ELSE 1 END,d.name ASC,d.id ASC\`);
    return res.json({success:true,departments:r.rows});
  } catch(e) { console.error('[HR] Department list failed:',e?.message||e); return res.status(500).json({success:false,message:'Unable to load departments.'}); }
};
exports.createDepartment = async (req,res) => {
  const name=clean(req.body?.name,120), description=clean(req.body?.description,500), status=statusOf(req.body?.status||'active');
  if(name.length<2||!status)return res.status(400).json({success:false,message:'Enter a department name and valid status.'});
  try {
    const r=await db.query('INSERT INTO hr_departments(name,description,status,created_by) VALUES($1,$2,$3,$4) RETURNING id,name,description,status,created_by,created_at,updated_at',[name,description||null,status,clean(req.session?.adminUser||'admin',100)]);
    return res.status(201).json({success:true,department:r.rows[0]});
  } catch(e){return conflict(res,e,'Unable to create department.');}
};
exports.updateDepartment = async (req,res) => {
  const id=Number(req.params.id),name=clean(req.body?.name,120),description=clean(req.body?.description,500),status=statusOf(req.body?.status);
  if(!validId(id)||name.length<2||!status)return res.status(400).json({success:false,message:'Valid department details are required.'});
  try {
    const r=await db.query('UPDATE hr_departments SET name=$1,description=$2,status=$3,updated_at=NOW() WHERE id=$4 RETURNING id,name,description,status,created_by,created_at,updated_at',[name,description||null,status,id]);
    if(!r.rowCount)return res.status(404).json({success:false,message:'Department not found.'});
    return res.json({success:true,department:r.rows[0]});
  } catch(e){return conflict(res,e,'Unable to update department.');}
};
exports.deleteDepartment = async (req,res) => {
  const id=Number(req.params.id);
  if(!validId(id))return res.status(400).json({success:false,message:'Invalid department ID.'});
  try {
    const employees=await db.query('SELECT COUNT(*)::int count FROM hr_employees WHERE department_id=$1',[id]);
    if(Number(employees.rows[0]?.count||0)>0)return res.status(409).json({success:false,message:'Move employees to another department before deleting this department.'});
    const r=await db.query('DELETE FROM hr_departments WHERE id=$1 RETURNING id',[id]);
    if(!r.rowCount)return res.status(404).json({success:false,message:'Department not found.'});
    return res.json({success:true,id});
  } catch(e){console.error('[HR] Department delete failed:',e?.message||e);return res.status(500).json({success:false,message:'Unable to delete department.'});}
};

exports.listEmployees = async (req,res) => {
  try {
    const sort=String(req.query?.sort||'name').toLowerCase()==='added'?'added':'name';
    const order=sort==='added'?'e.created_at DESC,e.id DESC':'e.full_name ASC,e.id ASC';
    const [r,d]=await Promise.all([
      db.query(\`SELECT e.id,e.employee_code,e.full_name,e.phone,e.email,e.department_id,d.name department_name,e.designation,e.joining_date,e.status,e.notes,e.created_by,e.created_at,e.updated_at
        FROM hr_employees e LEFT JOIN hr_departments d ON d.id=e.department_id ORDER BY \${order} LIMIT 2000\`),
      db.query("SELECT id,name FROM hr_departments WHERE status='active' ORDER BY name ASC")
    ]);
    return res.json({success:true,sort,employees:r.rows,departments:d.rows});
  } catch(e){console.error('[HR] Employee list failed:',e?.message||e);return res.status(500).json({success:false,message:'Unable to load employees.'});}
};
function employeeInput(body) {
  const full_name=clean(body?.full_name,160),employee_code=clean(body?.employee_code,40),phone=clean(body?.phone,40),email=clean(body?.email,254).toLowerCase();
  const department_id=idOrNull(body?.department_id),designation=clean(body?.designation,120),joining_date=dateOf(body?.joining_date),status=statusOf(body?.status||'active'),notes=clean(body?.notes,2000);
  if(full_name.length<2||!status||joining_date===undefined||Number.isNaN(department_id))return {error:'Enter a valid name, status, department, and joining date.'};
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {error:'Enter a valid email address.'};
  return {full_name,employee_code:employee_code||null,phone:phone||null,email:email||null,department_id,designation:designation||null,joining_date,status,notes:notes||null};
}
exports.createEmployee = async (req,res) => {
  const x=employeeInput(req.body);
  if(x.error)return res.status(400).json({success:false,message:x.error});
  try {
    if(x.department_id!==null){const d=await db.query('SELECT id FROM hr_departments WHERE id=$1',[x.department_id]);if(!d.rowCount)return res.status(400).json({success:false,message:'Select an existing department.'});}
    const r=await db.query(\`INSERT INTO hr_employees(employee_code,full_name,phone,email,department_id,designation,joining_date,status,notes,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id,employee_code,full_name,phone,email,department_id,designation,joining_date,status,notes,created_by,created_at,updated_at\`,
      [x.employee_code,x.full_name,x.phone,x.email,x.department_id,x.designation,x.joining_date,x.status,x.notes,clean(req.session?.adminUser||'admin',100)]);
    return res.status(201).json({success:true,employee:r.rows[0]});
  } catch(e){return conflict(res,e,'Unable to create employee.');}
};
exports.updateEmployee = async (req,res) => {
  const id=Number(req.params.id),x=employeeInput(req.body);
  if(!validId(id)||x.error)return res.status(400).json({success:false,message:x.error||'Invalid employee ID.'});
  try {
    if(x.department_id!==null){const d=await db.query('SELECT id FROM hr_departments WHERE id=$1',[x.department_id]);if(!d.rowCount)return res.status(400).json({success:false,message:'Select an existing department.'});}
    const r=await db.query(\`UPDATE hr_employees SET employee_code=$1,full_name=$2,phone=$3,email=$4,department_id=$5,designation=$6,joining_date=$7,status=$8,notes=$9,updated_at=NOW()
      WHERE id=$10 RETURNING id,employee_code,full_name,phone,email,department_id,designation,joining_date,status,notes,created_by,created_at,updated_at\`,
      [x.employee_code,x.full_name,x.phone,x.email,x.department_id,x.designation,x.joining_date,x.status,x.notes,id]);
    if(!r.rowCount)return res.status(404).json({success:false,message:'Employee not found.'});
    return res.json({success:true,employee:r.rows[0]});
  } catch(e){return conflict(res,e,'Unable to update employee.');}
};
exports.deleteEmployee = async (req,res) => {
  const id=Number(req.params.id);
  if(!validId(id))return res.status(400).json({success:false,message:'Invalid employee ID.'});
  try {
    const r=await db.query('DELETE FROM hr_employees WHERE id=$1 RETURNING id',[id]);
    if(!r.rowCount)return res.status(404).json({success:false,message:'Employee not found.'});
    return res.json({success:true,id});
  } catch(e){console.error('[HR] Employee delete failed:',e?.message||e);return res.status(500).json({success:false,message:'Unable to delete employee.'});}
};
