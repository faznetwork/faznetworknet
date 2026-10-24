const db = require("../db");
const mikrotik = require("../services/mikrotikService");

let cache = null;
let cacheAt = 0;
let inflight = null;

const safe = (task, fallback) => Promise.resolve().then(task).catch(error => {
  console.warn("[Dashboard Stats]", error.message || error);
  return fallback;
});
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;

async function collect(iface) {
  const [router, data] = await Promise.all([
    safe(async () => {
      const [resources, interfaces, sessions, identity] = await Promise.all([
        mikrotik.getSystemResources(),
        mikrotik.getInterfaces(),
        mikrotik.getActiveSessions(),
        mikrotik.testConnection()
      ]);
      return { resources, interfaces, sessions, identity };
    }, { resources: null, interfaces: [], sessions: [], identity: null }),
    safe(async () => {
      const results = await Promise.all([
        db.query("SELECT COUNT(*)::int AS total FROM customers WHERE status NOT IN ('left','inactive')"),
        db.query("SELECT COALESCE(SUM(amount),0) AS amount,COUNT(*)::int AS count FROM transactions WHERE created_at >= ((NOW() AT TIME ZONE 'Asia/Dhaka')::date::timestamp AT TIME ZONE 'Asia/Dhaka') AND created_at < (((NOW() AT TIME ZONE 'Asia/Dhaka')::date+1)::timestamp AT TIME ZONE 'Asia/Dhaka') AND (LOWER(status) IN ('processed','paid','success') OR used=TRUE)"),
        db.query("SELECT COALESCE(SUM(amount),0) AS amount FROM transactions WHERE created_at >= (date_trunc('month',NOW() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka') AND (LOWER(status) IN ('processed','paid','success') OR used=TRUE)"),
        db.query("SELECT c.id,c.full_name,c.username,c.phone,c.package_name,c.monthly_bill,c.expiration_date,GREATEST(0,EXTRACT(EPOCH FROM (((c.expiration_date+1)::timestamp AT TIME ZONE 'Asia/Dhaka')-NOW()))/3600) AS hours_remaining FROM customers c WHERE c.expiration_date >= (NOW() AT TIME ZONE 'Asia/Dhaka')::date AND c.expiration_date <= (NOW() AT TIME ZONE 'Asia/Dhaka')::date+2 AND c.status NOT IN ('left','inactive') ORDER BY c.expiration_date,c.full_name LIMIT 50"),
        db.query("SELECT trx_id,channel,amount,status,created_at FROM transactions ORDER BY created_at DESC LIMIT 5")
      ]);
      return {
        customers: results[0].rows[0] || {},
        today: results[1].rows[0] || {},
        mtd: results[2].rows[0] || {},
        expiring: results[3].rows || [],
        recent: results[4].rows || []
      };
    }, { customers: {}, today: {}, mtd: {}, expiring: [], recent: [] })
  ]);

  const sessions = Array.isArray(router.sessions) ? router.sessions : [];
  const total = n(data.customers.total);
  const online = sessions.length;
  const interfaces = Array.isArray(router.interfaces) ? router.interfaces : [];
  const names = iface === "aggregate"
    ? interfaces.filter(item => item.running && !item.disabled && /^(ether|sfp|sfp-sfpplus|sfpplus|lte)/i.test(item.name) && !/pppoe|loopback/i.test(item.name))
        .slice(0, 8).map(item => item.name)
    : [iface];
  let rx = 0;
  let tx = 0;
  let available = false;
  await Promise.all(names.map(async name => {
    const traffic = await safe(() => mikrotik.getInterfaceTraffic(name), null);
    if (traffic) {
      rx += n(traffic.rxBitsPerSecond);
      tx += n(traffic.txBitsPerSecond);
      available = true;
    }
  }));

  const resources = router.resources;
  return {
    success: true,
    generatedAt: new Date().toISOString(),
    subscribers: {
      total,
      online,
      offline: Math.max(0, total - online),
      availability: total ? online / total * 100 : 0
    },
    traffic: {
      interface: iface,
      rxMbps: Number((rx / 1e6).toFixed(3)),
      txMbps: Number((tx / 1e6).toFixed(3)),
      available,
      transferredTodayLabel: "Router byte counters unavailable"
    },
    router: {
      online: Boolean(resources),
      model: resources?.boardName || resources?.platform || router.identity?.model || "RouterOS device",
      uptime: resources?.uptime || "unavailable",
      cpuLoad: resources ? n(resources.cpuLoad) : null,
      memoryUsagePercent: resources ? n(resources.memoryUsagePercent) : null
    },
    billing: {
      todayAmount: n(data.today.amount),
      todayTransactions: n(data.today.count),
      mtdAmount: n(data.mtd.amount)
    },
    expiring: data.expiring.map(row => ({
      id: row.id,
      fullName: row.full_name,
      username: row.username,
      phone: row.phone,
      packageName: row.package_name,
      price: n(row.monthly_bill),
      expirationDate: row.expiration_date ? String(row.expiration_date).slice(0, 10) : null,
      hoursRemaining: n(row.hours_remaining)
    })),
    recentPayments: data.recent
  };
}

exports.stats = async (req, res) => {
  res.set("Cache-Control", "private, max-age=2, stale-while-revalidate=5");
  const iface = String(req.query.interface || "aggregate").trim().slice(0, 100) || "aggregate";
  if (cache && Date.now() - cacheAt < 5000 && cache.iface === iface) return res.json(cache.payload);
  if (!inflight) {
    inflight = collect(iface).then(payload => {
      cache = { iface, payload };
      cacheAt = Date.now();
      return payload;
    }).catch(error => {
      console.error("[Dashboard Stats]", error.message || error);
      return cache?.payload || { success: false, message: "Dashboard metrics unavailable" };
    }).finally(() => { inflight = null; });
  }
  const fallback = cache?.payload || {
    success: true,
    generatedAt: new Date().toISOString(),
    subscribers: { total: 0, online: 0, availability: 0 },
    traffic: { interface: iface, rxMbps: 0, txMbps: 0, available: false },
    router: { online: false },
    billing: { todayAmount: 0, todayTransactions: 0, mtdAmount: 0 },
    expiring: [],
    recentPayments: []
  };
  return res.json(await Promise.race([
    inflight,
    new Promise(resolve => setTimeout(() => resolve(fallback), 1500))
  ]));
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
