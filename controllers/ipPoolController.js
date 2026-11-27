const db = require("../db");
const mikrotikService = require("../services/mikrotikService");

// The tunnel path to the router is slow: the RouterOS handshake alone can
// take ~3.5s and has been seen to exceed the service's 10s defaults, so a
// pool save/sync fails even though the router is healthy. Pool saves and
// syncs use a 30s handshake + 30s operation budget (inside the service's
// 60s MAX). Display paths never pass this — the list stays DB-only and
// fast, and its live allocation enrichment keeps the 10s defaults.
const SLOW_ROUTER_TIMEOUTS = Object.freeze({ operationTimeoutMs: 30000, handshakeTimeoutMs: 30000 });

function clean(value, max = 255) { return String(value ?? "").trim().slice(0, max); }
// The RouterOS pool lookup throws 'MikroTik IP pool "X" was not found.' when
// the pool is not on the router (renamed/deleted there), and RouterOS itself
// reports "no such item" when a remove finds nothing. Either one means the
// router side is already gone. A timeout/connection failure is different:
// its message never matches this, so an unreachable router is never
// mistaken for a missing pool. (The "router was not found" config error is
// deliberately NOT matched here.)
function isPoolNotFoundError(error){
  return /MikroTik IP pool .* was not found|no such item/i.test(String(error?.message||""));
}
function errorResponse(res, error) {
  console.error("[IP POOL API]", error);
  const message = error?.message || "IP pool operation failed.";
  return res.status(error?.statusCode || 503).json({ success: false, message, error: message });
}
function ipv4ToNumber(value) {
  const parts=String(value||"").split(".");
  if(parts.length!==4||parts.some(part=>!/^\d{1,3}$/.test(part)||Number(part)>255))return null;
  return parts.reduce((total,part)=>total*256+Number(part),0);
}
function ipv4Text(value) {
  const n=Number(value);
  if(!Number.isInteger(n)||n<0||n>4294967295)return "";
  return [24,16,8,0].map(shift=>(n>>>shift)&255).join(".");
}
function validRangePart(value) {
  const part=clean(value,100);
  if(/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/.test(part)){const [ip,prefix]=part.split("/");return ipv4ToNumber(ip)!==null&&Number(prefix)>=0&&Number(prefix)<=32;}
  const match=part.match(/^(\d{1,3}(?:\.\d{1,3}){3})-(\d{1,3}(?:\.\d{1,3}){3})$/);
  if(!match)return false;
  const start=ipv4ToNumber(match[1]),end=ipv4ToNumber(match[2]);
  return start!==null&&end!==null&&start<=end;
}
// Two pools with identical ranges hand out the same addresses: creating the
// second one only duplicates the first. A stale saved record (e.g. the Oct
// 2026 "Expire_Pool", whose ranges exactly duplicate the live
// "EXPIRED-PROFILE" pool) must never be resurrected by a sync — it is
// skipped with a warning instead. Ranges are compared after normalizing
// each IP (leading zeros, spacing) so "100.065.096.002-..." still matches.
function normalizeIp(value){
  const parts=String(value||"").trim().split(".");
  if(parts.length!==4||parts.some(part=>!/^\d{1,3}$/.test(part)||Number(part)>255))return null;
  return parts.map(part=>String(Number(part))).join(".");
}
function normalizePoolRanges(ranges){
  const parts=String(ranges||"").split(",").map(part=>part.trim()).filter(Boolean);
  if(!parts.length)return null;
  const normalized=[];
  for(const part of parts){
    const cidr=part.match(/^(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})$/);
    if(cidr){
      const ip=normalizeIp(cidr[1]);
      if(!ip||Number(cidr[2])>32)return null;
      normalized.push(ip+"/"+String(Number(cidr[2])));
      continue;
    }
    const range=part.match(/^(\d{1,3}(?:\.\d{1,3}){3})\s*-\s*(\d{1,3}(?:\.\d{1,3}){3})$/);
    if(range){
      const start=normalizeIp(range[1]),end=normalizeIp(range[2]);
      if(!start||!end||ipv4ToNumber(start)>ipv4ToNumber(end))return null;
      normalized.push(start+"-"+end);
      continue;
    }
    const single=normalizeIp(part);
    if(!single)return null;
    normalized.push(single);
  }
  return normalized.sort().join(",");
}
function findPoolWithSameRanges(ranges,livePools){
  const wanted=normalizePoolRanges(ranges);
  if(!wanted)return null;
  for(const pool of Array.isArray(livePools)?livePools:[]){
    if(normalizePoolRanges(pool?.ranges)===wanted)return pool;
  }
  return null;
}
// Derive the subnet (CIDR) + gateway from a pool's ranges when no saved
// panel record matches it. Only for a single range that exactly fills the
// usable space of one CIDR block (start = network+2, end = broadcast-1 —
// the gateway .1 is excluded) or a single CIDR with a usable gateway
// (prefix <= 30). A bare single IP (e.g. "10.10.0.2") has no meaningful
// gateway, so it returns null and the fields stay honestly empty instead
// of showing an invented address.
function deriveSubnetAndGateway(ranges){
  const parts=String(ranges||"").split(",").map(part=>part.trim()).filter(Boolean);
  if(parts.length!==1)return null;
  const part=parts[0];
  const cidr=part.match(/^(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})$/);
  if(cidr){
    const ip=ipv4ToNumber(cidr[1]),prefix=Number(cidr[2]);
    if(ip===null||prefix>30)return null;
    const mask=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;
    const network=(ip&mask)>>>0;
    return {subnet:ipv4Text(network)+"/"+prefix,localAddress:ipv4Text(network+1)};
  }
  const range=part.match(/^(\d{1,3}(?:\.\d{1,3}){3})\s*-\s*(\d{1,3}(?:\.\d{1,3}){3})$/);
  if(!range)return null;
  const start=ipv4ToNumber(range[1]),end=ipv4ToNumber(range[2]);
  if(start===null||end===null||end<start)return null;
  for(let prefix=32;prefix>=0;prefix--){
    const mask=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;
    const network=(start&mask)>>>0;
    const broadcast=network+(prefix===32?0:(Math.pow(2,32-prefix)-1));
    if(start===network+2&&end===broadcast-1){
      return {subnet:ipv4Text(network)+"/"+prefix,localAddress:ipv4Text(network+1)};
    }
  }
  return null;
}
function normalizePayload(body){
  const name=clean(body?.name,100),ranges=clean(body?.ranges,1000),nextPool=clean(body?.nextPool||body?.["next-pool"],100);
  if(!name)throw new Error("IP pool name is required.");
  if(/^default(?:[-_].*)?$/i.test(name))throw new Error("Default system IP pool names cannot be managed here.");
  if(!ranges)throw new Error("IP ranges are required.");
  if(ranges.split(",").some(part=>!validRangePart(part)))throw new Error("Enter valid IPv4 subnet/range values, separated by commas.");
  return {name,ranges,nextPool};
}
async function list(req,res){
  try{
    // The list is the panel's saved ip_pools rows ONLY. The router is never
    // the source of the list: a slow/offline router must never hide the
    // saved pools. (One-way sync: the panel is the source of truth; the
    // router is only written to when a pool is saved or synced.)
    let metadata=[];
    try{const result=await db.query("SELECT name,ranges,local_address,subnet,device_name,next_pool FROM ip_pools ORDER BY name ASC");metadata=result.rows||[];}catch(dbError){console.warn("[IP POOL metadata warning]:",dbError.message);}
    // Live router data is best-effort enrichment only (allocations). Its
    // failure can never fail this response: on failure the saved rows are
    // returned with empty allocations.
    const usageByPool=new Map();
    try{
      // Live allocation counts are enrichment only: the router is slow, so
      // they are capped at 2s and the saved rows render with empty
      // allocations when the router does not answer in time. The list
      // itself never waits on the router.
      const usagePromise=mikrotikService.getUsedIpPools();
      usagePromise.catch(()=>{});
      const usedRows=await Promise.race([usagePromise,new Promise(resolve=>setTimeout(()=>resolve(null),2000))]);
      if(Array.isArray(usedRows)){
        for(const item of usedRows){const key=String(item.pool||"").toLowerCase();if(!usageByPool.has(key))usageByPool.set(key,[]);usageByPool.get(key).push(item);}
      }
    }catch(routerError){
      console.warn("[IP POOL list warning]: live allocation data unavailable, showing saved pools:",routerError.message||routerError);
    }
    const pools=metadata.filter(row=>!/^default(?:[-_].*)?$/i.test(String(row.name||"").trim())).map(row=>{
      // Derive the subnet/gateway from the ranges when the saved row lacks
      // them (only when the range exactly fills one CIDR block's usable
      // space). A bare single IP has no meaningful gateway, so it stays empty.
      let localAddress=row.local_address||"",subnet=row.subnet||"";
      if(!localAddress||!subnet){
        const derived=deriveSubnetAndGateway(row.ranges);
        if(derived){
          if(!subnet)subnet=derived.subnet;
          if(!localAddress)localAddress=derived.localAddress;
        }
      }
      return {id:String(row.name||""),name:row.name,ranges:row.ranges,nextPool:row.next_pool||"",localAddress,subnet,deviceName:row.device_name||"",metaSource:"name",allocations:usageByPool.get(String(row.name||"").toLowerCase())||[]};
    });
    return res.json(pools);
  }catch(error){return errorResponse(res,error);}
}
async function saveOrUpdateIpPool(req,res){
  try{
    const body=req.body||{};
    const originalName=clean(body.originalName||body.original_name,100);
    const name=clean(body.name||originalName,100);
    const ranges=clean(body.ranges,1000).split(",").map(x=>x.trim().replace(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/g,(_,ip)=>ip.split(".").map(x=>String(Number(x))).join("."))).filter(Boolean).join(",");
    const nextPool=clean(body.nextPool||body["next-pool"],100);
    const localAddress=clean(body.localAddress||body.local_address,255);
    const subnet=clean(body.subnet,50);
    if(!name||!ranges)return res.status(400).json({success:false,message:"Pool Name and Valid IP Ranges are required"});
    if(/^default(?:[-_].*)?$/i.test(name))return res.status(400).json({success:false,message:"Default system IP pool names cannot be managed here."});
    if(ranges.split(",").some(part=>!validRangePart(part)))return res.status(400).json({success:false,message:"Enter valid IPv4 subnet/range values, separated by commas."});
    const pools=await mikrotikService.getIpPools(SLOW_ROUTER_TIMEOUTS);
    const existing=originalName?pools.find(x=>String(x.name).toLowerCase()===originalName.toLowerCase()):null;
    const targetNext=nextPool&&!/^none$/i.test(nextPool)?nextPool:"none";
    const result=existing?await mikrotikService.updateIpPool(existing.id,{name,ranges,nextPool:targetNext},SLOW_ROUTER_TIMEOUTS):await mikrotikService.createIpPool({name,ranges,nextPool:targetNext},SLOW_ROUTER_TIMEOUTS);
    try{
      const device=await mikrotikService.getRouterIdentity(SLOW_ROUTER_TIMEOUTS);
      await db.query("INSERT INTO ip_pools(name,ranges,local_address,subnet,device_name,next_pool,updated_at) VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(device_name,name) DO UPDATE SET ranges=EXCLUDED.ranges,local_address=EXCLUDED.local_address,subnet=EXCLUDED.subnet,next_pool=EXCLUDED.next_pool,updated_at=NOW()",[name,ranges,localAddress||null,subnet||null,device,targetNext]);
      if(existing&&existing.name.toLowerCase()!==name.toLowerCase())await db.query("DELETE FROM ip_pools WHERE device_name=$1 AND name=$2",[device,existing.name]);
    }catch(dbErr){console.warn("[DB ip_pools warning]:",dbErr.message);}
    return res.json({success:true,message:'IP Pool "'+name+'" saved and synced with MikroTik!',pool:result});
  }catch(error){return errorResponse(res,error,500);}
}
async function create(req,res){return saveOrUpdateIpPool(req,res);}
async function update(req,res){return saveOrUpdateIpPool(req,res);}
async function remove(req,res){
  try{
    const identifier=clean(req.params.id,100);
    if(!identifier||/^default(?:[-_].*)?$/i.test(identifier))return res.status(400).json({success:false,message:"The default system IP pool cannot be deleted."});
    // A pool the router reports as "not found" (renamed/deleted there) is a
    // stale panel record: the router side is already gone, so the panel row
    // must still be deleted instead of erroring out and leaving it behind.
    // A timeout/connection failure is different — the router state is
    // unknown, so the DB row must stay and the delete errors.
    let routerResult=null,routerMissing=false;
    try{
      routerResult=await mikrotikService.deleteIpPool(identifier,SLOW_ROUTER_TIMEOUTS);
    }catch(routerError){
      if(isPoolNotFoundError(routerError)){routerMissing=true;}
      else throw routerError;
    }
    // The panel record is what the panel-to-MikroTik sync reads: leaving it
    // behind resurrects the pool on the next sync, so a panel delete must
    // remove it too (the rename path in saveOrUpdateIpPool already does
    // this for the old name). Delete by (device, name) first; if that
    // removes nothing (or the identity lookup fails), fall back to a
    // name-only delete so a stale row can never survive.
    let deletedRows=0;
    try{
      const device=await mikrotikService.getRouterIdentity(SLOW_ROUTER_TIMEOUTS);
      const deleted=await db.query("DELETE FROM ip_pools WHERE lower(device_name)=lower($1) AND lower(name)=lower($2)",[device,identifier]);
      deletedRows=deleted.rowCount||0;
    }catch(dbErr){console.warn("[DB ip_pools warning]:",dbErr.message);}
    if(deletedRows===0){
      try{
        const deleted=await db.query("DELETE FROM ip_pools WHERE lower(name)=lower($1)",[identifier]);
        deletedRows=deleted.rowCount||0;
      }catch(dbErr){console.warn("[DB ip_pools warning]:",dbErr.message);}
    }
    if(routerMissing){
      return res.json({success:true,deletedFrom:"database",message:'IP pool "'+identifier+'" was not on MikroTik, so it was deleted from the panel database only.',pool:{name:identifier}});
    }
    return res.json({success:true,deletedFrom:"both",message:"IP pool removed successfully from MikroTik.",pool:routerResult});
  }catch(error){return errorResponse(res,error);}
}

async function syncPanelToMikrotik(req,res){
  try{
    const device=await mikrotikService.getRouterIdentity(SLOW_ROUTER_TIMEOUTS);
    const saved=await db.query("SELECT name,ranges,next_pool FROM ip_pools WHERE lower(COALESCE(device_name,''))=lower($1) ORDER BY name ASC",[device]);
    if(!saved.rows?.length)return res.status(409).json({success:false,message:"No IP pools saved in the panel for this MikroTik. Save each pool from the panel first, then sync again."});
    const live=await mikrotikService.getIpPools(SLOW_ROUTER_TIMEOUTS);
    const liveByName=new Map((live||[]).map(item=>[String(item.name||"").toLowerCase(),item]));
    const results=[];
    for(const row of saved.rows){
      const name=clean(row.name,100),ranges=clean(row.ranges,1000),nextPool=clean(row.next_pool||"none",100)||"none";
      try{
        if(!name||/^default(?:[-_].*)?$/i.test(name))throw new Error("Default/system pool names cannot be synced.");
        if(!ranges||ranges.split(",").some(part=>!validRangePart(part)))throw new Error("Invalid saved IPv4 range.");
        const existing=liveByName.get(name.toLowerCase());
        if(existing){await mikrotikService.updateIpPool(existing.id||existing.name,{name,ranges,nextPool},SLOW_ROUTER_TIMEOUTS);results.push({name,status:"updated"});}
        else{
          const duplicate=findPoolWithSameRanges(ranges,live);
          if(duplicate){results.push({name,status:"skipped",message:`Pool "${name}" was not created: its ranges ${ranges} already exist on pool "${duplicate.name}". Delete the stale saved record for "${name}" or correct its ranges.`});}
          else{await mikrotikService.createIpPool({name,ranges,nextPool},SLOW_ROUTER_TIMEOUTS);results.push({name,status:"created"});}
        }
      }catch(error){results.push({name,status:"failed",message:error?.message||"IP pool sync failed."});}
    }
    const created=results.filter(x=>x.status==="created").length,updated=results.filter(x=>x.status==="updated").length,failed=results.filter(x=>x.status==="failed").length,skipped=results.filter(x=>x.status==="skipped").length;
    const notes=results.filter(x=>x.status==="skipped"||x.status==="failed").map(x=>x.name+": "+(x.message||x.status));
    return res.json({success:true,total:results.length,created,updated,failed,skipped,results,message:"Panel-to-MikroTik IP pool sync finished: "+created+" created, "+updated+" updated, "+failed+" failed."+(skipped?" "+skipped+" skipped.":"")+(notes.length?"\n\nNotes:\n"+notes.join("\n"):"")});
  }catch(error){return errorResponse(res,error);}
}

// Update the saved row with this name (any device), inserting it when the
// row vanished between the read and the write. UPDATE-by-name (not the
// (device_name,name) upsert) so a row saved under another device_name can
// never become a second row with the same name. renameFrom renames a saved
// row whose ranges match the live pool instead (the live name flip-flops
// between "100 Mbps" and "PPPoE_Pool" for the same ranges).
async function savePoolRow({name,ranges,localAddress,subnet,device,nextPool,renameFrom}){
  let updated;
  if(renameFrom){
    updated=await db.query("UPDATE ip_pools SET name=$1,ranges=$2,local_address=$3,subnet=$4,device_name=$5,next_pool=$6,updated_at=NOW() WHERE lower(name)=lower($7)",[name,ranges,localAddress,subnet,device,nextPool,renameFrom]);
  }else{
    updated=await db.query("UPDATE ip_pools SET ranges=$1,local_address=$2,subnet=$3,device_name=$4,next_pool=$5,updated_at=NOW() WHERE lower(name)=lower($6)",[ranges,localAddress,subnet,device,nextPool,name]);
  }
  if(updated&&updated.rowCount>0)return;
  await db.query("INSERT INTO ip_pools(name,ranges,local_address,subnet,device_name,next_pool,updated_at) VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(device_name,name) DO UPDATE SET ranges=EXCLUDED.ranges,local_address=EXCLUDED.local_address,subnet=EXCLUDED.subnet,next_pool=EXCLUDED.next_pool,updated_at=NOW()",[name,ranges,localAddress,subnet,device,nextPool]);
}
// One-way import, run only when the admin clicks "Sync from MikroTik".
// This is the deliberate, user-initiated direction (router -> panel) that
// fills the panel database with pools created on the router. It does NOT
// change the ongoing one-way rule: saves and panel->router syncs still
// push from the panel to the router. Panel rows that are not on the router
// are never deleted here.
async function syncFromMikrotik(req,res){
  try{
    const live=await mikrotikService.getIpPools(SLOW_ROUTER_TIMEOUTS);
    const device=await mikrotikService.getRouterIdentity(SLOW_ROUTER_TIMEOUTS);
    const saved=await db.query("SELECT name,ranges,local_address,subnet,device_name,next_pool FROM ip_pools ORDER BY name ASC");
    const rows=saved.rows||[];
    const byName=new Map(rows.map(row=>[String(row.name||"").toLowerCase(),row]));
    const byRanges=new Map();
    for(const row of rows){
      const key=normalizePoolRanges(row.ranges);
      if(key&&!byRanges.has(key))byRanges.set(key,row);
    }
    const results=[];
    const handled=new Set();
    for(const pool of live||[]){
      const name=clean(pool.name,100),ranges=clean(pool.ranges,1000);
      const nextPool=clean(pool.nextPool||"none",100)||"none";
      try{
        if(!name||/^default(?:[-_].*)?$/i.test(name)){results.push({name,status:"skipped",message:`Default/system pool "${name}" is not imported.`});continue;}
        // Live ranges come from the router: accept CIDR, a-b ranges and a
        // bare single IP (normalizePoolRanges accepts all three).
        if(!ranges||normalizePoolRanges(ranges)===null)throw new Error("Invalid IPv4 range.");
        const derived=deriveSubnetAndGateway(ranges);
        const existing=byName.get(name.toLowerCase());
        if(existing){
          // Same name already saved: refresh its ranges/subnet/gateway.
          const localAddress=existing.local_address||(derived?derived.localAddress:"")||null;
          const subnet=existing.subnet||(derived?derived.subnet:"")||null;
          await savePoolRow({name,ranges,localAddress,subnet,device,nextPool});
          handled.add(name.toLowerCase());
          results.push({name,status:"updated"});
          continue;
        }
        // No saved row with this name: the live pool may be a renamed saved
        // pool. Rename the saved row instead of inserting a second pool
        // that hands out the same addresses.
        const sameRanges=byRanges.get(normalizePoolRanges(ranges));
        if(sameRanges){
          const oldName=String(sameRanges.name||"");
          if(handled.has(oldName.toLowerCase())){
            results.push({name,status:"skipped",message:`Pool "${name}" was not imported: its ranges ${ranges} already exist on saved pool "${oldName}".`});
            continue;
          }
          const localAddress=sameRanges.local_address||(derived?derived.localAddress:"")||null;
          const subnet=sameRanges.subnet||(derived?derived.subnet:"")||null;
          await savePoolRow({name,ranges,localAddress,subnet,device,nextPool,renameFrom:oldName});
          handled.add(oldName.toLowerCase());
          handled.add(name.toLowerCase());
          results.push({name,status:"updated",message:`Renamed saved pool "${oldName}" to "${name}" (same ranges).`});
          continue;
        }
        // Genuinely new pool: insert it.
        const localAddress=derived?derived.localAddress:null;
        const subnet=derived?derived.subnet:null;
        await savePoolRow({name,ranges,localAddress,subnet,device,nextPool});
        handled.add(name.toLowerCase());
        results.push({name,status:"created"});
      }catch(error){
        results.push({name,status:"failed",message:error?.message||"IP pool import failed."});
      }
    }
    const created=results.filter(x=>x.status==="created").length,updated=results.filter(x=>x.status==="updated").length,failed=results.filter(x=>x.status==="failed").length,skipped=results.filter(x=>x.status==="skipped").length;
    const notes=results.filter(x=>x.status==="skipped"||x.status==="failed").map(x=>x.name+": "+(x.message||x.status));
    return res.json({success:true,total:results.length,created,updated,failed,skipped,results,message:"MikroTik-to-panel IP pool sync finished: "+created+" created, "+updated+" updated, "+failed+" failed."+(skipped?" "+skipped+" skipped.":"")+(notes.length?"\n\nNotes:\n"+notes.join("\n"):"")});
  }catch(error){return errorResponse(res,error);}
}

module.exports={list,create,update,saveOrUpdateIpPool,remove,syncPanelToMikrotik,syncFromMikrotik,normalizePoolRanges,findPoolWithSameRanges,deriveSubnetAndGateway,isPoolNotFoundError};
