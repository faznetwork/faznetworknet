const db=require("../db");
const mikrotikService=require("../services/mikrotikService");

const clean=(v,m=255)=>String(v??"").trim().slice(0,m);
const isSystemProfile=(value)=>{const name=String(value??"").trim().toLowerCase();return !name||name.includes("default")||name==="vpn"||/^(?:template|internal|system)(?:[-_\\s].*)?$/.test(name);};
const routerError=(e)=>String(e?.message||e||"Package operation failed.");

// --- remote-address resolution (plan sync) ---
// A /ppp profile remote-address is either an /ip pool name or a static IPv4
// address. The panel used to send whatever the packages row held, so a pool
// that was renamed or deleted on the router (e.g. "PPPoE_Pool", "150 Mbps")
// made every sync fail with RouterOS "input does not match any value of
// pool". These helpers validate the value against the router's LIVE pool list
// before anything is sent.
function isValidIpv4(value){
  const parts=String(value||"").trim().split(".");
  if(parts.length!==4)return false;
  return parts.every(part=>/^\d{1,3}$/.test(part)&&Number(part)>=0&&Number(part)<=255);
}
function isValidPoolRanges(value){
  const ranges=String(value||"").trim();
  if(!ranges)return false;
  return ranges.split(",").every(part=>{
    const item=part.trim();
    if(/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/.test(item)){
      const [ip,prefix]=item.split("/");
      return isValidIpv4(ip)&&Number(prefix)>=0&&Number(prefix)<=32;
    }
    const match=item.match(/^(\d{1,3}(?:\.\d{1,3}){3})-(\d{1,3}(?:\.\d{1,3}){3})$/);
    if(!match)return false;
    if(!isValidIpv4(match[1])||!isValidIpv4(match[2]))return false;
    const toNum=ip=>ip.split(".").reduce((total,octet)=>total*256+Number(octet),0);
    return toNum(match[1])<=toNum(match[2]);
  });
}
function resolveRemoteAddress(value,livePools){
  const raw=String(value??"").trim();
  if(!raw)return{kind:"empty",name:""};
  const pools=Array.isArray(livePools)?livePools:[];
  const match=pools.find(x=>String(x.name||"").toLowerCase()===raw.toLowerCase());
  if(match)return{kind:"pool",name:String(match.name)};
  if(isValidIpv4(raw))return{kind:"ip",name:raw};
  return{kind:"missing",name:raw};
}
// Every pool in this deployment is a /24 "<base>.2-<base>.254" range behind a
// "<base>.1" local address (200 Mbps, 400_Hotspot, Expire_Pool). Derive the
// same range for a missing pool from the plan's own local address; null when
// no /24 can be derived, so the caller fails loudly instead of guessing.
function derivePoolRangeFromLocalAddress(localAddress){
  const ip=String(localAddress||"").trim();
  if(!isValidIpv4(ip))return null;
  const octets=ip.split(".");
  if(Number(octets[3])<1||Number(octets[3])>254)return null;
  const base=octets.slice(0,3).join(".");
  return base+".2-"+base+".254";
}

function errorResponse(res,e,status=503){
  console.error("[PACKAGE API]",e);
  return res.status(status).json({success:false,message:routerError(e)});
}

async function pools(req,res){
  try{
    const rows=await mikrotikService.getIpPools();
    res.json({success:true,pools:rows.filter(x=>!/^default(?:[-_].*)?$/i.test(x.name))});
  }catch(e){errorResponse(res,e);}
}

function decorate(row,poolMap){
  const pool=poolMap.get(String(row.pool_name||"").toLowerCase());
  return {
    ...row,
    name:row.plan_name,
    profile:row.profile_name,
    poolName:row.pool_name,
    poolRanges:pool?.ranges||"",
    pool_ranges:pool?.ranges||"",
    localAddress:row.local_address||"",
    remoteAddress:row.remote_address||"",
    dnsServer:row.dns_server||"",
    changeTcpMss:row.change_tcp_mss||"default"
  };
}

async function list(req,res){
  try{
    const [result,routerPools]=await Promise.all([db.query("SELECT * FROM packages WHERE LOWER(COALESCE(profile_name,plan_name,'')) NOT LIKE '%default%' AND LOWER(COALESCE(profile_name,plan_name,'')) <> 'vpn' AND LOWER(COALESCE(profile_name,plan_name,'')) NOT LIKE 'template%' AND LOWER(COALESCE(profile_name,plan_name,'')) NOT LIKE 'internal%' AND LOWER(COALESCE(profile_name,plan_name,'')) NOT LIKE 'system%' ORDER BY plan_name"),mikrotikService.getIpPools()]);
    const poolMap=new Map(routerPools.map(x=>[String(x.name).toLowerCase(),x]));
    res.json({success:true,packages:result.rows.map(row=>decorate(row,poolMap))});
  }catch(e){errorResponse(res,e);}
}

async function normalize(body){
  const b=body||{};
  const value={
    planName:clean(b.planName,120),
    price:Number(b.price),
    durationMonths:Number.parseInt(b.durationMonths??1,10),
    rateLimit:clean(b.rateLimit,100),
    localAddress:clean(b.localAddress,255),
    remoteAddress:clean(b.remoteAddress,255),
    dnsServer:clean(b.dnsServer,255),
    changeTcpMss:clean(b.changeTcpMss||"default",20).toLowerCase()
  };
  if(!value.planName)return{error:"Plan Name is required."};
  if(isSystemProfile(value.planName))return{error:"System/internal MikroTik profiles are protected and cannot be used as internet plans."};
  if(!Number.isFinite(value.price)||value.price<=0)return{error:"Exact Monthly Price must be greater than 0."};
  if(!Number.isInteger(value.durationMonths)||value.durationMonths<1)return{error:"Duration must be at least 1 month."};
  if(!["yes","no","default"].includes(value.changeTcpMss))return{error:"Change TCP MSS must be yes, no, or default."};
  if(value.remoteAddress){
    const pools=await mikrotikService.getIpPools();
    const pool=pools.find(x=>String(x.name).toLowerCase()===value.remoteAddress.toLowerCase());
    if(pool)value.remoteAddress=pool.name;
    // A pool name the router does not have (renamed/deleted) used to be saved
    // silently and then fail every later sync with a cryptic RouterOS error.
    // A static IPv4 address is still a valid remote-address, so allow it.
    else if(!isValidIpv4(value.remoteAddress))return{error:`IP pool "${value.remoteAddress}" does not exist on the router. Create it in IP Pools first, or pick an existing pool.`};
  }
  return{value};
}

async function findProfileByName(name){
  const profiles=await mikrotikService.fetchExistingProfiles();
  return profiles.find(x=>String(x.name).toLowerCase()===String(name||"").toLowerCase())||null;
}

// Push one panel plan to the router as a /ppp profile. `context` lets the
// bulk sync pass the live pool list, the panel's saved ip_pools and the
// already-found profile so the router is not re-queried per plan; the
// single-plan save path omits it and the lookups happen here.
// Remote-address handling for a pool name the router no longer has:
//  - profile already exists -> keep the router's current remote-address
//    (the working value) instead of failing the whole sync, and warn;
//  - profile is new -> create the missing pool first (from the panel's saved
//    ip_pools record when one exists, else a /24 range derived from the
//    plan's local address), then create the profile.
// Returns the service result plus a `warning` string when one applies.
async function syncMikrotikProfile(value,previousProfileName="",context={}){
  const target=context.target||await findProfileByName(value.planName);
  const oldName=clean(previousProfileName,120);
  const previous=(target||(!target&&oldName&&oldName.toLowerCase()!==value.planName.toLowerCase()?await findProfileByName(oldName):null));
  const livePools=context.livePools||await mikrotikService.getIpPools();
  const resolved=resolveRemoteAddress(value.remoteAddress,livePools);
  let remoteAddress=value.remoteAddress;
  let warning=null;
  if(resolved.kind==="pool"||resolved.kind==="ip"){
    remoteAddress=resolved.name;
  }else if(resolved.kind==="empty"){
    remoteAddress="";
  }else{
    const current=target||previous;
    if(current){
      const currentRemote=String(current.remoteAddress||current.raw?.["remote-address"]||"").trim();
      remoteAddress=currentRemote;
      warning=`IP pool "${resolved.name}" does not exist on the router; kept the router's current remote-address "${currentRemote||"(none)"}". Correct the plan's pool in the panel.`;
    }else{
      const panelPools=Array.isArray(context.panelPools)?context.panelPools:[];
      const panelPool=panelPools.find(x=>String(x.name||"").toLowerCase()===resolved.name.toLowerCase());
      if(panelPool&&isValidPoolRanges(panelPool.ranges)){
        await mikrotikService.createIpPool({name:String(panelPool.name).trim(),ranges:String(panelPool.ranges).trim(),nextPool:String(panelPool.next_pool||"none").trim()||"none"});
        remoteAddress=String(panelPool.name).trim();
        warning=`IP pool "${remoteAddress}" was missing on the router; created it from the panel's saved IP pool (${String(panelPool.ranges).trim()}).`;
      }else{
        const derived=derivePoolRangeFromLocalAddress(value.localAddress);
        if(!derived)throw new Error(`IP pool "${resolved.name}" does not exist on the router and no range can be derived from local address "${String(value.localAddress||"").trim()}". Create the pool in IP Pools first, or correct the plan's pool.`);
        await mikrotikService.createIpPool({name:resolved.name,ranges:derived,nextPool:"none"});
        remoteAddress=resolved.name;
        warning=`IP pool "${resolved.name}" was missing on the router; created it with range ${derived} (derived from local address ${String(value.localAddress||"").trim()}). Check the range in IP Pools if it should differ.`;
      }
    }
  }
  const data={
    name:value.planName,
    localAddress:value.localAddress,
    remoteAddress,
    dnsServer:value.dnsServer,
    changeTcpMss:value.changeTcpMss,
    rateLimit:value.rateLimit
  };
  let result;
  if(target){
    result=await mikrotikService.updateProfile(target.id,data);
  }else if(previous){
    result=await mikrotikService.updateProfile(previous.id,data);
  }else{
    result=await mikrotikService.createProfile(data);
  }
  return{...(result||{}),warning};
}

function normalizePlanId(rawId){
  const raw=String(rawId??"").trim();
  if(!raw||/^(undefined|null)$/i.test(raw))return null;
  if(!/^\\d+$/.test(raw))return null;
  const id=Number(raw);
  return Number.isSafeInteger(id)&&id>0?id:null;
}

async function savePlan(req,res){
  try{
    const body=req.body||{};
    const planId=normalizePlanId(body.id);
    const n=await normalize({
      planName:body.planName??body.name,
      price:body.price,
      durationMonths:body.durationMonths??body.duration,
      rateLimit:body.rateLimit,
      localAddress:body.localAddress,
      remoteAddress:body.remoteAddress,
      dnsServer:body.dnsServer,
      changeTcpMss:body.changeTcpMss
    });
    if(n.error)return errorResponse(res,new Error(n.error),400);

    let existing=null;
    if(planId!==null){
      const result=await db.query("SELECT * FROM packages WHERE id=$1::bigint",[planId]);
      if(!result.rows.length)return errorResponse(res,new Error("Plan not found."),404);
      existing=result.rows[0];
    }

    // MikroTik is provisioned first. Database is only changed after RouterOS accepts the profile.
    await syncMikrotikProfile(n.value,existing?.profile_name||"");

    const values=[
      n.value.planName,
      n.value.remoteAddress||null,
      n.value.rateLimit||null,
      n.value.price,
      n.value.durationMonths,
      n.value.localAddress||null,
      n.value.remoteAddress||null,
      n.value.dnsServer||null,
      n.value.changeTcpMss
    ];

    let result;
    if(planId!==null){
      result=await db.query(
        "UPDATE packages SET plan_name=$1,pool_name=$2,profile_name=$1,rate_limit=$3,price=$4,duration_months=$5,local_address=$6,remote_address=$7,dns_server=$8,change_tcp_mss=$9,updated_at=NOW() WHERE id=$10::bigint RETURNING *",
        [...values,planId]
      );
    }else{
      result=await db.query(
        "INSERT INTO packages(plan_name,pool_name,profile_name,rate_limit,price,duration_months,local_address,remote_address,dns_server,change_tcp_mss) VALUES($1,$2,$1,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(plan_name) DO UPDATE SET pool_name=EXCLUDED.pool_name,profile_name=EXCLUDED.profile_name,rate_limit=EXCLUDED.rate_limit,price=EXCLUDED.price,duration_months=EXCLUDED.duration_months,local_address=EXCLUDED.local_address,remote_address=EXCLUDED.remote_address,dns_server=EXCLUDED.dns_server,change_tcp_mss=EXCLUDED.change_tcp_mss,updated_at=NOW() RETURNING *",
        values
      );
    }

    return res.json({
      success:true,
      message:"Plan \""+n.value.planName+"\" successfully saved and synchronized with MikroTik!",
      package:result.rows[0]
    });
  }catch(e){
    console.error("[PLAN SAVE ERROR]",e);
    return errorResponse(res,e);
  }
}

async function create(req,res){
  req.body={...(req.body||{}),id:null};
  return savePlan(req,res);
}

async function update(req,res){
  req.body={...(req.body||{}),id:req.params.id};
  return savePlan(req,res);
}

async function remove(req,res){
  try{
    const body=req.body||{}, rawId=req.params.id??body.id, id=clean(rawId,50);
    let existing;
    if(id&&!/^(undefined|null)$/i.test(id)) existing=await db.query("SELECT * FROM packages WHERE id=$1::bigint",[id]);
    else{const name=clean(body.name||body.planName,120);if(!name)return errorResponse(res,new Error("Plan ID or name is required."),400);existing=await db.query("SELECT * FROM packages WHERE plan_name=$1 OR profile_name=$1 LIMIT 1",[name]);}
    if(!existing.rows.length)return errorResponse(res,new Error("Package not found."),404);
    const pkg=existing.rows[0],targetName=clean(pkg.profile_name||pkg.plan_name,120);
    if(isSystemProfile(targetName))return errorResponse(res,new Error("System/internal MikroTik profiles are protected and cannot be deleted."),400);
    if(await mikrotikService.isProfileInUse(targetName))return errorResponse(res,new Error("Cannot delete: Profile is currently assigned to one or more PPPoE users."),409);
    const profile=await findProfileByName(targetName);
    if(profile)await mikrotikService.removeProfile(profile.id);
    const deleted=await db.query("DELETE FROM packages WHERE id=$1::bigint RETURNING *",[pkg.id]);
    return res.json({success:true,message:'Plan "'+targetName+'" deleted successfully',package:deleted.rows[0]});
  }catch(e){return errorResponse(res,e);}
}
async function deletePlan(req,res){return remove(req,res);}


let panelSyncInFlight=false;
async function syncPanelToMikrotik(req,res){
  if(panelSyncInFlight)return res.status(409).json({success:false,message:"Panel-to-MikroTik plan sync is already running."});
  panelSyncInFlight=true;
  try{
    const result=await db.query("SELECT * FROM packages WHERE LOWER(COALESCE(profile_name,plan_name,'')) NOT LIKE '%default%' AND LOWER(COALESCE(profile_name,plan_name,'')) <> 'vpn' AND LOWER(COALESCE(profile_name,plan_name,'')) NOT LIKE 'template%' AND LOWER(COALESCE(profile_name,plan_name,'')) NOT LIKE 'internal%' AND LOWER(COALESCE(profile_name,plan_name,'')) NOT LIKE 'system%' ORDER BY plan_name");
    // Live pools + panel pool records are fetched once so every plan resolves
    // its remote-address against the same snapshot (and a missing pool can be
    // recreated from the panel's saved ranges). Panel pool metadata is
    // best-effort: a missing ip_pools table must not break the sync.
    const livePools=await mikrotikService.getIpPools();
    let panelPools=[];
    try{
      const panelResult=await db.query("SELECT name,ranges,next_pool FROM ip_pools");
      panelPools=panelResult.rows||[];
    }catch(_panelPoolError){panelPools=[];}
    const outcomes=[];
    for(const row of result.rows||[]){
      const name=clean(row.profile_name||row.plan_name,120);
      try{
        if(isSystemProfile(name))throw new Error("System/internal profiles are protected.");
        const existing=await findProfileByName(name);
        const synced=await syncMikrotikProfile({
          planName:name,
          localAddress:clean(row.local_address,255),
          remoteAddress:clean(row.remote_address||row.pool_name,255),
          dnsServer:clean(row.dns_server,255),
          changeTcpMss:clean(row.change_tcp_mss||"default",20).toLowerCase(),
          rateLimit:clean(row.rate_limit,100)
        },row.profile_name||row.plan_name,{livePools,panelPools,target:existing});
        outcomes.push({name,status:existing?"updated":"created",...(synced&&synced.warning?{warning:synced.warning}:{})});
      }catch(error){outcomes.push({name,status:"failed",message:routerError(error)});}
    }
    const created=outcomes.filter(x=>x.status==="created").length;
    const updated=outcomes.filter(x=>x.status==="updated").length;
    const failed=outcomes.filter(x=>x.status==="failed").length;
    const notes=outcomes.filter(x=>x.warning).map(x=>x.name+": "+x.warning);
    return res.json({success:true,total:outcomes.length,created,updated,failed,results:outcomes,message:"Panel-to-MikroTik sync finished: "+created+" created, "+updated+" updated, "+failed+" failed."+(notes.length?"\n\nNotes:\n"+notes.join("\n"):"")});
  }catch(error){return errorResponse(res,error);}
  finally{panelSyncInFlight=false;}
}

let syncInFlight = false;

async function sync(req,res){
  if(syncInFlight){
    return res.status(409).json({
      success:false,
      message:"MikroTik package sync is already running. Please wait for the current sync to finish."
    });
  }

  syncInFlight = true;
  try{
    // MikroTik access is centrally managed by mikrotikService:
    // connections and commands have hard timeouts and are closed in finally.
    const [profiles,pools]=await Promise.all([
      mikrotikService.fetchExistingProfiles(),
      mikrotikService.getIpPools()
    ]);

    if(!Array.isArray(profiles)){
      return res.status(502).json({success:false,message:"Invalid response from MikroTik profile sync."});
    }

    const poolMap=new Map(
      (Array.isArray(pools)?pools:[]).map(p=>[String(p.name||"").toLowerCase(),p])
    );

    const rows=profiles
      .filter(profile=>!isSystemProfile(profile.name))
      .map(profile=>{
        const raw=profile.raw||{};
        const name=String(profile.name||"").trim();
        if(!name)return null;

        const remote=String(profile.remoteAddress||raw["remote-address"]||"").trim();
        const localAddress=String(profile.localAddress||raw["local-address"]||"").trim();
        const dnsServer=String(profile.dnsServer||raw["dns-server"]||"").trim();
        const rateLimit=String(profile.rateLimit||raw["rate-limit"]||"").trim();
        const changeTcpMss=String(profile.changeTcpMss||raw["change-tcp-mss"]||"default").trim()||"default";
        const matchedPool=poolMap.get(remote.toLowerCase());

        return {
          name,
          poolName:matchedPool?.name||remote||null,
          rateLimit:rateLimit||null,
          localAddress:localAddress||null,
          remoteAddress:remote||null,
          dnsServer:dnsServer||null,
          changeTcpMss
        };
      })
      .filter(Boolean);

    if(!rows.length){
      return res.json({
        success:true,
        count:0,
        packages:[],
        message:"No MikroTik PPP profiles were returned to synchronize."
      });
    }

    // One PostgreSQL statement replaces the old sequential per-profile query loop.
    // This avoids hundreds of awaited DB round trips and reduces pool pressure.
    const params=[
      rows.map(x=>x.name),
      rows.map(x=>x.poolName),
      rows.map(x=>x.rateLimit),
      rows.map(x=>x.localAddress),
      rows.map(x=>x.remoteAddress),
      rows.map(x=>x.dnsServer),
      rows.map(x=>x.changeTcpMss)
    ];

    const result=await db.query(
      `INSERT INTO packages
        (plan_name,pool_name,profile_name,rate_limit,price,duration_months,local_address,remote_address,dns_server,change_tcp_mss)
       SELECT
        names.name,pools.pool_name,names.name,rates.rate_limit,0,1,locals.local_address,
        remotes.remote_address,dns.dns_server,mss.change_tcp_mss
       FROM
        unnest($1::text[]) WITH ORDINALITY AS names(name,ord)
        JOIN unnest($2::text[]) WITH ORDINALITY AS pools(pool_name,ord) USING(ord)
        JOIN unnest($3::text[]) WITH ORDINALITY AS rates(rate_limit,ord) USING(ord)
        JOIN unnest($4::text[]) WITH ORDINALITY AS locals(local_address,ord) USING(ord)
        JOIN unnest($5::text[]) WITH ORDINALITY AS remotes(remote_address,ord) USING(ord)
        JOIN unnest($6::text[]) WITH ORDINALITY AS dns(dns_server,ord) USING(ord)
        JOIN unnest($7::text[]) WITH ORDINALITY AS mss(change_tcp_mss,ord) USING(ord)
       ON CONFLICT(plan_name) DO UPDATE SET
        pool_name=COALESCE(EXCLUDED.pool_name,packages.pool_name),
        profile_name=EXCLUDED.profile_name,
        rate_limit=COALESCE(EXCLUDED.rate_limit,packages.rate_limit),
        local_address=COALESCE(EXCLUDED.local_address,packages.local_address),
        remote_address=COALESCE(EXCLUDED.remote_address,packages.remote_address),
        dns_server=COALESCE(EXCLUDED.dns_server,packages.dns_server),
        change_tcp_mss=COALESCE(EXCLUDED.change_tcp_mss,packages.change_tcp_mss),
        updated_at=NOW()
       RETURNING *`,
      params
    );

    return res.json({
      success:true,
      count:result.rows.length,
      packages:result.rows,
      message:`Successfully synchronized ${result.rows.length} profiles from MikroTik!`
    });
  }catch(e){
    console.error("[PACKAGE SYNC ERROR]",e);
    return errorResponse(res,e);
  }finally{
    syncInFlight=false;
  }
}

module.exports={list,pools,create,update,savePlan,remove,deletePlan,sync,syncPanelToMikrotik,syncMikrotikProfile,isValidIpv4,isValidPoolRanges,resolveRemoteAddress,derivePoolRangeFromLocalAddress};
