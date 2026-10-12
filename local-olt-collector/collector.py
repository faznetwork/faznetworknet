#!/usr/bin/env python3
"""Push-based SNMP telemetry collector for verified V-SOL OLT table OIDs."""
import json, logging, os, re, time, urllib.request, urllib.error
from datetime import datetime, timezone
from dotenv import load_dotenv
from pysnmp.hlapi import SnmpEngine, CommunityData, UdpTransportTarget, ContextData, ObjectType, ObjectIdentity, nextCmd

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL","INFO"), format="%(asctime)s %(levelname)s %(message)s")
LOG=logging.getLogger("faz-olt-collector")

def env(name, default=""):
    return os.getenv(name, default).strip()

def required(name):
    value=env(name)
    if not value: raise RuntimeError(f"Missing required environment variable: {name}")
    return value

def walk(oid):
    engine=SnmpEngine()
    iterator=nextCmd(engine, CommunityData(required("OLT_SNMP_COMMUNITY"), mpModel=1),
        UdpTransportTarget((required("OLT_HOST"), int(env("OLT_SNMP_PORT","161"))), timeout=float(env("SNMP_TIMEOUT","2.5")), retries=int(env("SNMP_RETRIES","1"))),
        ContextData(), ObjectType(ObjectIdentity(oid)), lexicographicMode=False, maxRows=int(env("MAX_OID_ROWS","10000")))
    values={}
    for errorIndication,errorStatus,errorIndex,varBinds in iterator:
        if errorIndication: raise RuntimeError(f"SNMP transport error: {errorIndication}")
        if errorStatus: raise RuntimeError(f"SNMP agent error: {errorStatus.prettyPrint()} at index {errorIndex}")
        for name,value in varBinds:
            values[str(name)]=value.prettyPrint()
    return values

def suffix(oid, root):
    root=root.rstrip(".")
    return oid[len(root)+1:] if oid.startswith(root+".") else ""

def load_customer_map():
    raw=env("ONU_CUSTOMER_MAP_JSON","{}")
    try:
        mapping=json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("ONU_CUSTOMER_MAP_JSON must be valid JSON.") from exc
    if not isinstance(mapping,dict):
        raise RuntimeError("ONU_CUSTOMER_MAP_JSON must be a JSON object.")
    return {str(k):str(v).strip() for k,v in mapping.items() if str(v).strip()}

def parse_power(value, scale):
    """Accept explicit dBm text or numeric values with an explicitly configured scale."""
    if value is None: return None
    text=str(value).strip()
    match=re.search(r"(-?(?:\d+(?:\.\d+)?|\.\d+))\s*dBm\b", text, re.I)
    try:
        if match:
            result=float(match.group(1))
        else:
            # Do not infer the unit of a raw numeric/octet value.
            if not re.fullmatch(r"-?(?:\d+(?:\.\d+)?|\.\d+)", text):
                return None
            result=float(text)*float(scale)
    except (TypeError,ValueError):
        return None
    return round(result,2) if -50 <= result <= 20 else None

def collect():
    oid_mac=required("OID_ONU_MAC")
    oid_status=required("OID_ONU_STATUS")
    oid_rx=required("OID_ONU_RX_POWER")
    oid_tx=env("OID_ONU_TX_POWER")
    oid_pon=required("OID_ONU_PON_PORT")
    oid_onu_id=required("OID_ONU_ID")
    macs=walk(oid_mac)
    statuses=walk(oid_status)
    rxs=walk(oid_rx)
    pons=walk(oid_pon)
    onu_ids=walk(oid_onu_id)
    txs=walk(oid_tx) if oid_tx else {}
    customer_map=load_customer_map()

    def get_by_index(table, root, key):
        return table.get(root.rstrip(".")+"."+key)

    rows=[]
    for mac_oid,mac in macs.items():
        key=suffix(mac_oid,oid_mac)
        if not key or not re.fullmatch(r"\d+(?:\.\d+)*", key):
            LOG.warning("Skipping ONU MAC row with unexpected OID index: %s", mac_oid)
            continue
        status_raw=get_by_index(statuses,oid_status,key)
        rx_raw=get_by_index(rxs,oid_rx,key)
        tx_raw=get_by_index(txs,oid_tx,key) if oid_tx else None
        pon_raw=get_by_index(pons,oid_pon,key)
        onu_raw=get_by_index(onu_ids,oid_onu_id,key)
        # Use the actual PON/ONU columns where valid; fall back to the SNMP row index
        # only when the device reports an invalid ONU ID. Never invent a PON value.
        try: onu_number=int(str(onu_raw).strip())
        except (TypeError,ValueError): onu_number=-1
        try: pon_number=int(str(pon_raw).strip())
        except (TypeError,ValueError): pon_number=-1
        onu_id=f"{pon_number}/{onu_number}" if pon_number > 0 and onu_number >= 0 else key
        status_map={}
        for env_key,normalized in (("ONU_STATUS_ONLINE_VALUE","online"),("ONU_STATUS_OFFLINE_VALUE","offline"),("ONU_STATUS_LOS_VALUE","los")):
            configured=env(env_key)
            if configured: status_map[configured.lower()]=normalized
        status=status_map.get(str(status_raw or "unknown").strip().lower(),"unknown")
        rows.append({
            "onuId":onu_id,
            "onuMac":str(mac).replace("-",":").lower(),
            "pppoeUsername":customer_map.get(key) or customer_map.get(onu_id) or None,
            "ponPort":f"PON {pon_number}" if pon_number > 0 else None,
            "status":status,
            "rxPowerDbm":parse_power(rx_raw,env("RX_POWER_SCALE","1")),
            "txPowerDbm":parse_power(tx_raw,env("TX_POWER_SCALE","1")) if tx_raw is not None else None,
            "observedAt":datetime.now(timezone.utc).isoformat(),
            "sourceAgent":env("COLLECTOR_ID","local-olt-collector"),
            "raw":{"snmpIndex":key,"ponRaw":pon_raw,"onuIdRaw":onu_raw,"rxRaw":rx_raw,"txRaw":tx_raw,"statusRaw":status_raw}
        })
    return rows

def push(readings):
    endpoint=required("RENDER_INGEST_URL")
    token=required("OLT_COLLECTOR_TOKEN")
    payload=json.dumps({"oltId":required("OLT_ID"),"readings":readings}).encode()
    req=urllib.request.Request(endpoint,data=payload,headers={"Content-Type":"application/json","Authorization":"Bearer "+token},method="POST")
    try:
        with urllib.request.urlopen(req,timeout=float(env("HTTP_TIMEOUT","15"))) as response:
            body=response.read(4096).decode("utf-8","replace")
            if response.status<200 or response.status>=300: raise RuntimeError(f"Render API HTTP {response.status}: {body}")
            LOG.info("Pushed %s readings: %s",len(readings),body)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Render API HTTP {exc.code}: {exc.read(2048).decode('utf-8','replace')}") from exc

def main():
    interval=max(60,int(env("POLL_INTERVAL_SECONDS","300")))
    while True:
        started=time.monotonic()
        try:
            readings=collect()
            if not readings: raise RuntimeError("No ONU rows returned by configured OIDs; refusing to push an empty snapshot.")
            push(readings)
        except Exception as exc:
            LOG.exception("Collection/push failed; will retry next cycle: %s",exc)
        time.sleep(max(1,interval-(time.monotonic()-started)))

if __name__=="__main__": main()
