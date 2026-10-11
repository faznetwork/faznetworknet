# FAZ NETWORK — V-SOL V1601E04-DP read-only ONU optical telemetry
# RouterOS v7.8+ required for /tool snmp-get as-value.
# This script ONLY reads SNMP and POSTs readings to FAZ NETWORK. It does not
# change MikroTik PPPoE, firewall, routing, customer, or OLT configuration.
#
# BEFORE IMPORT:
# 1) Replace __OLT_COLLECTOR_TOKEN__ with the OLT_COLLECTOR_TOKEN set on Render.
# 2) Confirm the OLT SNMP read-only community and permitted source IP.
# 3) First run manually and inspect the log; do not schedule until confirmed.
#
# Known V-SOL V1600D MIB branches (index suffixes must be confirmed on this firmware):
# RX power: 1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1.7.<PON>.<ONU>
# ONU MAC:  1.3.6.1.4.1.37950.1.1.5.12.2.1.2.1.5.<PON>.<ONU>
# RX power is an OCTET STRING on this MIB; unknown/encoded values are sent as raw
# and the server refuses to guess a conversion to dBm.

:local oltAddress "103.54.37.182";
:local oltPort 161;
:local community "public";
:local apiUrl "https://faznetwork-web.onrender.com/api/olt/sync-telemetry";
:local token "__OLT_COLLECTOR_TOKEN__";
:local oltId "V-SOL-V1601E04-DP";
:local rxBase "1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1.7";
:local macBase "1.3.6.1.4.1.37950.1.1.5.12.2.1.2.1.5";

:if ($token = "__OLT_COLLECTOR_TOKEN__") do={ :error "Set OLT collector token before running"; }

# This initial read-only probe verifies one known scalar OID before polling.
:local sysDescr [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=500ms oid="1.3.6.1.2.1.1.1.0" as-value];
:if ([:len ($sysDescr->"value")] = 0) do={ :error "OLT SNMP sysDescr is empty; check ACL/community"; }

# Read a bounded set of candidate ONU indexes. Do not write anything to the OLT.
# The first pass intentionally collects only values that are clearly numeric dBm.
:local readings [:toarray ""];
:local skipped 0;
:for pon from=1 to=4 do={
  :for onu from=1 to=64 do={
    :local suffix ("." . $pon . "." . $onu);
    :local macResult;
    :local rxResult;
    :local gotMac false;
    :local gotRx false;
    :onerror err in={
      :set macResult [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=250ms oid=($macBase . $suffix) as-value];
      :if (($macResult->"type") != "no-such-instance" && [:len ($macResult->"value")] > 0) do={ :set gotMac true; }
    } do={ :set gotMac false; }
    :if ($gotMac) do={
      :onerror err in={
        :set rxResult [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=250ms oid=($rxBase . $suffix) as-value];
        :if (($rxResult->"type") != "no-such-instance" && [:len ($rxResult->"value")] > 0) do={ :set gotRx true; }
      } do={ :set gotRx false; }
      :if ($gotRx) do={
        :local mac ($macResult->"value");
        :local rxText ($rxResult->"value");
        :local reading {"onuId"=($pon . "/" . $onu);"onuMac"=$mac;"ponPort"=("PON " . $pon);"status"="unknown";"rxPowerDbm"=$rxText;"sourceAgent"="RouterOS-SNMP-VSOL";"raw"={"rxOid"=($rxBase . $suffix);"rxType"=($rxResult->"type");"rxValue"=$rxText;"macOid"=($macBase . $suffix);"macType"=($macResult->"type")}};
        :set readings ($readings, $reading);
      }
    }
  }
}
:if ([:len $readings] = 0) do={ :error "No ONU readings found; verify MIB indexes and SNMP read ACL. Nothing was posted."; }
:local body [:serialize to=json value={"oltId"=$oltId;"readings"=$readings} options=json.no-string-conversion];
:local response [/tool fetch url=$apiUrl http-method=post http-header-field=("Content-Type: application/json,Authorization: Bearer " . $token) http-data=$body output=user as-value check-certificate=yes];
:log info ("FAZ OLT telemetry POST complete; response=" . ($response->"data"));
