# FAZ NETWORK — read-only V-SOL V1600D4 ONU telemetry collector
# RouterOS v7.8+. Imports a named script; does NOT create a scheduler.
# Replace __OLT_COLLECTOR_TOKEN__ locally before importing; never commit a real token.
# SNMP community is read-only public. Never use the private write community.

/system script add name="faz-olt-telemetry" policy=ftp,read,test source={
:local oltAddress "172.21.21.2";
:local oltPort 161;
:local community "public";
:local apiUrl "https://faznetwork-web.onrender.com/api/olt/sync-telemetry";
:local token "__OLT_COLLECTOR_TOKEN__";
:local oltId "V-SOL-V1601E04-DP";
:local rxBase "1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1.7";
:local macBase "1.3.6.1.4.1.37950.1.1.5.12.2.1.2.1.5";

:if ($token = "__OLT_COLLECTOR_TOKEN__") do={ :error "Set OLT collector token before running"; }
:local sysDescr [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=1000ms oid="1.3.6.1.2.1.1.1.0" as-value];
:local descr ($sysDescr->"value");
:put ("OLT sysDescr: " . $descr);
:if ([:len $descr] = 0) do={ :error "No SNMP sysDescr from OLT 172.21.21.2; nothing posted."; }
:if ([:find $descr "V1600D"] = nil) do={ :error "Endpoint is not identified as V-SOL V1600D; refusing to poll or post."; }

:local readings [:toarray ""];
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
:if ([:len $readings] = 0) do={ :error "No ONU rows returned for verified V-SOL endpoint; nothing was posted."; }
:local body [:serialize to=json value={"oltId"=$oltId;"readings"=$readings} options=json.no-string-conversion];
:local response [/tool fetch url=$apiUrl http-method=post http-header-field=("Content-Type: application/json,Authorization: Bearer " . $token) http-data=$body output=user as-value check-certificate=yes];
:log info ("FAZ OLT telemetry POST complete; response=" . ($response->"data"));
}
