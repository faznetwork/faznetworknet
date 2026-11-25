const db=require("../db"),mikrotik=require("../services/mikrotikService"),prober=require("../services/routerStatusProber");let cache=null,cacheAt=0,composing=null;const safe=(f,d)=>Promise.resolve().then(f).catch(e=>{console.warn("[Dashboard Stats]",e.message||e);return d;}),n=v=>Number.isFinite(Number(v))?Number(v):0;
async function collectDbPart(){
  const querySafe=(label,sql,params,fallback)=>safe(async()=>{
    try{return await db.query(sql,params);}
    catch(error){throw new Error(label+": "+(error?.message||error));}
  },fallback);

  // Isolate each source so an unrelated/retired telemetry query cannot zero
  // otherwise healthy subscriber or billing metrics.
  const [customerResult,todayResult,mtdResult,expiringResult,recentResult]=await Promise.all([
    querySafe("Customer count query","SELECT username FROM customers WHERE status NOT IN ('left','inactive')",[],null),
    querySafe("Today's payment totals query","SELECT COALESCE(SUM(amount),0) AS amount,COUNT(*)::int AS count FROM transactions WHERE created_at >= ((NOW() AT TIME ZONE 'Asia/Dhaka')::date::timestamp AT TIME ZONE 'Asia/Dhaka') AND created_at < (((NOW() AT TIME ZONE 'Asia/Dhaka')::date+1)::timestamp AT TIME ZONE 'Asia/Dhaka') AND (LOWER(status) IN ('processed','paid','success') OR used=TRUE)",[],{rows:[{amount:0,count:0}]}),
    querySafe("Month-to-date payment totals query","SELECT COALESCE(SUM(amount),0) AS amount FROM transactions WHERE created_at >= (date_trunc('month',NOW() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka') AND (LOWER(status) IN ('processed','paid','success') OR used=TRUE)",[],{rows:[{amount:0}]}),
    querySafe("Expiring customer query","SELECT c.id,c.full_name,c.username,c.phone,c.package_name,c.monthly_bill,c.expiration_date,GREATEST(0,EXTRACT(EPOCH FROM (((c.expiration_date+1)::timestamp AT TIME ZONE 'Asia/Dhaka')-clock.now_at))/3600) AS hours_remaining FROM customers c CROSS JOIN (SELECT NOW() AS now_at) clock WHERE c.status NOT IN ('left','inactive') AND ((c.expiration_date+1)::timestamp AT TIME ZONE 'Asia/Dhaka')>clock.now_at AND ((c.expiration_date+1)::timestamp AT TIME ZONE 'Asia/Dhaka')<=clock.now_at+INTERVAL '48 hours' ORDER BY c.expiration_date,c.full_name LIMIT 50",[],{rows:[]}),
    querySafe("Recent payment query","SELECT trx_id,channel,amount,status,created_at FROM transactions ORDER BY created_at DESC LIMIT 5",[],{rows:[]})
  ]);
  return {customerResult,todayResult,mtdResult,expiringResult,recentResult};
}

function buildStatsPayload(snapshot,dbPart,iface){
  const {customerResult,todayResult,mtdResult,expiringResult,recentResult}=dbPart;
  // Router data only counts while the background prober says the router is
  // online. A stale last-known-good snapshot is never presented as live:
  // while Checking or Offline the router fields stay empty and the
  // subscriber list is reported unavailable, never "0 online".
  const routerData=snapshot&&snapshot.state==="online"?snapshot.data:null;
  const resources=routerData?routerData.resources:null;
  const identity=routerData?routerData.identity:null;
  const interfaces=Array.isArray(routerData?routerData.interfaces:null)?routerData.interfaces:[];
  const activeSessionResult=Array.isArray(routerData?routerData.sessions:null)?routerData.sessions:null;

  const customerRows=Array.isArray(customerResult?.rows)?customerResult.rows:null;
  const sessions=Array.isArray(activeSessionResult)?activeSessionResult:[];
  const customersAvailable=Array.isArray(customerRows);
  const sessionsAvailable=Array.isArray(activeSessionResult);
  const customerNames=new Set((customerRows||[]).map(row=>String(row?.username||"").trim().toLowerCase()).filter(Boolean));
  const onlineNames=new Set(sessions.map(session=>String(session?.username||session?.name||"").trim().toLowerCase()).filter(username=>username&&customerNames.has(username)));
  const total=customerNames.size;
  const online=onlineNames.size;
  const subscribersAvailable=customersAvailable&&sessionsAvailable;

  const ifs=Array.isArray(interfaces)?interfaces:[];
  const names=iface==="aggregate"
    ?ifs.filter(x=>x.running&&!x.disabled&&/^(ether|sfp|sfp-sfpplus|sfpplus|lte)/i.test(x.name)&&!/pppoe|loopback/i.test(x.name)).slice(0,8).map(x=>x.name)
    :[iface];
  let rx=0,tx=0,available=false;
  for(const name of names){
    const traffic=routerData&&routerData.trafficByInterface?routerData.trafficByInterface[name]:null;
    if(traffic){rx+=n(traffic.rxBitsPerSecond);tx+=n(traffic.txBitsPerSecond);available=true;}
  }

  const res=resources;
  return{
    success:true,
    generatedAt:new Date().toISOString(),
    routerStatus:{state:snapshot?snapshot.state:"checking",lastSeenAt:snapshot?snapshot.lastSeenAt:null,ageMs:snapshot?snapshot.ageMs:null},
    subscribers:{
      total,
      online,
      offline:Math.max(0,total-online),
      availability:subscribersAvailable&&total>0?online/total*100:0,
      available:subscribersAvailable
    },
    traffic:{interface:iface,rxMbps:Number((rx/1e6).toFixed(3)),txMbps:Number((tx/1e6).toFixed(3)),available,transferredTodayLabel:"Router byte counters unavailable"},
    router:{online:snapshot?snapshot.online:null,model:res?.boardName||res?.platform||identity?.model||"RouterOS device",uptime:res?.uptime||"unavailable",cpuLoad:res?n(res.cpuLoad):null,memoryUsagePercent:res?n(res.memoryUsagePercent):null},
    billing:{todayAmount:n(todayResult?.rows?.[0]?.amount),todayTransactions:n(todayResult?.rows?.[0]?.count),mtdAmount:n(mtdResult?.rows?.[0]?.amount)},
    // OLT/ONU telemetry was retired; preserve the response shape for existing UI consumers.
    fiber:{total:0,online:0,warnings:0,lowSignalCount:0,activePonPorts:0,totalPonPorts:4,oltOnline:false,lastSeen:null,oltId:null,oltName:"V-SOL V1600D4",oltAddress:null,urgent:[]},
    expiring:(expiringResult?.rows||[]).map(x=>({id:x.id,fullName:x.full_name,username:x.username,phone:x.phone,packageName:x.package_name,price:n(x.monthly_bill),expirationDate:x.expiration_date?String(x.expiration_date).slice(0,10):null,hoursRemaining:n(x.hours_remaining)})),
    recentPayments:recentResult?.rows||[]
  };
}

function fallbackPayload(snapshot,iface){
  return{
    success:true,
    generatedAt:new Date().toISOString(),
    routerStatus:{state:snapshot?snapshot.state:"checking",lastSeenAt:snapshot?snapshot.lastSeenAt:null,ageMs:snapshot?snapshot.ageMs:null},
    subscribers:{total:0,online:0,offline:0,availability:0,available:false},
    traffic:{interface:iface,rxMbps:0,txMbps:0,available:false,transferredTodayLabel:"Router byte counters unavailable"},
    router:{online:snapshot?snapshot.online:null,model:"RouterOS device",uptime:"unavailable",cpuLoad:null,memoryUsagePercent:null},
    billing:{todayAmount:0,todayTransactions:0,mtdAmount:0},
    fiber:{total:0,online:0,warnings:0,lowSignalCount:0,activePonPorts:0,totalPonPorts:4,oltOnline:false,lastSeen:null,oltId:null,oltName:"V-SOL V1600D4",oltAddress:null,urgent:[]},
    expiring:[],recentPayments:[]
  };
}

// The router portion of this response comes from the background prober's
// in-memory cache (services/routerStatusProber.js), never from a fresh
// probe: a slow datacenter-to-router path must never make a healthy
// router look Offline. The database portion is still read fresh on every
// uncached poll, and the composed payload is cached for 5 s like before.
exports.stats=async(req,res)=>{
  res.set("Cache-Control","private, max-age=2, stale-while-revalidate=5");
  const iface=String(req.query.interface||"aggregate").trim().slice(0,100)||"aggregate";
  if(cache&&Date.now()-cacheAt<5000&&cache.iface===iface)return res.json(cache.payload);
  if(!composing){
    composing=(async()=>{
      try{
        const snapshot=prober.getRouterStatusSnapshot();
        const dbPart=await collectDbPart();
        const payload=buildStatsPayload(snapshot,dbPart,iface);
        cache={iface,payload};cacheAt=Date.now();
        return payload;
      }catch(error){
        console.error("[Dashboard Stats]",error.message||error);
        return fallbackPayload(prober.getRouterStatusSnapshot(),iface);
      }finally{composing=null;}
    })();
  }
  return res.json(await composing);
};

exports.businessOverview=async(_req,res)=>{
  res.set("Cache-Control","private, max-age=30, stale-while-revalidate=60");
  try{
    const [financial,customers,hotspot,infrastructure,operations]=await Promise.all([
      db.query(`WITH clock AS (SELECT (NOW() AT TIME ZONE 'Asia/Dhaka')::date AS today),
        paid AS (SELECT COALESCE(SUM(t.amount),0)::numeric(14,2) AS total_income,
        COALESCE(SUM(t.amount) FILTER (WHERE t.created_at >= ((c.today-6)::timestamp AT TIME ZONE 'Asia/Dhaka') AND t.created_at < ((c.today+1)::timestamp AT TIME ZONE 'Asia/Dhaka')),0)::numeric(14,2) AS weekly_income,
        COALESCE(SUM(t.amount) FILTER (WHERE t.created_at >= date_trunc('month',c.today::timestamp) AT TIME ZONE 'Asia/Dhaka' AND t.created_at < ((c.today+1)::timestamp AT TIME ZONE 'Asia/Dhaka')),0)::numeric(14,2) AS monthly_income,
        COALESCE(SUM(t.amount) FILTER (WHERE t.created_at >= date_trunc('year',c.today::timestamp) AT TIME ZONE 'Asia/Dhaka' AND t.created_at < ((c.today+1)::timestamp AT TIME ZONE 'Asia/Dhaka')),0)::numeric(14,2) AS yearly_income,
        COALESCE(SUM(t.amount) FILTER (WHERE t.created_at >= (c.today::timestamp AT TIME ZONE 'Asia/Dhaka') AND t.created_at < ((c.today+1)::timestamp AT TIME ZONE 'Asia/Dhaka')),0)::numeric(14,2) AS today_collection
        FROM transactions t CROSS JOIN clock c WHERE LOWER(t.status) IN ('processed','paid','success') OR t.used=TRUE),
        due AS (SELECT COALESCE(SUM(cu.monthly_bill),0)::numeric(14,2) AS outstanding_due,COUNT(*)::int AS due_accounts FROM customers cu CROSS JOIN clock c WHERE cu.status='active' AND (COALESCE(cu.billing_status,'unpaid')<>'paid' OR cu.paid_until IS NULL OR cu.paid_until<c.today))
        SELECT paid.*,due.* FROM paid CROSS JOIN due`),
      db.query(`SELECT COUNT(*)::int AS total_pppoe,
        COUNT(*) FILTER (WHERE status='active')::int AS active_pppoe,
        COUNT(*) FILTER (WHERE status='active' AND (expiration_date IS NULL OR expiration_date >= (NOW() AT TIME ZONE 'Asia/Dhaka')::date))::int AS active_pppoe_current
        FROM customers`),
      db.query(`SELECT COUNT(*) FILTER (WHERE status='active' AND (expires_at IS NULL OR expires_at>NOW()))::int AS active_hotspot,
        COUNT(*)::int AS total_hotspot FROM hotspot_vouchers`),
      db.query(`SELECT (SELECT COUNT(*)::int FROM pops WHERE status='active' AND reseller_id IS NOT NULL) AS active_pops,
        (SELECT COUNT(*)::int FROM resellers WHERE status='active') AS active_resellers,
        (SELECT COUNT(*)::int FROM hr_employees WHERE status='active') AS active_staff`),
      db.query(`WITH clock AS (SELECT NOW() AS now_at, (NOW() AT TIME ZONE 'Asia/Dhaka')::date AS today)
        SELECT (SELECT COUNT(*)::int FROM customers cu CROSS JOIN clock c WHERE cu.status='active' AND cu.expiration_date BETWEEN c.today AND c.today+1) AS expiring_soon,
        (SELECT COUNT(*)::int FROM hotspot_vouchers v CROSS JOIN clock c WHERE v.status='active' AND v.expires_at>c.now_at AND v.expires_at<=c.now_at+INTERVAL '48 hours') AS expiring_hotspot,
        (SELECT COUNT(*)::int FROM support_tickets WHERE status IN ('open','in_progress')) AS open_tickets`)
    ]);
    const f=financial.rows[0]||{},c=customers.rows[0]||{},h=hotspot.rows[0]||{},i=infrastructure.rows[0]||{},o=operations.rows[0]||{};
    return res.json({success:true,generatedAt:new Date().toISOString(),financial:{totalIncome:Number(f.total_income||0),weeklyIncome:Number(f.weekly_income||0),monthlyIncome:Number(f.monthly_income||0),yearlyIncome:Number(f.yearly_income||0),todayCollection:Number(f.today_collection||0),outstandingDue:Number(f.outstanding_due||0),dueAccounts:Number(f.due_accounts||0)},customers:{activePppoe:Number(c.active_pppoe_current||0),totalPppoe:Number(c.total_pppoe||0),activeHotspot:Number(h.active_hotspot||0),totalHotspot:Number(h.total_hotspot||0)},infrastructure:{activePops:Number(i.active_pops||0),activeResellers:Number(i.active_resellers||0),activeStaff:Number(i.active_staff||0)},operations:{expiringSoon:Number(o.expiring_soon||0)+Number(o.expiring_hotspot||0),openTickets:Number(o.open_tickets||0)}});
  }catch(error){console.error('[Dashboard Business Overview]',error?.message||error);return res.status(503).json({success:false,message:'Business overview is temporarily unavailable.'});}
};

/**
 * Database-only Hotspot dashboard overview. This handler is intentionally read-only:
 * no RouterOS calls, writes, provisioning, or mutations to live subscriber/payment data.
 */
exports.hotspotOverview=async(req,res)=>{
  const filter=String(req.query?.filter||"").trim().toLowerCase();
  const allowed=["today","yesterday","last7days","thismonth","last30days","thisyear"];
  if(filter&&!allowed.includes(filter))return res.status(400).json({success:false,message:"Invalid recharge period filter."});
  const periodSql={
    today:"s.created_at >= (c.today::timestamp AT TIME ZONE 'Asia/Dhaka') AND s.created_at < ((c.today + 1)::timestamp AT TIME ZONE 'Asia/Dhaka')",
    yesterday:"s.created_at >= ((c.today - 1)::timestamp AT TIME ZONE 'Asia/Dhaka') AND s.created_at < (c.today::timestamp AT TIME ZONE 'Asia/Dhaka')",
    last7days:"s.created_at >= ((c.today - 6)::timestamp AT TIME ZONE 'Asia/Dhaka') AND s.created_at < ((c.today + 1)::timestamp AT TIME ZONE 'Asia/Dhaka')",
    thismonth:"s.created_at >= (date_trunc('month',c.today::timestamp) AT TIME ZONE 'Asia/Dhaka') AND s.created_at < ((c.today + 1)::timestamp AT TIME ZONE 'Asia/Dhaka')",
    last30days:"s.created_at >= ((c.today - 29)::timestamp AT TIME ZONE 'Asia/Dhaka') AND s.created_at < ((c.today + 1)::timestamp AT TIME ZONE 'Asia/Dhaka')",
    thisyear:"s.created_at >= (date_trunc('year',c.today::timestamp) AT TIME ZONE 'Asia/Dhaka') AND s.created_at < ((c.today + 1)::timestamp AT TIME ZONE 'Asia/Dhaka')"
  };
  try{
    const [countsResult,totalsResult,customersResult,rechargesResult,routerUsersResult,activeSessionsResult]=await Promise.all([
      db.query("SELECT username,status,expires_at FROM hotspot_vouchers WHERE NULLIF(BTRIM(username),'') IS NOT NULL"),
      db.query("WITH clock AS (SELECT (NOW() AT TIME ZONE 'Asia/Dhaka')::date AS today),sales AS (SELECT t.id AS transaction_id,t.amount,t.created_at FROM transactions t INNER JOIN hotspot_vouchers v ON LOWER(v.username)=LOWER(t.matched_username) WHERE LOWER(t.status) IN ('processed','paid','success') UNION SELECT a.transaction_id,a.amount,a.created_at FROM hotspot_voucher_sales_archive a WHERE LOWER(a.status) IN ('processed','paid','success') AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id=a.transaction_id)) SELECT COALESCE(SUM(s.amount) FILTER (WHERE s.created_at >= (c.today::timestamp AT TIME ZONE 'Asia/Dhaka') AND s.created_at < ((c.today+1)::timestamp AT TIME ZONE 'Asia/Dhaka')),0)::numeric(12,2) AS today,COALESCE(SUM(s.amount) FILTER (WHERE s.created_at >= ((c.today-1)::timestamp AT TIME ZONE 'Asia/Dhaka') AND s.created_at < (c.today::timestamp AT TIME ZONE 'Asia/Dhaka')),0)::numeric(12,2) AS yesterday,COALESCE(SUM(s.amount) FILTER (WHERE s.created_at >= ((c.today-6)::timestamp AT TIME ZONE 'Asia/Dhaka') AND s.created_at < ((c.today+1)::timestamp AT TIME ZONE 'Asia/Dhaka')),0)::numeric(12,2) AS last7days,COALESCE(SUM(s.amount) FILTER (WHERE s.created_at >= (date_trunc('month',c.today::timestamp) AT TIME ZONE 'Asia/Dhaka') AND s.created_at < ((c.today+1)::timestamp AT TIME ZONE 'Asia/Dhaka')),0)::numeric(12,2) AS thismonth,COALESCE(SUM(s.amount) FILTER (WHERE s.created_at >= ((c.today-29)::timestamp AT TIME ZONE 'Asia/Dhaka') AND s.created_at < ((c.today+1)::timestamp AT TIME ZONE 'Asia/Dhaka')),0)::numeric(12,2) AS last30days,COALESCE(SUM(s.amount) FILTER (WHERE s.created_at >= (date_trunc('year',c.today::timestamp) AT TIME ZONE 'Asia/Dhaka') AND s.created_at < ((c.today+1)::timestamp AT TIME ZONE 'Asia/Dhaka')),0)::numeric(12,2) AS thisyear FROM sales s CROSS JOIN clock c"),
      db.query("SELECT username,phone,profile,status,created_at FROM hotspot_vouchers ORDER BY created_at DESC,id DESC LIMIT 8"),
      filter
        ? db.query("WITH clock AS (SELECT (NOW() AT TIME ZONE 'Asia/Dhaka')::date AS today),sales AS (SELECT t.id AS transaction_id,t.matched_username,v.profile,t.amount,t.channel,t.trx_id,t.created_at FROM transactions t INNER JOIN hotspot_vouchers v ON LOWER(v.username)=LOWER(t.matched_username) WHERE LOWER(t.status) IN ('processed','paid','success') UNION ALL SELECT a.transaction_id,a.matched_username,COALESCE(v.profile,'Archived voucher') AS profile,a.amount,a.channel,a.trx_id,a.created_at FROM hotspot_voucher_sales_archive a LEFT JOIN hotspot_vouchers v ON LOWER(v.username)=LOWER(a.matched_username) WHERE LOWER(a.status) IN ('processed','paid','success') AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id=a.transaction_id)) SELECT s.matched_username,s.profile,s.amount,s.channel,s.trx_id,s.created_at FROM sales s CROSS JOIN clock c WHERE "+periodSql[filter]+" ORDER BY s.created_at DESC,s.transaction_id DESC LIMIT 200")
        : db.query("WITH sales AS (SELECT t.id AS transaction_id,t.matched_username,v.profile,t.amount,t.channel,t.trx_id,t.created_at FROM transactions t INNER JOIN hotspot_vouchers v ON LOWER(v.username)=LOWER(t.matched_username) WHERE LOWER(t.status) IN ('processed','paid','success') UNION ALL SELECT a.transaction_id,a.matched_username,COALESCE(v.profile,'Archived voucher') AS profile,a.amount,a.channel,a.trx_id,a.created_at FROM hotspot_voucher_sales_archive a LEFT JOIN hotspot_vouchers v ON LOWER(v.username)=LOWER(a.matched_username) WHERE LOWER(a.status) IN ('processed','paid','success') AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id=a.transaction_id)) SELECT matched_username,profile,amount,channel,trx_id,created_at FROM sales ORDER BY created_at DESC,transaction_id DESC LIMIT 8"),
      safe(()=>mikrotik.getHotspotUsers(),[]),
      safe(()=>mikrotik.getActiveHotspotSessions(),[])
    ]);
    const totals=totalsResult.rows?.[0]||{};
    const voucherUsers=countsResult.rows||[];
    const routerUsers=Array.isArray(routerUsersResult)?routerUsersResult:[];
    const activeSessions=Array.isArray(activeSessionsResult)?activeSessionsResult:[];
    const usernames=new Set();
    for(const user of [...voucherUsers,...routerUsers]){
      const username=String(user?.username||'').trim().toLowerCase();
      if(username&&username!=='default-trial')usernames.add(username);
    }
    const activeNames=new Set(activeSessions.map(session=>String(session?.username||'').trim().toLowerCase()).filter(username=>username&&username!=='default-trial'));
    const now=Date.now();
    const expiredNames=new Set(voucherUsers.filter(user=>{
      const status=String(user.status||'').toLowerCase();
      const expiry=user.expires_at?new Date(user.expires_at).getTime():null;
      return status==='expired'||(status==='active'&&expiry!==null&&Number.isFinite(expiry)&&expiry<=now);
    }).map(user=>String(user.username||'').trim().toLowerCase()).filter(Boolean));
    const recentCustomers=customersResult.rows||[],filteredRecharges=rechargesResult.rows||[];
    return res.json({
      success:true,
      generatedAt:new Date().toISOString(),
      counts:{totalUsers:usernames.size,activeUsers:activeNames.size,expiredUsers:expiredNames.size},
      rechargeTotals:{today:Number(totals.today||0),yesterday:Number(totals.yesterday||0),last7days:Number(totals.last7days||0),thismonth:Number(totals.thismonth||0),last30days:Number(totals.last30days||0),thisyear:Number(totals.thisyear||0)},
      recentCustomers,
      recentRecharges:filter?[]:filteredRecharges,
      filter:filter||"recent",
      filteredRecharges
    });
  }catch(error){
    console.error("[Dashboard Hotspot Overview]",error?.message||error);
    return res.status(503).json({success:false,message:"Hotspot dashboard overview is temporarily unavailable."});
  }
};
