# FAZ NETWORK — V-SOL OLT read-only SNMP table-walk collector
# RouterOS v7.8+. Creates a named script only; does NOT add a scheduler.
# Replace __OLT_COLLECTOR_TOKEN__ locally before import. Never commit a real token.
# Uses only SNMP GETNEXT/GET with the read-only community; no OLT/MikroTik config writes.

 /system script add name="faz-olt-telemetry-v2" policy=ftp,read,test source={
:local oltAddress "172.21.21.2";
:local oltPort 161;
:local community "public";
:local apiUrl "https://faznetwork-web.onrender.com/api/olt/sync-telemetry";
:local token "__OLT_COLLECTOR_TOKEN__";
:local oltId "V-SOL-V1601E04-DP";

# Observed V-SOL table roots from this OLT. Table columns share a row suffix.
:local macRoot "1.3.6.1.4.1.37950.1.1.5.12.1.12.1.6";
:local statusRoot "1.3.6.1.4.1.37950.1.1.5.12.1.12.1.5";
:local ponRoot "1.3.6.1.4.1.37950.1.1.5.12.1.12.1.3";
:local onuRoot "1.3.6.1.4.1.37950.1.1.5.12.1.12.1.4";
:local rxRoot "1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1.7.1";
:local txRoot "1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1.6.1";

:if ($token = "__OLT_COLLECTOR_TOKEN__") do={ :error "Set OLT collector token before running"; }
:local descrResult [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=1000ms oid="1.3.6.1.2.1.1.1.0" as-value];
:local descr ($descrResult->"value");
:put ("OLT sysDescr: " . $descr);
:if ([:len $descr] = 0) do={ :error "No SNMP sysDescr from OLT; nothing posted."; }
:if ([:find $descr "V1600D"] = nil) do={ :error "OLT sysDescr did not identify V-SOL V1600D; refusing to post."; }

:local readings [:toarray ""];
:local cursor $macRoot;
:local count 0;
:local prefix ($macRoot . ".");
:for step from=1 to=256 do={
  :local item;
  :onerror err in={
    :set item [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=1000ms oid=$cursor next=yes as-value];
  } do={ :error ("SNMP GETNEXT failed at " . $cursor . ": " . $err); }
  :local rowOid ($item->"oid");
  :local rowType ($item->"type");
  :if ([:len $rowOid] = 0) do={ :break; }
  :if ([:pick $rowOid 0 [:len $prefix]] != $prefix) do={ :break; }
  :local key [:pick $rowOid [:len $prefix] [:len $rowOid]];
  :if ([:len $key] = 0) do={ :break; }
  :set cursor $rowOid;
  :local mac ($item->"value");
  :if (($rowType != "no-such-instance") && ([:len $mac] > 0)) do={
    :local statusResult;
    :local ponResult;
    :local onuResult;
    :local rxResult;
    :local txResult;
    :local statusRaw "unknown";
    :local ponRaw "";
    :local onuRaw "";
    :local rxRaw "";
    :local txRaw "";
    :onerror e in={ :set statusResult [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=500ms oid=($statusRoot . "." . $key) as-value]; :set statusRaw ($statusResult->"value"); } do={ :set statusRaw "unknown"; }
    :onerror e in={ :set ponResult [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=500ms oid=($ponRoot . "." . $key) as-value]; :set ponRaw ($ponResult->"value"); } do={ :set ponRaw ""; }
    :onerror e in={ :set onuResult [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=500ms oid=($onuRoot . "." . $key) as-value]; :set onuRaw ($onuResult->"value"); } do={ :set onuRaw ""; }
    :onerror e in={ :set rxResult [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=500ms oid=($rxRoot . "." . $key) as-value]; :set rxRaw ($rxResult->"value"); } do={ :set rxRaw ""; }
    :onerror e in={ :set txResult [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=500ms oid=($txRoot . "." . $key) as-value]; :set txRaw ($txResult->"value"); } do={ :set txRaw ""; }

    :local ponNum -1;
    :local onuNum -1;
    :onerror e in={ :set ponNum [:tonum $ponRaw]; } do={ :set ponNum -1; }
    :onerror e in={ :set onuNum [:tonum $onuRaw]; } do={ :set onuNum -1; }
    :local onuId $key;
    :local ponPort "";
    :if (($ponNum > 0) && ($onuNum >= 0)) do={
      :set onuId ($ponNum . "/" . $onuNum);
      :set ponPort ("PON " . $ponNum);
    }
    :local reading {"onuId"=$onuId;"onuMac"=$mac;"ponPort"=$ponPort;"status"="unknown";"rxPowerDbm"=$rxRaw;"txPowerDbm"=$txRaw;"sourceAgent"="RouterOS-SNMP-VSOL";"raw"={"snmpIndex"=$key;"statusRaw"=$statusRaw;"ponRaw"=$ponRaw;"onuIdRaw"=$onuRaw;"rxRaw"=$rxRaw;"txRaw"=$txRaw}};
    :set readings ($readings, $reading);
    :set count ($count + 1);
  }
}
:if ($count = 0) do={ :error "No ONU MAC rows found under the configured table root; nothing posted."; }
:local body [:serialize to=json value={"oltId"=$oltId;"readings"=$readings} options=json.no-string-conversion];
:local response [/tool fetch url=$apiUrl http-method=post http-header-field=("Content-Type: application/json,Authorization: Bearer " . $token) http-data=$body output=user as-value check-certificate=yes];
:local responseData ($response->"data");
:put ("FAZ OLT telemetry POST response: " . $responseData);
:log info ("FAZ OLT telemetry v2 POST response: " . $responseData);
}
