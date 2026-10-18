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
:local learnedMacBase "1.3.6.1.4.1.37950.1.1.5.10.3.2.1.3";
:local learnedTypeBase "1.3.6.1.4.1.37950.1.1.5.10.3.2.1.4";
:local learnedPortBase "1.3.6.1.4.1.37950.1.1.5.10.3.2.1.5";

:if ($token = "__OLT_COLLECTOR_TOKEN__") do={ :error "Set OLT collector token before running"; }
:local sysDescr [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=1000ms oid="1.3.6.1.2.1.1.1.0" as-value];
:local descr ($sysDescr->"value");
:put ("OLT sysDescr: " . $descr);
:if ([:len $descr] = 0) do={ :error "No SNMP sysDescr from OLT 172.21.21.2; nothing posted."; }
:if ([:find $descr "V1600D"] = nil) do={ :error "Endpoint is not identified as V-SOL V1600D; refusing to poll or post."; }

:local readings [:toarray ""];
:local clientMacsByOnu [:toarray ""];

# Walk the confirmed V-SOL learned-MAC columns by shared row index.
# Keep only dynamic-type (1) entries learned on an EPON ONU port; GE/CPU
# entries cannot safely identify a subscriber ONU.
:for rowIndex from=1 to=128 do={
  :local rowSuffix ("." . $rowIndex);
  :local learnedMacResult;
  :local learnedTypeResult;
  :local learnedPortResult;
  :local gotLearnedMac false;
  :local gotLearnedType false;
  :local gotLearnedPort false;
  :onerror err in={
    :set learnedMacResult [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=250ms oid=($learnedMacBase . $rowSuffix) as-value];
    :if (($learnedMacResult->"type") != "no-such-instance" && [:len ($learnedMacResult->"value")] > 0) do={ :set gotLearnedMac true; }
  } do={ :set gotLearnedMac false; }
  :if ($gotLearnedMac) do={
    :onerror err in={
      :set learnedTypeResult [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=250ms oid=($learnedTypeBase . $rowSuffix) as-value];
      :if (($learnedTypeResult->"type") != "no-such-instance" && [:len ($learnedTypeResult->"value")] > 0) do={ :set gotLearnedType true; }
    } do={ :set gotLearnedType false; }
    :onerror err in={
      :set learnedPortResult [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=250ms oid=($learnedPortBase . $rowSuffix) as-value];
      :if (($learnedPortResult->"type") != "no-such-instance" && [:len ($learnedPortResult->"value")] > 0) do={ :set gotLearnedPort true; }
    } do={ :set gotLearnedPort false; }
    :if ($gotLearnedType && $gotLearnedPort && (($learnedTypeResult->"value") = 1)) do={
      :local learnedPort ($learnedPortResult->"value");
      :if ([:find $learnedPort "EPON0/"] = 0 && [:find $learnedPort ":"] != nil) do={
        :local rawLearnedMac ($learnedMacResult->"value");
        :local learnedHex [:convert $rawLearnedMac from=raw to=hex];
        :if ([:len $learnedHex] = 12) do={
          :local learnedMac ([:pick $learnedHex 0 2] . ":" . [:pick $learnedHex 2 4] . ":" . [:pick $learnedHex 4 6] . ":" . [:pick $learnedHex 6 8] . ":" . [:pick $learnedHex 8 10] . ":" . [:pick $learnedHex 10 12]);
          :local currentMacs ($clientMacsByOnu->$learnedPort);
          :if ([:typeof $currentMacs] = "nil") do={
            :set ($clientMacsByOnu->$learnedPort) [:toarray ""];
          }
          :set ($clientMacsByOnu->$learnedPort) (($clientMacsByOnu->$learnedPort), $learnedMac);
        }
      }
    }
  }
}

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
        :local rawMac ($macResult->"value");
        :local macHex [:convert $rawMac from=raw to=hex];
        :if ([:len $macHex] != 12) do={ :continue; }
        :local mac ([:pick $macHex 0 2] . ":" . [:pick $macHex 2 4] . ":" . [:pick $macHex 4 6] . ":" . [:pick $macHex 6 8] . ":" . [:pick $macHex 8 10] . ":" . [:pick $macHex 10 12]);
        :local rxText ($rxResult->"value");
        :local onuId ("EPON0/" . $pon . ":" . $onu);
        :local clientMacs ($clientMacsByOnu->$onuId);
        :if ([:typeof $clientMacs] = "nil") do={ :set clientMacs [:toarray ""]; }
        :local reading {"onuId"=$onuId;"onuMac"=$mac;"ponPort"=("EPON0/" . $pon);"status"="unknown";"rxPowerDbm"=$rxText;"sourceAgent"="RouterOS-SNMP-VSOL";"raw"={"rxOid"=($rxBase . $suffix);"rxType"=($rxResult->"type");"rxValue"=$rxText;"macOid"=($macBase . $suffix);"macType"=($macResult->"type");"clientMacs"=$clientMacs}};
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
