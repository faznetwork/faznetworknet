const db = require("../db");
const METHODS = new Set(["all","cash","bkash","nagad","rocket","upay"]);
const clean=(v,max=200)=>String(v??"").trim().slice(0,max);
const dateOrNull=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||""))?String(v):null;
const money=v=>Number(v||0);
async function collection(req,res){try{
 const from=dateOrNull(req.query.from),to=dateOrNull(req.query.to),method=METHODS.has(clean(req.query.method).toLowerCase())?clean(req.query.method).toLowerCase():"all";
 const params=[],where=["t.status IN ('processed','PAID')","(t.claim_flow IN ('hotspot','manual_hotspot') OR EXISTS (SELECT 1 FROM hotspot_voucher_payments hp0 WHERE hp0.transaction_id=t.id))"];
 if(from){params.push(from);where.push(`t.created_at >= $${params.length}::date`)}
 if(to){params.push(to);where.push(`t.created_at < ($${params.length}::date + INTERVAL '1 day')`)}
 if(method!=="all"){params.push(method);where.push(`LOWER(t.channel) = $${params.length}`)}
 const filter=where.join(" AND ");
 const [rows,summary]=await Promise.all([
 db.query(`SELECT t.created_at,t.matched_username,t.sender_phone,t.amount,t.channel,t.trx_id,COALESCE(c.full_name,t.matched_username,t.sender_phone,'Hotspot / walk-in') customer_name,COALESCE(c.package_name,CASE WHEN v.profile IS NOT NULL THEN 'Hotspot: '||v.profile ELSE 'Payment' END) purpose FROM transactions t LEFT JOIN customers c ON LOWER(c.username)=LOWER(t.matched_username) LEFT JOIN hotspot_vouchers v ON LOWER(v.username)=LOWER(t.matched_username) WHERE ${filter} ORDER BY t.created_at DESC,t.id DESC LIMIT 2000`,params),
 db.query(`SELECT COALESCE(SUM(t.amount),0)::numeric(14,2) total,COALESCE(SUM(t.amount) FILTER(WHERE LOWER(t.channel)='cash'),0)::numeric(14,2) cash,COALESCE(SUM(t.amount) FILTER(WHERE LOWER(t.channel)<>'cash'),0)::numeric(14,2) mfs,COUNT(*)::int count FROM transactions t WHERE ${filter}`,params)]);
 res.json({success:true,filters:{from,to,method},summary:summary.rows[0],rows:rows.rows});
 }catch(e){console.error("[Reports:collection]",e);res.status(500).json({success:false,message:"Unable to load collection report."})}}
async function due(req,res){try{
 const status=["overdue","expired","all"].includes(clean(req.query.status).toLowerCase())?clean(req.query.status).toLowerCase():"all",params=[];
 const where=["c.status NOT IN ('left','inactive')","(c.expiration_date<CURRENT_DATE OR c.expiration_date IS NULL OR LOWER(COALESCE(c.billing_status,'')) IN ('overdue','expired','unpaid'))"];
 if(req.query.package){params.push(clean(req.query.package));where.push(`c.package_name=$${params.length}`)}
 if(status==="expired")where.push("(c.expiration_date<CURRENT_DATE OR LOWER(COALESCE(c.billing_status,''))='expired')");
 if(status==="overdue")where.push("(LOWER(COALESCE(c.billing_status,'')) IN ('overdue','unpaid') OR c.expiration_date<CURRENT_DATE)");
 const [result,summary,packages]=await Promise.all([
 db.query(`SELECT c.id,c.full_name,c.username,c.phone,c.package_name,c.monthly_bill,c.expiration_date,GREATEST(0,CURRENT_DATE-COALESCE(c.expiration_date,CURRENT_DATE))::int days_overdue,c.billing_status FROM customers c WHERE ${where.join(" AND ")} ORDER BY c.expiration_date ASC NULLS FIRST,c.full_name ASC LIMIT 3000`,params),
 db.query(`SELECT COALESCE(SUM(c.monthly_bill),0)::numeric(14,2) outstanding,COUNT(*)::int subscribers FROM customers c WHERE ${where.join(" AND ")}`,params),
 db.query("SELECT DISTINCT package_name FROM customers WHERE package_name IS NOT NULL ORDER BY package_name")]);
 res.json({success:true,summary:summary.rows[0],packages:packages.rows.map(r=>r.package_name),rows:result.rows});
 }catch(e){console.error("[Reports:due]",e);res.status(500).json({success:false,message:"Unable to load due summary."})}}
async function hotspot(req,res){try{
 const from=dateOrNull(req.query.from),to=dateOrNull(req.query.to);
 const allowedSaleTypes=new Set(["all","online_mfs","scratch_card","manual","other"]);
 const saleType=allowedSaleTypes.has(clean(req.query.sale_type,24).toLowerCase())?clean(req.query.sale_type,24).toLowerCase():"all";
 const params=[],where=["t.status IN ('processed','PAID')"];
 if(from){params.push(from);where.push(`t.created_at >= $${params.length}::date`)}
 if(to){params.push(to);where.push(`t.created_at < ($${params.length}::date + INTERVAL '1 day')`)}
 if(saleType!=="all"){params.push(saleType);where.push(`COALESCE(t.sale_type,'other') = $${params.length}`)}
 const filter=where.join(" AND ");
 const [profiles,transactions,summary]=await Promise.all([
  db.query(`SELECT COALESCE(hp.profile,v.profile,'Unknown package') profile_name,COALESCE(SUM(hp.amount),0)::numeric(14,2) price,COUNT(*)::int quantity,COALESCE(SUM(hp.amount),0)::numeric(14,2) revenue FROM transactions t LEFT JOIN hotspot_voucher_payments hp ON hp.transaction_id=t.id LEFT JOIN hotspot_vouchers v ON v.id=hp.voucher_id WHERE ${filter} AND (hp.transaction_id IS NOT NULL OR t.claim_flow IN ('hotspot','manual_hotspot') OR t.matched_username IS NULL) GROUP BY COALESCE(hp.profile,v.profile,'Unknown package') ORDER BY revenue DESC,quantity DESC`,params),
  db.query(`SELECT t.sender_phone,COALESCE(hp.profile,v.profile,'Hotspot') profile,t.trx_id,t.created_at,t.amount,COALESCE(t.sale_type,'other') sale_type,t.channel FROM transactions t LEFT JOIN hotspot_voucher_payments hp ON hp.transaction_id=t.id LEFT JOIN hotspot_vouchers v ON v.id=hp.voucher_id WHERE ${filter} AND (hp.transaction_id IS NOT NULL OR t.claim_flow IN ('hotspot','manual_hotspot') OR t.matched_username IS NULL) ORDER BY t.created_at DESC,t.id DESC LIMIT 1000`,params),
  db.query(`SELECT COALESCE(SUM(t.amount),0)::numeric(14,2) earnings,COUNT(*)::int sales,COUNT(DISTINCT t.matched_username) FILTER(WHERE t.matched_username IS NOT NULL)::int users,COUNT(*) FILTER(WHERE COALESCE(t.sale_type,'other')='online_mfs')::int online_mfs_sales,COUNT(*) FILTER(WHERE COALESCE(t.sale_type,'other')='scratch_card')::int scratch_card_sales FROM transactions t WHERE ${filter}`,params)
 ]);
 res.json({success:true,filters:{from,to,sale_type:saleType},summary:summary.rows[0],profiles:profiles.rows,transactions:transactions.rows});
 }catch(e){console.error("[Reports:hotspot]",e);res.status(500).json({success:false,message:"Unable to load hotspot revenue."})}}
async function expenses(req,res){try{
 const [rows,summary,collection]=await Promise.all([
 db.query("SELECT id,title,category,amount,date,notes,created_at,created_by FROM expenses ORDER BY date DESC,id DESC LIMIT 3000"),
 db.query("SELECT COALESCE(SUM(amount) FILTER(WHERE date>=date_trunc('month',CURRENT_DATE)::date AND date<(date_trunc('month',CURRENT_DATE)+INTERVAL '1 month')::date),0)::numeric(14,2) month_expense,COALESCE(SUM(amount),0)::numeric(14,2) all_expenses FROM expenses"),
 db.query("SELECT COALESCE(SUM(amount),0)::numeric(14,2) total FROM transactions WHERE status IN ('processed','PAID') AND created_at>=date_trunc('month',CURRENT_DATE)")]);
 res.json({success:true,rows:rows.rows,summary:{...summary.rows[0],month_collection:collection.rows[0].total,net_profit:money(collection.rows[0].total)-money(summary.rows[0].month_expense)}});
 }catch(e){console.error("[Reports:expenses]",e);res.status(500).json({success:false,message:"Unable to load expense sheet."})}}
async function addExpense(req,res){try{
 const title=clean(req.body.title,160),category=clean(req.body.category,80),amount=Number(req.body.amount),date=dateOrNull(req.body.date),notes=clean(req.body.notes,2000),by=clean(req.session?.adminUser||"admin",100);
 if(!title||!category||!Number.isFinite(amount)||amount<=0||!date)return res.status(400).json({success:false,message:"Title, category, positive amount and valid date are required."});
 const r=await db.query("INSERT INTO expenses(title,category,amount,date,notes,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[title,category,amount,date,notes||null,by]);res.status(201).json({success:true,expense:r.rows[0]});
 }catch(e){console.error("[Reports:addExpense]",e);res.status(500).json({success:false,message:"Unable to save expense."})}}
async function updateExpense(req,res){try{
 const id=Number(req.params.id),title=clean(req.body.title,160),category=clean(req.body.category,80),amount=Number(req.body.amount),date=dateOrNull(req.body.date),notes=clean(req.body.notes,2000);
 if(!Number.isSafeInteger(id)||id<1||!title||!category||!Number.isFinite(amount)||amount<=0||!date)return res.status(400).json({success:false,message:"Valid expense fields are required."});
 const r=await db.query("UPDATE expenses SET title=$1,category=$2,amount=$3,date=$4,notes=$5 WHERE id=$6 RETURNING *",[title,category,amount,date,notes||null,id]);
 if(!r.rowCount)return res.status(404).json({success:false,message:"Expense not found."});res.json({success:true,expense:r.rows[0]});
 }catch(e){console.error("[Reports:updateExpense]",e);res.status(500).json({success:false,message:"Unable to update expense."})}}
async function deleteExpense(req,res){try{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({success:false,message:"Invalid expense ID."});const r=await db.query("DELETE FROM expenses WHERE id=$1 RETURNING id",[id]);if(!r.rowCount)return res.status(404).json({success:false,message:"Expense not found."});res.json({success:true,id})}catch(e){console.error("[Reports:deleteExpense]",e);res.status(500).json({success:false,message:"Unable to delete expense."})}}
module.exports={collection,due,hotspot,expenses,addExpense,updateExpense,deleteExpense};
