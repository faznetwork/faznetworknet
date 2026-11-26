const db = require("../db");
const mikrotikService = require("../services/mikrotikService");

function clean(value, max = 255) { return String(value ?? "").trim().slice(0, max); }
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
    const [rows,usedRows]=await Promise.all([mikrotikService.getIpPools(),mikrotikService.getUsedIpPools()]);
    let metadata=[];
    try{const result=await db.query("SELECT name,ranges,local_address,subnet,device_name,next_pool FROM ip_pools ORDER BY name ASC");metadata=result.rows||[];}catch(dbError){console.warn("[IP POOL metadata warning]:",dbError.message);}
    const byName=new Map(metadata.map(row=>[String(row.name||"").toLowerCase(),row]));
    const usageByPool=new Map();
    for(const item of usedRows){const key=String(item.pool||"").toLowerCase();if(!usageByPool.has(key))usageByPool.set(key,[]);usageByPool.get(key).push(item);}
    const pools=rows.filter(pool=>!/^default(?:[-_].*)?$/i.test(String(pool.name||"").trim())).map(pool=>{
      const meta=byName.get(String(pool.name||"").toLowerCase())||{};
      return {id:pool.id,name:pool.name,ranges:pool.ranges,nextPool:pool.nextPool||"",localAddress:meta.local_address||"",subnet:meta.subnet||"",deviceName:meta.device_name||"",allocations:usageByPool.get(String(pool.name||"").toLowerCase())||[]};
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
    const pools=await mikrotikService.getIpPools();
    const existing=originalName?pools.find(x=>String(x.name).toLowerCase()===originalName.toLowerCase()):null;
    const targetNext=nextPool&&!/^none$/i.test(nextPool)?nextPool:"none";
    const result=existing?await mikrotikService.updateIpPool(existing.id,{name,ranges,nextPool:targetNext}):await mikrotikService.createIpPool({name,ranges,nextPool:targetNext});
    try{
      const device=await mikrotikService.getRouterIdentity();
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
    const result=await mikrotikService.deleteIpPool(identifier);
    // The panel record is what the panel-to-MikroTik sync reads: leaving it
    // behind resurrects the pool on the next sync, so a panel delete must
    // remove it too (the rename path in saveOrUpdateIpPool already does
    // this for the old name). Best-effort: the router delete already
    // succeeded, so a DB failure only warns.
    try{
      const device=await mikrotikService.getRouterIdentity();
      await db.query("DELETE FROM ip_pools WHERE lower(device_name)=lower($1) AND lower(name)=lower($2)",[device,identifier]);
    }catch(dbErr){console.warn("[DB ip_pools warning]:",dbErr.message);}
    return res.json({success:true,message:"IP pool removed successfully from MikroTik.",pool:result});
  }catch(error){return errorResponse(res,error);}
}

async function syncPanelToMikrotik(req,res){
  try{
    const device=await mikrotikService.getRouterIdentity();
    const saved=await db.query("SELECT name,ranges,next_pool FROM ip_pools WHERE lower(COALESCE(device_name,''))=lower($1) ORDER BY name ASC",[device]);
    if(!saved.rows?.length)return res.status(409).json({success:false,message:"No IP pools saved in the panel for this MikroTik. Save each pool from the panel first, then sync again."});
    const live=await mikrotikService.getIpPools();
    const liveByName=new Map((live||[]).map(item=>[String(item.name||"").toLowerCase(),item]));
    const results=[];
    for(const row of saved.rows){
      const name=clean(row.name,100),ranges=clean(row.ranges,1000),nextPool=clean(row.next_pool||"none",100)||"none";
      try{
        if(!name||/^default(?:[-_].*)?$/i.test(name))throw new Error("Default/system pool names cannot be synced.");
        if(!ranges||ranges.split(",").some(part=>!validRangePart(part)))throw new Error("Invalid saved IPv4 range.");
        const existing=liveByName.get(name.toLowerCase());
        if(existing){await mikrotikService.updateIpPool(existing.id||existing.name,{name,ranges,nextPool});results.push({name,status:"updated"});}
        else{
          const duplicate=findPoolWithSameRanges(ranges,live);
          if(duplicate){results.push({name,status:"skipped",message:`Pool "${name}" was not created: its ranges ${ranges} already exist on pool "${duplicate.name}". Delete the stale saved record for "${name}" or correct its ranges.`});}
          else{await mikrotikService.createIpPool({name,ranges,nextPool});results.push({name,status:"created"});}
        }
      }catch(error){results.push({name,status:"failed",message:error?.message||"IP pool sync failed."});}
    }
    const created=results.filter(x=>x.status==="created").length,updated=results.filter(x=>x.status==="updated").length,failed=results.filter(x=>x.status==="failed").length,skipped=results.filter(x=>x.status==="skipped").length;
    const notes=results.filter(x=>x.status==="skipped"||x.status==="failed").map(x=>x.name+": "+(x.message||x.status));
    return res.json({success:true,total:results.length,created,updated,failed,skipped,results,message:"Panel-to-MikroTik IP pool sync finished: "+created+" created, "+updated+" updated, "+failed+" failed."+(skipped?" "+skipped+" skipped.":"")+(notes.length?"\n\nNotes:\n"+notes.join("\n"):"")});
  }catch(error){return errorResponse(res,error);}
}

module.exports={list,create,update,saveOrUpdateIpPool,remove,syncPanelToMikrotik,normalizePoolRanges,findPoolWithSameRanges};
