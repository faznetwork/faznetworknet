# FAZ NETWORK — read-only V-SOL OLT SNMP discovery guard
# RouterOS v7.8+. Imports a named script; does NOT create a scheduler.
# Replace __OLT_COLLECTOR_TOKEN__ outside Git before importing.
# This build intentionally DOES NOT POST telemetry: live OLT table column/index
# mappings for RX power and ONU MAC have not yet been verified.
# SNMP read-only community only; never use the private write community.

/system script add name="faz-olt-telemetry" policy=ftp,read,test source={
:local oltAddress "172.21.21.2";
:local oltPort 161;
:local community "public";

:local sysDescr [/tool snmp-get address=$oltAddress port=$oltPort version=2c community=$community tries=1 try-timeout=1000ms oid="1.3.6.1.2.1.1.1.0" as-value];
:local descr ($sysDescr->"value");
:put ("OLT sysDescr: " . $descr);
:if ([:len $descr] = 0) do={ :error "No SNMP sysDescr from configured OLT IP 172.21.21.2; no data posted."; }
:if ([:find $descr "V1600D"] = nil) do={ :error "SNMP endpoint did not identify as V-SOL V1600D family; refusing telemetry scan."; }

# Earlier confirmed MIB exploration found the V-SOL enterprise ONU table
# under .1.3.6.1.4.1.37950.1.1.5.10. The RX/MAC column IDs and index order
# are not yet verified. Do not guess them or post fabricated/empty readings.
:put "SNMP reachability confirmed; ONU table branch is .1.3.6.1.4.1.37950.1.1.5.10";
:put "RX/MAC OID mapping still needs verification. Nothing was posted; scheduler must remain disabled.";
}
