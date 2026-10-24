'use strict';

// OLT telemetry ingestion has been retired. Keep this entry point so existing
// invocations fail loudly instead of silently continuing an obsolete collector.
function main() {
  console.error('[OLT collector] OLT telemetry collector is disabled; no SNMP polling or API push will run.');
  process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { main };
