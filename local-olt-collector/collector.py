#!/usr/bin/env python3
"""Push-based SNMP telemetry collector. OIDs are vendor-specific and must be verified for the installed OLT firmware."""
import json, logging, os, time, urllib.request, urllib.error
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

def suffix_map(table):
    result={}
    for oid,value in table.items():
        # Use the OID suffix as a stable row key for joining per-ONU tables.
        suffix=oid.split(".", len(oid.split("."))-1)[-1]
        result[suffix]=value
    return result

def load_customer_map():
    """Load only explicit SNMP suffix/ONU-ID to PPPoE username mappings."""
    raw = env("ONU_CUSTOMER_MAP_JSON", "{}")
    try:
        mapping = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        raise RuntimeError("ONU_CUSTOMER_MAP_JSON must be valid JSON object text") from exc
    if not isinstance(mapping, dict):
        raise RuntimeError("ONU_CUSTOMER_MAP_JSON must be a JSON object")
    return {
        str(key).strip(): str(username).strip()
        for key, username in mapping.items()
        if str(key).strip() and str(username).strip()
    }

def collect():
    # Configure these scalar/table roots from the OLT vendor's official MIB for this exact firmware.
    customer_map = load_customer_map()
    oid_mac=required("OID_ONU_MAC")
    oid_status=required("OID_ONU_STATUS")
    oid_rx=required("OID_ONU_RX_POWER")
    oid_tx=env("OID_ONU_TX_POWER")
    oid_pon=required("OID_ONU_PON_PORT")
    macs=walk(oid_mac); statuses=walk(oid_status); rxs=walk(oid_rx); pons=walk(oid_pon)
    txs=walk(oid_tx) if oid_tx else {}
    # OID suffixes must align across these table columns; if the vendor uses different indexes,
    # define OIDs to return aligned table indexes or adapt this function after validating the MIB.
    def index_map(table): return {oid[len(oid.split(".")[:0][0]):] if False else oid: value for oid,value in table.items()}
    def suffix(oid,root): return oid[len(root.rstrip("."))+1:] if oid.startswith(root.rstrip(".")+".") else oid
    keys=set(macs)
    rows=[]
    for mac_oid,mac in macs.items():
        key=suffix(mac_oid,oid_mac)
        status=statuses.get(oid_status.rstrip(".")+"."+key, "unknown").lower()
        rx=rxs.get(oid_rx.rstrip(".")+"."+key)
        tx=txs.get(oid_tx.rstrip(".")+"."+key) if oid_tx else None
        pon=pons.get(oid_pon.rstrip(".")+"."+key)
        # Never guess power units: configure *_SCALE=0.1 if OLT reports tenths of dBm.
        def power(v,scale):
            if v is None: return None
            try: return round(float(v)*float(scale),2)
            except (TypeError,ValueError): return None
        status_map={"online":"online","offline":"offline","los":"los"}
        for env_key,normalized in (("ONU_STATUS_ONLINE_VALUE","online"),("ONU_STATUS_OFFLINE_VALUE","offline"),("ONU_STATUS_LOS_VALUE","los")):
            configured=env(env_key)
            if configured: status_map[configured.lower()]=normalized
        onu_id = key
        customer_username = customer_map.get(key)
        rows.append({"onuId":onu_id,"onuMac":mac.replace("-",":").lower(),"pppoeUsername":str(customer_username).strip() if customer_username else None,"ponPort":pon,
            "status":status_map.get(status,"unknown"),
            "rxPowerDbm":power(rx,env("RX_POWER_SCALE","1")),
            "txPowerDbm":power(tx,env("TX_POWER_SCALE","1")) if tx is not None else None,
            "observedAt":datetime.now(timezone.utc).isoformat(),"sourceAgent":env("COLLECTOR_ID","local-olt-collector"),
            "raw":{"snmpIndex":key,"rxRaw":rx,"txRaw":tx,"statusRaw":status}})
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
