const RouterOS = require("node-routeros");
const { RouterOSAPI } = RouterOS;

// RouterOS can send "!empty" before its normal "!done" terminator when a
// query matches no rows. node-routeros treats it as an unknown sentence and
// throws from an EventEmitter callback, which can crash the process. Ignore
// only that intermediate sentence; let the normal "!done" resolve the query
// to [] and close the channel normally.
const RouterOSChannel = RouterOS.Channel;
if (RouterOSChannel?.prototype && !RouterOSChannel.prototype.__fazHandlesEmptyReply) {
  const originalProcessPacket = RouterOSChannel.prototype.processPacket;
  RouterOSChannel.prototype.processPacket = function(packet) {
    if (Array.isArray(packet) && packet[0] === "!empty") return;
    return originalProcessPacket.call(this, packet);
  };
  Object.defineProperty(RouterOSChannel.prototype, "__fazHandlesEmptyReply", {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });
}

const CONNECTION_TIMEOUT_MS = 10000;
const OPERATION_TIMEOUT_MS = 10000;
const DEFAULT_PORT = 8728;

class MikroTikService {
  constructor() {
    // One long-lived RouterOS session per Node.js process. Every operation is
    // serialized because a RouterOS API connection must not have overlapping
    // command/reply streams.
    this._connection = null;
    this._connectionKey = null;
    this._operationQueue = Promise.resolve();
    this._configCache = null;
    this._configCacheUntil = 0;
  }

  async _getConfig(override) {
    const supplied=override&&typeof override==="object"?override:{};
    let saved={};
    const hasOverride = Object.keys(supplied).length > 0;
    if (!hasOverride && this._configCache && Date.now() < this._configCacheUntil) {
      saved = this._configCache;
    } else {
      try {
        const db=require("../db");
        const result=await db.query("SELECT key,value FROM app_settings WHERE key IN ('mikrotik_host','mikrotik_port','mikrotik_user','mikrotik_password')");
        saved=Object.fromEntries((result.rows||[]).map(row=>[row.key,row.value]));
        if (!hasOverride) {
          this._configCache = saved;
          this._configCacheUntil = Date.now() + 5000;
        }
      } catch(error) { console.warn("[MikroTik Settings] PostgreSQL settings unavailable; using environment fallback:",error.message); }
    }
    const host=String(supplied.host??saved.mikrotik_host??process.env.ROUTER_HOST??"").trim();
    const port=Number.parseInt(String(supplied.port??saved.mikrotik_port??process.env.ROUTER_PORT??DEFAULT_PORT),10);
    const user=String(supplied.user??saved.mikrotik_user??process.env.ROUTER_USER??"").trim();
    const password=String(supplied.password??saved.mikrotik_password??process.env.ROUTER_PASS??"");
    if(!host)throw new Error("MikroTik configuration error: Router Host / IP is not configured.");
    if(!Number.isInteger(port)||port<1||port>65535)throw new Error("MikroTik configuration error: API Port must be a valid TCP port.");
    if(!user)throw new Error("MikroTik configuration error: API Username is not configured.");
    return {host,port,user,password};
  }
  _createConnection(config) {
    const connection = new RouterOSAPI({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      // node-routeros currently coerces timeout: 0 to its 10s default.
      // _getPersistentConnection() disables the underlying socket timer directly
      // immediately after connect() creates the socket; operation deadlines are
      // still enforced independently by _executeWithTimeout().
      timeout: 0,
      keepalive: false
    });

    // Detailed lifecycle logging is intentional: distinguish remote/socket
    // errors from a close initiated by our own reset/reconnect path.
    if (typeof connection.on === "function") {
      connection.on("error", (error) => {
        const detail = error?.message || String(error || "unknown error");
        console.error("[MikroTik Connection Error]", {
          host: config.host, port: config.port, code: error?.code || null,
          message: detail, connected: Boolean(connection.connected),
          closeReason: connection.__fazCloseReason || null
        });
        if (this._connection === connection) {
          this._resetPersistentConnection(connection, "socket error: " + detail);
        }
      });
      connection.on("close", () => {
        console.warn("[MikroTik Connection Close]", {
          host: config.host, port: config.port,
          connected: Boolean(connection.connected),
          reason: connection.__fazCloseReason || "remote close / socket ended"
        });
        this._stopHeartbeat(connection);
        if (this._connection === connection) {
          this._connection = null;
          this._connectionKey = null;
        }
      });
    }

    // Serialize writes even when a caller uses Promise.all() inside one operation.
    // The service-level queue below serializes complete operations as well.
    const originalWrite = connection.write.bind(connection);
    let writeQueue = Promise.resolve();
    connection.write = (...args) => {
      const run = writeQueue.then(() => originalWrite(...args));
      writeQueue = run.catch(() => {});
      return run;
    };
    return connection;
  }

  _isConnectionFailure(error) {
    const message = String(error && error.message || error || "").toLowerCase();
    const code = String(error && error.code || "").toUpperCase();
    return /timeout|timed out|socket|connection|not connected|closed|reset|broken pipe|econn|enetunreach|ehostunreach|epipe|hang up/.test(message) ||
      /^(ECONN|ENET|EHOST|EPIPE|ETIMEDOUT|ERR_SOCKET)/.test(code);
  }

  _stopHeartbeat(connection) {
    if (!connection) return;
    if (connection.__fazHeartbeatTimer) {
      clearInterval(connection.__fazHeartbeatTimer);
      connection.__fazHeartbeatTimer = null;
    }
  }

  _disableSocketInactivityTimeout(connection, phase = "connect") {
    // node-routeros does not expose the Socket publicly in its TypeScript API,
    // but the runtime connector stores it as connector.socket. The socket timer
    // is set synchronously inside connection.connect(), so it can be cleared
    // immediately without disabling our independent Promise.race deadlines.
    const socket = connection?.connector?.socket;
    if (!socket || typeof socket.setTimeout !== "function") {
      console.warn("[MikroTik Socket] Could not access underlying socket to disable inactivity timeout", {
        phase, host: connection?.host || null
      });
      return false;
    }
    socket.setTimeout(0);
    if (typeof socket.setKeepAlive === "function") socket.setKeepAlive(true);
    console.log("[MikroTik Socket] inactivity timeout disabled", {
      phase, host: connection.host, port: connection.port
    });
    return true;
  }

  _startHeartbeat(connection) {
    this._stopHeartbeat(connection);
    connection.__fazHeartbeatTimer = setInterval(async () => {
      // Heartbeats join the same operation queue as application requests, so
      // they cannot interleave with a multi-command billing/customer operation.
      const heartbeat = this._operationQueue.then(async () => {
        if (this._connection !== connection || !connection.connected) return;
        try {
          await this._executeWithTimeout(
            connection.write("/system/identity/print"),
            OPERATION_TIMEOUT_MS,
            "persistent connection heartbeat"
          );
          console.debug("[MikroTik Heartbeat] ok", {
            host: connection.host, port: connection.port, at: new Date().toISOString()
          });
        } catch (error) {
          console.warn("[MikroTik Heartbeat] failed", {
            host: connection.host, port: connection.port,
            message: error?.message || String(error), code: error?.code || null
          });
          if (this._connection === connection && this._isConnectionFailure(error)) {
            this._resetPersistentConnection(connection, "heartbeat failed: " + (error?.message || error));
          }
        }
      });
      this._operationQueue = heartbeat.catch(() => {});
      await heartbeat;
    }, 30000);
    if (typeof connection.__fazHeartbeatTimer.unref === "function") {
      connection.__fazHeartbeatTimer.unref();
    }
  }

  _resetPersistentConnection(connection, reason = "explicit reset / reconnect") {
    if (!connection) return;
    connection.__fazCloseReason = reason;
    this._stopHeartbeat(connection);
    if (this._connection === connection) {
      this._connection = null;
      this._connectionKey = null;
    }
    this._safeClose(connection);
  }

  async _getPersistentConnection(config) {
    const key = JSON.stringify({host:config.host,port:config.port,user:config.user,password:config.password});
    if (this._connection && this._connectionKey !== key) {
      this._resetPersistentConnection(this._connection, "router configuration changed");
    }
    if (this._connection) return this._connection;

    const connection = this._createConnection(config);
    this._connection = connection;
    this._connectionKey = key;
    try {
      // Calling connect() synchronously creates connector.socket and initially
      // applies node-routeros' default 10s socket timeout. Clear that idle timer
      // immediately; the Promise.race below still caps the connection handshake.
      const connectPromise = connection.connect();
      this._disableSocketInactivityTimeout(connection, "initial connect");
      await this._executeWithTimeout(
        connectPromise,
        CONNECTION_TIMEOUT_MS,
        "MikroTik connection handshake"
      );
      this._disableSocketInactivityTimeout(connection, "after handshake");
      this._startHeartbeat(connection);
      console.log("[MikroTik Connection] persistent session established", {
        host: config.host, port: config.port, keepalive: "30s API heartbeat"
      });
      return connection;
    } catch (error) {
      this._resetPersistentConnection(connection, "connect/handshake failed: " + (error?.message || error));
      throw error;
    }
  }

  async _withConnection(operationName, operation, configOverride, operationTimeoutMs = OPERATION_TIMEOUT_MS) {
    const execute = async () => {
      let connection = null;
      try {
        // A short config cache avoids a PostgreSQL settings lookup for every
        // RouterOS command. Configuration changes are picked up within 5s.
        const config = await this._executeWithTimeout(
          this._getConfig(configOverride),
          CONNECTION_TIMEOUT_MS,
          "MikroTik configuration lookup"
        );
        connection = await this._getPersistentConnection(config);
        return await this._executeWithTimeout(
          Promise.resolve().then(() => operation(connection)),
          operationTimeoutMs,
          operationName
        );
      } catch (error) {
        if (connection && this._isConnectionFailure(error)) {
          // Discard a timed-out/uncertain socket so the next queued request
          // performs a fresh handshake rather than reusing a poisoned session.
          this._resetPersistentConnection(connection, "operation failed: " + (error?.message || error));
        }
        const details=this._extractRouterError(error);
        const wrapped=new Error(details.message);
        wrapped.cause=error;
        wrapped.category=details.category;
        wrapped.code=error&&error.code?error.code:"MIKROTIK_ERROR";
        wrapped.operation=operationName;
        throw wrapped;
      }
    };

    // Promise-chain queue is process-safe in Node's single event loop. Each
    // complete operation owns the connection until its RouterOS commands finish.
    const result = this._operationQueue.then(execute, execute);
    this._operationQueue = result.catch(() => {});
    return result;
  }
  async _executeWithTimeout(promise, ms = OPERATION_TIMEOUT_MS, operationName = "MikroTik call") {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve(promise),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("MikroTik socket timeout: " + operationName)), ms);
        })
      ]);
    } catch (error) {
      console.warn("[MikroTik Warning]: Call timed out or failed:", error.message);
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  _safeClose(connection) {
    if (!connection) return;
    try {
      let result;
      if (typeof connection.close === "function") result = connection.close();
      else if (typeof connection.disconnect === "function") result = connection.disconnect();
      else if (typeof connection.destroy === "function") result = connection.destroy();
      if (result && typeof result.then === "function") result.catch(() => {});
    } catch (_) {}
  }
  _firstRow(rows, operationName) { if (!Array.isArray(rows) || rows.length === 0) throw new Error("MikroTik " + operationName + " returned no data."); return rows[0]; }
  _number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
  _bool(value) { return String(value || "false").toLowerCase() === "true"; }
  _str(value) { return value === undefined || value === null ? "" : String(value); }
  _isSystemProfileName(value) {
    const name=this._str(value).trim().toLowerCase();
    return !name || name.includes("default") || name === "vpn" ||
      /^(?:template|internal|system)(?:[-_\s].*)?$/.test(name) ||
      /^(?:default|default-encryption|vpn)(?:[-_\s].*)?$/.test(name);
  }
  _writeParams(values) { return Object.entries(values).filter(([, value]) => value !== undefined && value !== null && String(value) !== "").map(([key, value]) => "=" + key + "=" + value); }

  async testConnection(configOverride) { return this._withConnection("connection test", async (connection) => { const identity = this._firstRow(await connection.write("/system/identity/print"), "identity query"); const resources = this._firstRow(await connection.write("/system/resource/print"), "resource query"); return { routerName: this._str(identity.name) || "Unknown Router", version: this._str(resources.version) || "Unknown", model:this._str(resources["board-name"])||this._str(resources["platform"])||"RouterOS device", boardName:this._str(resources["board-name"])||this._str(resources["platform"])||"RouterOS device", uptime:this._str(resources.uptime)||"unknown" }; },configOverride); }
  async getSystemResources() { return this._withConnection("resource query", async (connection) => { const resource = this._firstRow(await connection.write("/system/resource/print"), "resource query"); const totalMemoryBytes = this._number(resource["total-memory"]); const freeMemoryBytes = this._number(resource["free-memory"]); const totalHddBytes = this._number(resource["total-hdd-space"]); const freeHddBytes = this._number(resource["free-hdd-space"]); return { cpuLoad: this._number(resource["cpu-load"]), cpuCount: this._number(resource["cpu-count"]), cpuFrequencyMHz: this._number(resource["cpu-frequency"]), cpu: this._str(resource.cpu) || "Unknown", architectureName: this._str(resource["architecture-name"]) || "Unknown", boardName: this._str(resource["board-name"]) || "Unknown", platform: this._str(resource.platform) || "Unknown", version: this._str(resource.version) || "Unknown", buildTime: this._str(resource["build-time"]) || "Unknown", factorySoftware: this._str(resource["factory-software"]) || "Unknown", freeMemoryMb: Number((freeMemoryBytes / 1024 / 1024).toFixed(2)), totalMemoryMb: Number((totalMemoryBytes / 1024 / 1024).toFixed(2)), memoryUsedMb: Number((Math.max(0, totalMemoryBytes - freeMemoryBytes) / 1024 / 1024).toFixed(2)), memoryUsagePercent: totalMemoryBytes > 0 ? Number((((totalMemoryBytes - freeMemoryBytes) / totalMemoryBytes) * 100).toFixed(1)) : 0, freeHddMb: Number((freeHddBytes / 1024 / 1024).toFixed(2)), totalHddMb: Number((totalHddBytes / 1024 / 1024).toFixed(2)), hddUsagePercent: totalHddBytes > 0 ? Number((((totalHddBytes - freeHddBytes) / totalHddBytes) * 100).toFixed(1)) : 0, writeSectsSinceReboot: this._number(resource["write-sect-since-reboot"]), writeSectsTotal: this._number(resource["write-sect-total"]), badBlocks: this._str(resource["bad-blocks"]) || "0%", uptime: this._str(resource.uptime) || "unknown" }; }); }
  async getInterfaces() { return this._withConnection("interface query", async (connection) => { const rows = await connection.write("/interface/print"); return (Array.isArray(rows) ? rows : []).filter((item) => { const type = this._str(item.type).toLowerCase(); return ["ether","ethernet","sfp","sfp-sfpplus","sfpplus","bridge","vlan","pppoe","lte","bonding"].some((allowed) => type.includes(allowed)); }).map((item) => ({ name: this._str(item.name), type: this._str(item.type) || "unknown", running: this._bool(item.running), disabled: this._bool(item.disabled), comment: this._str(item.comment) })).filter((item) => item.name); }); }

  async getBridgeHosts() {
    return this._withConnection("bridge host discovery", async (connection) => {
      const rows = await connection.write("/interface/bridge/host/print");
      return (Array.isArray(rows) ? rows : []).map((item) => ({
        macAddress: this._str(item["mac-address"]),
        interface: this._str(item["on-interface"]),
        bridge: this._str(item.bridge),
        vlanId: this._str(item.vid),
        dynamic: this._bool(item.dynamic),
        local: this._bool(item.local),
        external: this._bool(item.external)
      })).filter((item) => item.macAddress && !item.local);
    });
  }

  async getInterfaceTraffic(interfaceName) { const name = String(interfaceName || "").trim(); if (!name || name.length > 100) throw new Error("MikroTik traffic query failed: a valid interface name is required."); return this._withConnection("traffic query for " + name, async (connection) => { const rows = await connection.write("/interface/monitor-traffic", ["=interface=" + name, "=once=true"]); const traffic = this._firstRow(rows, "traffic query"); const rxBitsPerSecond = this._number(traffic["rx-bits-per-second"]); const txBitsPerSecond = this._number(traffic["tx-bits-per-second"]); return { interface: name, rxBitsPerSecond, txBitsPerSecond, rxMbps: Number((rxBitsPerSecond / 1000000).toFixed(3)), txMbps: Number((txBitsPerSecond / 1000000).toFixed(3)), rxKbps: Number((rxBitsPerSecond / 1000).toFixed(1)), txKbps: Number((txBitsPerSecond / 1000).toFixed(1)), timestamp: new Date().toISOString() }; }); }
  async getPppoeLiveTraffic(username) {
    const name=String(username||"").trim();
    if(!name||name.length>100)throw new Error("A valid PPPoE username is required.");
    return this._withConnection("live PPPoE traffic for "+name,async(connection)=>{
      const sessions=await connection.write("/ppp/active/print");
      const session=(Array.isArray(sessions)?sessions:[]).find(item=>this._str(item.name).toLowerCase()===name.toLowerCase()&&this._str(item.service).toLowerCase()==="pppoe");
      if(!session)return {online:false,username:name,interface:"",download:"0 bps",upload:"0 bps",rxBitsPerSecond:0,txBitsPerSecond:0,bytesIn:0,bytesOut:0,uptime:"",ip:"",mac:"",timestamp:new Date().toISOString()};
      const interfaces=await connection.write("/interface/print");
      const interfaceRows=Array.isArray(interfaces)?interfaces:[];
      const candidates=[this._str(session.interface),"<pppoe-"+name+">",name].filter(Boolean);
      const iface=candidates.map(candidate=>interfaceRows.find(row=>this._str(row.name).toLowerCase()===candidate.toLowerCase())).find(Boolean)
        ||interfaceRows.find(row=>this._str(row.name).toLowerCase().includes(name.toLowerCase())&&this._bool(row.running)&&this._str(row.type).toLowerCase().includes("pppoe"));
      let rxBitsPerSecond=0,txBitsPerSecond=0,interfaceName=this._str(iface?.name);
      if(interfaceName){
        try{
          const rows=await connection.write("/interface/monitor-traffic",["=interface="+interfaceName,"=once="]);
          const traffic=this._firstRow(rows,"live PPPoE traffic");
          rxBitsPerSecond=this._number(traffic["rx-bits-per-second"]);
          txBitsPerSecond=this._number(traffic["tx-bits-per-second"]);
        }catch(error){console.warn("[MikroTik live traffic] monitor-traffic unavailable for "+interfaceName+": "+error.message);}
      }
      const rate=value=>value>=1000000?(value/1000000).toFixed(2)+" Mbps":value>=1000?(value/1000).toFixed(1)+" Kbps":Math.round(value)+" bps";
      return {online:true,username:name,interface:interfaceName,download:rate(txBitsPerSecond),upload:rate(rxBitsPerSecond),rxBitsPerSecond,txBitsPerSecond,bytesIn:this._number(iface?.["rx-byte"]??session["bytes-in"]),bytesOut:this._number(iface?.["tx-byte"]??session["bytes-out"]),downloadBytes:this._number(iface?.["tx-byte"]??session["bytes-out"]),uploadBytes:this._number(iface?.["rx-byte"]??session["bytes-in"]),uptime:this._str(session.uptime),ip:this._str(session.address),mac:this._str(session["caller-id"]),sessionId:this._str(session[".id"]),timestamp:new Date().toISOString()};
    });
  }

  async fetchExistingProfiles() {
    return this._withConnection("PPPoE profile sync", async (connection) => {
      const rows = await connection.write("/ppp/profile/print");
      return (Array.isArray(rows) ? rows : []).map((item) => {
        const rateLimit=this._str(item["rate-limit"]);
        const localAddress=this._str(item["local-address"]);
        const remoteAddress=this._str(item["remote-address"]);
        const dnsServer=this._str(item["dns-server"]);
        const changeTcpMss=this._str(item["change-tcp-mss"]) || "default";
        return {
          id:this._str(item[".id"]),
          name:this._str(item.name),
          rateLimit,
          "rate-limit":rateLimit,
          localAddress,
          "local-address":localAddress,
          remoteAddress,
          "remote-address":remoteAddress,
          dnsServer,
          "dns-server":dnsServer,
          sessionTimeout:this._str(item["session-timeout"]),
          idleTimeout:this._str(item["idle-timeout"]),
          onlyOne:this._bool(item["only-one"]),
          changeTcpMss,
          "change-tcp-mss":changeTcpMss,
          comment:this._str(item.comment),
          raw:item
        };
      }).filter((item) => item.name && !this._isSystemProfileName(item.name));
    });
  }
  async getPppoeSecret(username) {
    const name=this._str(username).trim();
    if(!name) return null;
    return this._withConnection("PPPoE secret lookup",async(connection)=>{
      const rows=await connection.write("/ppp/secret/print",["?name="+name]);
      const match=(Array.isArray(rows)?rows:[]).find(item=>this._str(item.name).trim().toLowerCase()===name.toLowerCase());
      if(!match) return null;
      return {
        id:this._str(match[".id"]),
        name:this._str(match.name),
        password:this._str(match.password),
        profile:this._str(match.profile),
        service:this._str(match.service)||"pppoe",
        disabled:this._bool(match.disabled),
        comment:this._str(match.comment),
        callerId:this._str(match["caller-id"]),
        localAddress:this._str(match["local-address"]),
        remoteAddress:this._str(match["remote-address"]),
        raw:match
      };
    });
  }

  async syncPanelCustomerSecrets(customers) {
    if (!Array.isArray(customers)) throw new Error("Customer list must be an array.");
    return this._withConnection("bulk panel-to-MikroTik PPPoE sync", async (connection) => {
      // Read all secrets as well as PPP profiles. This explicit Billing Panel
      // action updates known PPPoE accounts and provisions missing accounts from
      // current panel records; unrelated VPN service users are never overwritten.
      const [rows, profileRows] = await Promise.all([
        connection.write("/ppp/secret/print"),
        connection.write("/ppp/profile/print")
      ]);
      const allSecrets = new Map((Array.isArray(rows) ? rows : [])
        .map(item => [this._str(item.name).trim().toLowerCase(), item]));
      const secrets = new Map((Array.isArray(rows) ? rows : [])
        .filter(item => {
          const service = this._str(item.service).trim().toLowerCase() || "any";
          return ["pppoe", "any"].includes(service);
        })
        .map(item => [this._str(item.name).trim().toLowerCase(), item]));
      const profiles = new Set((Array.isArray(profileRows) ? profileRows : [])
        .map(item => this._str(item.name).trim().toLowerCase())
        .filter(Boolean));
      const results = []; let updated = 0, created = 0, skipped = 0, failed = 0;
      for (const customer of customers) {
        const username = this._str(customer && customer.username).trim();
        const usernameKey = username.toLowerCase();
        if (!username) { skipped++; results.push({username,status:"skipped",reason:"Missing username."}); continue; }
        let secret = secrets.get(usernameKey);
        const conflictingSecret = allSecrets.get(usernameKey);
        const callerIdForMatch = this._str(customer.callerId || customer.caller_id || customer.macAddress || customer.mac_address).trim().toLowerCase();
        // A customer may have had their PPPoE username changed or the RouterOS
        // secret may be missing under the panel username. Match by the saved
        // ONU/MAC Caller ID as a secondary identity, but only among PPPoE-capable
        // secrets; unrelated RouterOS users remain untouched.
        if (!secret && !conflictingSecret && callerIdForMatch) {
          const macMatches = [...secrets.values()].filter(item =>
            this._str(item["caller-id"]).trim().toLowerCase() === callerIdForMatch
          );
          if (macMatches.length === 1) secret = macMatches[0];
          else if (macMatches.length > 1) {
            failed++;
            results.push({username,status:"failed",reason:"Caller ID matches multiple MikroTik PPPoE secrets; no RouterOS change was made."});
            continue;
          }
        }
        const password = this._str(customer.password || this._str(secret?.password)).trim();
        const profile = this._str(customer.profile || this._str(secret?.profile)).trim();
        if (!secret && conflictingSecret) {
          failed++;
          results.push({username,status:"failed",reason:"A MikroTik secret with this username exists for a non-PPPoE service; it was not changed."});
          continue;
        }
        if (!password) {
          failed++;
          results.push({username,status:"failed",reason:secret ? "Panel password is empty and RouterOS password could not be read." : "Cannot create the missing PPPoE secret because the Billing Panel password is empty."});
          continue;
        }
        if (!profile) {
          failed++;
          results.push({username,status:"failed",reason:"A PPP profile is required; no RouterOS change was made."});
          continue;
        }
        if (!profiles.has(profile.toLowerCase())) {
          failed++;
          results.push({username,status:"failed",reason:'MikroTik PPP profile "' + profile + '" does not exist; no RouterOS change was made.'});
          continue;
        }
        try {
          const expiryDate = this._str(customer.expiryDate || customer.expiry_date || customer.expirationDate || customer.expiration_date).trim();
          const canonicalComment = /^\d{4}-\d{2}-\d{2}$/.test(expiryDate)
            ? "EXP: " + expiryDate
            : this._str(customer.comment).trim();
          const callerId = this._str(customer.callerId || customer.caller_id || customer.macAddress || customer.mac_address).trim();
          const params = this._writeParams({
            ...(secret && this._str(secret.name).trim() !== username ? {name: username} : {}),
            password,
            profile,
            "caller-id": callerId || undefined,
            comment: canonicalComment,
            disabled: customer.disabled ? "yes" : "no"
          });
          if (secret && secret[".id"]) {
            await connection.write(["/ppp/secret/set", "=.id=" + secret[".id"], ...params]);
            updated++;
            results.push({username,status:"updated",profile,disabled:Boolean(customer.disabled)});
          } else {
            await connection.write("/ppp/secret/add", this._writeParams({
              name: username,
              password,
              service: "pppoe",
              profile,
              "caller-id": callerId || undefined,
              comment: canonicalComment,
              disabled: customer.disabled ? "yes" : "no"
            }));
            created++;
            results.push({username,status:"created",profile,disabled:Boolean(customer.disabled)});
          }
        } catch (error) {
          failed++;
          results.push({username,status:"failed",reason:error && error.message ? error.message : "RouterOS update failed."});
        }
      }
      return {total:customers.length,updated,created,skipped,failed,results};
    }, undefined, 90000);
  }
  async syncPppoeExpiryComments(customers) {
    if (!Array.isArray(customers)) throw new Error("Customer list must be an array.");
    return this._withConnection("bulk PPPoE expiry comment sync", async (connection) => {
      const rows = await connection.write("/ppp/secret/print");
      const secrets = new Map((Array.isArray(rows) ? rows : [])
        .filter(item => ["pppoe", "any"].includes(this._str(item.service).trim().toLowerCase() || "any"))
        .map(item => [this._str(item.name).trim().toLowerCase(), item]));
      const results = []; let updated = 0, skipped = 0, failed = 0;
      for (const customer of customers) {
        const username = this._str(customer && customer.username).trim();
        const expiryDate = this._str(customer && customer.expiryDate).trim();
        if (!username || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) { skipped++; results.push({username,status:"skipped",reason:"Missing username or invalid ISO expiry date."}); continue; }
        const secret = secrets.get(username.toLowerCase());
        if (!secret || !secret[".id"]) { skipped++; results.push({username,status:"skipped",reason:"PPPoE secret not found on MikroTik."}); continue; }
        try {
          const comment = "EXP: " + expiryDate;
          await connection.write("/ppp/secret/set", ["=.id=" + secret[".id"], "=comment=" + comment]);
          updated++;
          results.push({username,status:"updated",comment});
        } catch(error) {
          failed++;
          results.push({username,status:"failed",reason:error && error.message ? error.message : "RouterOS update failed."});
        }
      }
      return {total:customers.length,updated,skipped,failed,results};
    }, undefined, 90000);
  }
  async fetchExistingSecrets() {
    return this._withConnection("PPPoE secret sync", async (connection) => {
      // RouterOS defaults PPP secrets to service=any. Include those records
      // as PPPoE-capable users; querying only service=pppoe silently omitted them.
      const rows = await connection.write("/ppp/secret/print");
      return (Array.isArray(rows) ? rows : [])
        .map((item) => ({
          id: this._str(item[".id"]),
          name: this._str(item.name),
          password: this._str(item.password),
          profile: this._str(item.profile),
          service: this._str(item.service) || "any",
          callerId: this._str(item["caller-id"]),
          disabled: this._bool(item.disabled),
          comment: this._str(item.comment),
          localAddress: this._str(item["local-address"]),
          remoteAddress: this._str(item["remote-address"]),
          raw: item
        }))
        .filter((item) => item.name && ["pppoe", "any"].includes(item.service.trim().toLowerCase()));
    });
  }
  async getActiveSessions() {
    return this._withConnection("active PPPoE session query", async (connection) => {
      const rows = await connection.write("/ppp/active/print");
      return (Array.isArray(rows) ? rows : []).filter((item) => this._str(item.service).toLowerCase() === "pppoe").map((item) => ({ id: this._str(item[".id"]), username: this._str(item.name), service: this._str(item.service), address: this._str(item.address), uptime: this._str(item.uptime), callerId: this._str(item["caller-id"]), bytesIn: this._str(item["bytes-in"]), bytesOut: this._str(item["bytes-out"]), encoding: this._str(item.encoding), sessionId: this._str(item["session-id"]), radius: this._str(item.radius), raw: item })).filter((item) => item.username);
    });
  }
  async getHotspotUsers() {
    return this._withConnection("Hotspot user query", async (connection) => {
      const rows = await connection.write("/ip/hotspot/user/print");
      return (Array.isArray(rows) ? rows : []).map((item) => ({
        id: this._str(item[".id"]), username: this._str(item.name), password: this._str(item.password),
        profile: this._str(item.profile), disabled: this._bool(item.disabled), server: this._str(item.server),
        comment: this._str(item.comment), uptime: this._str(item.uptime),
        limitUptime: this._str(item["limit-uptime"]), limitBytesTotal: this._number(item["limit-bytes-total"]),
        bytesIn: this._number(item["bytes-in"]), bytesOut: this._number(item["bytes-out"]), raw: item
      })).filter((item) => item.username);
    });
  }

  async getHotspotExpirationSnapshot() {
    return this._withConnection("Hotspot expiry snapshot", async (connection) => {
      const userRows = await connection.write("/ip/hotspot/user/print");
      const schedulerRows = await connection.write("/system/scheduler/print");
      const users = (Array.isArray(userRows) ? userRows : []).map((item) => ({
        id: this._str(item[".id"]),
        username: this._str(item.name),
        profile: this._str(item.profile),
        disabled: this._bool(item.disabled),
        comment: this._str(item.comment),
        uptime: this._str(item.uptime),
        limitUptime: this._str(item["limit-uptime"]),
        limitBytesTotal: this._number(item["limit-bytes-total"]),
        bytesIn: this._number(item["bytes-in"]),
        bytesOut: this._number(item["bytes-out"])
      })).filter((item) => item.username);
      const schedulerNames = (Array.isArray(schedulerRows) ? schedulerRows : [])
        .map((item) => this._str(item.name))
        .filter(Boolean);
      return { users, schedulerNames };
    });
  }

  async cleanupExpiredHotspotUser(usernameValue) {
    const username = this._str(usernameValue).trim();
    if (!username || username.length > 100) throw new Error("A valid Hotspot username is required for expiration cleanup.");
    return this._withConnection("expired Hotspot user cleanup", async (connection) => {
      const userRows = await connection.write("/ip/hotspot/user/print");
      const activeRows = await connection.write("/ip/hotspot/active/print");
      const schedulerRows = await connection.write("/system/scheduler/print");
      const matches = (Array.isArray(userRows) ? userRows : []).filter(item =>
        this._str(item.name).trim().toLowerCase() === username.toLowerCase() && item[".id"]);
      const activeMatches = (Array.isArray(activeRows) ? activeRows : []).filter(item =>
        this._str(item.user).trim().toLowerCase() === username.toLowerCase() && item[".id"]);
      const schedulerName = ("faz-exp-" + username).toLowerCase();
      const schedulerMatches = (Array.isArray(schedulerRows) ? schedulerRows : []).filter(item =>
        this._str(item.name).trim().toLowerCase() === schedulerName && item[".id"]);

      for (const session of activeMatches) {
        await connection.write("/ip/hotspot/active/remove", ["=.id=" + session[".id"]]);
      }
      for (const scheduler of schedulerMatches) {
        await connection.write("/system/scheduler/remove", ["=.id=" + scheduler[".id"]]);
      }
      for (const user of matches) {
        await connection.write("/ip/hotspot/user/remove", ["=.id=" + user[".id"]]);
      }
      return { username, sessionsRemoved: activeMatches.length, usersRemoved: matches.length, schedulersRemoved: schedulerMatches.length, alreadyAbsent: matches.length === 0 };
    });
  }
  async getHotspotUser(usernameValue) {
    const username=this._str(usernameValue).trim();
    if(!username||username.length>100) throw new Error("A valid Hotspot username is required.");
    return this._withConnection("Hotspot user lookup",async(connection)=>{
      const rows=await connection.write("/ip/hotspot/user/print");
      const item=(Array.isArray(rows)?rows:[]).find(row=>this._str(row.name).toLowerCase()===username.toLowerCase());
      if(!item) return null;
      return {id:this._str(item[".id"]),username:this._str(item.name),password:this._str(item.password),profile:this._str(item.profile),disabled:this._bool(item.disabled),limitUptime:this._str(item["limit-uptime"]),limitBytesTotal:this._number(item["limit-bytes-total"]),comment:this._str(item.comment),bytesIn:this._number(item["bytes-in"]),bytesOut:this._number(item["bytes-out"]),raw:item};
    });
  }
  async getHotspotActiveSession(usernameValue) {
    const username=this._str(usernameValue).trim();
    if(!username||username.length>100) throw new Error("A valid Hotspot username is required.");
    return this._withConnection("Hotspot active session lookup",async(connection)=>{
      const rows=await connection.write("/ip/hotspot/active/print");
      const item=(Array.isArray(rows)?rows:[]).find(row=>this._str(row.user).toLowerCase()===username.toLowerCase());
      if(!item) return null;
      return {username:this._str(item.user),address:this._str(item.address),uptime:this._str(item.uptime),bytesIn:this._number(item["bytes-in"]),bytesOut:this._number(item["bytes-out"]),mac:this._str(item["mac-address"])};
    });
  }
  async getHotspotProfiles() {
    return this._withConnection("Hotspot profile query", async (connection) => {
      const rows = await connection.write("/ip/hotspot/user/profile/print");
      return (Array.isArray(rows) ? rows : []).map((item) => ({ id:this._str(item[".id"]), name: this._str(item.name), rateLimit: this._str(item["rate-limit"]), sharedUsers: this._str(item["shared-users"]), sessionTimeout: this._str(item["session-timeout"]), idleTimeout: this._str(item["idle-timeout"]), keepaliveTimeout: this._str(item["keepalive-timeout"]), statusAutorefresh: this._str(item["status-autorefresh"]), raw: item })).filter((item) => item.name && !this._isSystemProfileName(item.name));
    });
  }
  async createHotspotProfile(data) {
    const name=this._str(data.name).trim();
    if(!name) throw new Error("Hotspot profile name is required.");
    if(this._isSystemProfileName(name)) throw new Error("System/internal profile names are reserved.");
    return this._withConnection("Hotspot profile creation",async(connection)=>{
      const params=this._writeParams({name,"rate-limit":data.rateLimit,"shared-users":data.sharedUsers||1,"session-timeout":data.clearSessionTimeout?undefined:data.sessionTimeout,"keepalive-timeout":data.keepaliveTimeout,"on-login":data.onLogin});
      await connection.write("/ip/hotspot/user/profile/add",params); return {name};
    });
  }
  async updateHotspotProfile(data) {
    const name=this._str(data.name).trim();
    if(!name) throw new Error("Hotspot profile name is required.");
    if(this._isSystemProfileName(name)) throw new Error("System/internal MikroTik profiles are protected and cannot be edited.");
    return this._withConnection("Hotspot profile update",async(connection)=>{
      const rows=await connection.write("/ip/hotspot/user/profile/print");
      const item=(Array.isArray(rows)?rows:[]).find(x=>this._str(x.name)===name);
      if(!item||!item[".id"]) throw new Error("Hotspot profile \""+name+"\" was not found on MikroTik.");
      const params=this._writeParams({".id":item[".id"],"rate-limit":data.rateLimit,"shared-users":data.sharedUsers||1,"session-timeout":data.clearSessionTimeout?undefined:data.sessionTimeout,"keepalive-timeout":data.keepaliveTimeout,"on-login":data.onLogin});
      if(data.clearSessionTimeout)params.push("=session-timeout=");
      await connection.write("/ip/hotspot/user/profile/set",params); return {name,id:this._str(item[".id"])};
    });
  }
  async deleteHotspotProfile(nameValue) {
    const name=this._str(nameValue).trim();
    if(!name) throw new Error("Hotspot profile name is required.");
    if(this._isSystemProfileName(name)) throw new Error("System/internal MikroTik profiles are protected and cannot be deleted.");
    return this._withConnection("Hotspot profile deletion",async(connection)=>{
      const rows=await connection.write("/ip/hotspot/user/profile/print");
      const item=(Array.isArray(rows)?rows:[]).find(x=>this._str(x.name)===name);
      if(!item||!item[".id"]) throw new Error("Hotspot profile \""+name+"\" was not found on MikroTik.");
      await connection.write("/ip/hotspot/user/profile/remove",["=.id="+item[".id"]]); return {name,id:this._str(item[".id"])};
    });
  }

  async createHotspotUser(data) {
    const username=this._str(data.username).trim(), password=this._str(data.password), profile=this._str(data.profile).trim();
    if(!username || !password || !profile) throw new Error("Hotspot username, password, and profile are required.");
    return this._withConnection("Hotspot user creation", async (connection) => { const params=this._writeParams({ name: username, password, profile, server:data.server, "limit-uptime":data.timeLimit||data["limit-uptime"], "limit-bytes-total":data.dataLimit||data["limit-bytes-total"], comment:data.comment }); await connection.write("/ip/hotspot/user/add", params); return { username }; });
  }
  async kickActiveHotspotUser(username,idValue) {
    const name=this._str(username).trim(), requestedId=this._str(idValue).trim();
    if(!name&&!requestedId) throw new Error("Hotspot username or session id is required.");
    return this._withConnection("active Hotspot user kick", async (connection) => {
      let matches=[];
      if(requestedId) matches=[{".id":requestedId,user:name}];
      else {
        const rows=await connection.write("/ip/hotspot/active/print");
        matches=(Array.isArray(rows)?rows:[]).filter((item)=>this._str(item.user)===name && item[".id"]);
      }
      for(const session of matches) await connection.write("/ip/hotspot/active/remove",["=.id="+session[".id"]]);
      return {username:name,kicked:matches.length>0,count:matches.length,id:requestedId||this._str(matches[0]?.[".id"])};
    });
  }
  async rechargeHotspotUser(data) {
    const username=this._str(data.username).trim(),password=this._str(data.password),profile=this._str(data.profile).trim(),validity=this._str(data.validity).trim(),limitBytesTotal=Math.max(0,Number(data.limitBytesTotal)||0);
    if(!username||!password||!profile||(!validity&&!limitBytesTotal))throw new Error("Hotspot recharge requires username, password, profile, and time validity or a data quota.");
    const limits={"limit-uptime":validity||undefined,"limit-bytes-total":String(Math.floor(limitBytesTotal))};
    return this._withConnection("Hotspot user recharge",async(connection)=>{
      const rows=await connection.write("/ip/hotspot/user/print");
      const matches=(Array.isArray(rows)?rows:[]).filter(item=>this._str(item.name)===username&&item[".id"]);
      const comment=data.comment||("FAZ NETWORK | Recharge | "+username);
      if(matches.length){
        const item=matches[0];
        await connection.write("/ip/hotspot/user/set",this._writeParams({".id":item[".id"],password,profile,disabled:false,...limits,comment}));
        await connection.write("/ip/hotspot/user/reset-counters",["=.id="+item[".id"]]);
        const activeRows=await connection.write("/ip/hotspot/active/print");
        for(const session of (Array.isArray(activeRows)?activeRows:[]).filter(s=>this._str(s.user)===username&&s[".id"]))await connection.write("/ip/hotspot/active/remove",["=.id="+session[".id"]]);
        return {username,profile,validity,limitBytesTotal,created:false};
      }
      await connection.write("/ip/hotspot/user/add",this._writeParams({name:username,password,profile,server:data.server||"all",...limits,comment}));
      return {username,profile,validity,limitBytesTotal,created:true};
    });
  }

  async removeHotspotUser(username) {
    const name=this._str(username).trim(); if(!name) throw new Error("Hotspot username is required.");
    return this._withConnection("Hotspot user removal", async (connection) => {
      const rows=await connection.write("/ip/hotspot/user/print");
      const matches=(Array.isArray(rows)?rows:[]).filter((item)=>this._str(item.name)===name && item[".id"]);
      if(!matches.length) throw new Error("Hotspot user \""+name+"\" was not found on MikroTik.");
      for(const item of matches) await connection.write("/ip/hotspot/user/remove", ["=.id="+item[".id"]]);
      return { username:name, removed:matches.length };
    });
  }
  async getActiveHotspotSessions() {
    return this._withConnection("active Hotspot session query", async (connection) => {
      const rows=await connection.write("/ip/hotspot/active/print");
      return (Array.isArray(rows)?rows:[]).map((item)=>({ id:this._str(item[".id"]), username:this._str(item.user), address:this._str(item.address), macAddress:this._str(item["mac-address"]), uptime:this._str(item.uptime), bytesIn:this._number(item["bytes-in"]), bytesOut:this._number(item["bytes-out"]), sessionTimeLeft:this._str(item["session-time-left"]), idleTime:this._str(item["idle-time"]), server:this._str(item.server), profile:this._str(item.profile), raw:item })).filter((item)=>item.username&&item.id);
    });
  }

  async getRouterIdentity() {
    try {
      return await this._withConnection("MikroTik identity query", async (connection) => {
        const rows = await connection.write("/system/identity/print");
        const name = this._str(Array.isArray(rows) ? rows[0]?.name : rows?.name).trim();
        return name || "MikroTik";
      });
    } catch (error) {
      console.warn("[MikroTik] Router identity unavailable; using fallback:", error?.message || error);
      return "MikroTik";
    }
  }

  async getIpPools() {
    return this._withConnection("IP pool query", async (connection) => {
      const rows = await connection.write("/ip/pool/print");
      return (Array.isArray(rows) ? rows : []).map((item) => ({
        id: this._str(item[".id"]),
        name: this._str(item.name),
        ranges: this._str(item.ranges),
        nextPool: this._str(item["next-pool"]) || "none",
        raw: item
      })).filter((item) => item.name && item.id);
    });
  }

  async getUsedIpPools() {
    return this._withConnection("IP pool allocation query", async (connection) => {
      const rows = await connection.write("/ip/pool/used/print");
      return (Array.isArray(rows) ? rows : []).map((item) => ({
        id: this._str(item[".id"]),
        pool: this._str(item.pool),
        address: this._str(item.address),
        owner: this._str(item.owner),
        info: this._str(item.info)
      })).filter((item) => item.pool && item.address);
    });
  }

  async createIpPool(data) {
    const name=this._str(data.name).trim(), ranges=this._str(data.ranges).trim(), nextPool=this._str(data.nextPool).trim() || "none";
    if(!name||!ranges) throw new Error("IP pool name and ranges are required.");
    return this._withConnection("IP pool creation",async(connection)=>{
      await connection.write("/ip/pool/add",this._writeParams({name,ranges,"next-pool":nextPool}));
      return {name,ranges,nextPool};
    });
  }

  _extractRouterError(error) {
    const candidates=[error,error?.cause,error?.error,error?.response,error?.data].filter(Boolean);
    for(const item of candidates){
      const message=this._str(item?.message||item?.["=message"]||item?.error).trim();
      const category=this._str(item?.category||item?.["=category"]).trim();
      if(message)return {message,category};
    }
    return {message:"MikroTik rejected the IP pool operation.",category:""};
  }
  async _findIpPool(connection,identifier) {
    const key=this._str(identifier).trim(), rows=await connection.write("/ip/pool/print"), items=Array.isArray(rows)?rows:[];
    const match=items.find(item=>this._str(item[".id"])===key)||items.find(item=>this._str(item.name)===key);
    if(!match||!match[".id"]) throw new Error('MikroTik IP pool "'+key+'" was not found.');
    if(/^default(?:[-_].*)?$/i.test(this._str(match.name))) throw new Error("The default system IP pool cannot be modified.");
    return match;
  }
  async updateIpPool(originalName,data) {
     const key=this._str(originalName).trim();
     const name=this._str(data.name).trim(), ranges=this._str(data.ranges).trim();
     const nextPool=this._str(data.nextPool).trim();
     if(!key) throw new Error("Pool identifier and ranges are required");
     if(!name||!ranges) throw new Error("IP pool name and ranges are required.");
     return this._withConnection("IP pool update",async(connection)=>{
       // Resolve the current RouterOS ID from this live session.
       const item=await this._findIpPool(connection,key);
       const targetId=this._str(item[".id"]).trim();
       const targetNextPool=nextPool&&nextPool.toLowerCase()!=="none"?nextPool:"none";
       const params=[
         "=.id="+targetId,
         "=name="+name,
         "=ranges="+ranges,
         "=next-pool="+targetNextPool
       ];
       await connection.write("/ip/pool/set",params);
       return {id:targetId,name,ranges,nextPool:targetNextPool};
     });
   }
   async deleteIpPool(originalName) {
     const key=this._str(originalName).trim();
     if(!key) throw new Error("Pool identifier is required");
     return this._withConnection("IP pool deletion",async(connection)=>{
       // Resolve the current RouterOS ID by exact pool name in the same session.
       const item=await this._findIpPool(connection,key);
       const targetId=this._str(item[".id"]).trim();
       await connection.write("/ip/pool/remove",["=.id="+targetId]);
       return {id:targetId,name:this._str(item.name).trim()};
     });
   }
  async createProfile(data) {
    const name=this._str(data.name).trim();
    if(!name)throw new Error("Profile name is required.");
    if(this._isSystemProfileName(name))throw new Error("System/internal profile names are reserved.");
    return this._withConnection("PPPoE profile creation",async(connection)=>{
      const params=this._writeParams({
        name,
        "rate-limit":data.rateLimit,
        "local-address":data.localAddress,
        "remote-address":data.remoteAddress,
        "dns-server":data.dnsServer,
        "change-tcp-mss":data.changeTcpMss||"default"
      });
      await connection.write("/ppp/profile/add",params);
      return {name};
    });
  }

  async updateProfile(identifier,data){
    const key=this._str(identifier).trim();
    if(this._isSystemProfileName(data?.name)||this._isSystemProfileName(key)) throw new Error("System/internal MikroTik PPP profiles are protected and cannot be edited.");
    return this._withConnection("PPPoE profile update",async(connection)=>{
      const rows=await connection.write("/ppp/profile/print");
      const items=Array.isArray(rows)?rows:[];
      const item=items.find(x=>this._str(x[".id"])===key)||items.find(x=>this._str(x.name)===key);
      if(!item||!item[".id"])throw new Error("PPPoE profile not found.");
      if(this._isSystemProfileName(item.name)||this._isSystemProfileName(data?.name))throw new Error("System/internal MikroTik PPP profiles are protected and cannot be edited.");
      const params=[
        "=.id="+item[".id"],
        "=name="+this._str(data.name).trim(),
        "=local-address="+this._str(data.localAddress??data["local-address"]),
        "=remote-address="+this._str(data.remoteAddress??data["remote-address"]),
        "=dns-server="+this._str(data.dnsServer??data["dns-server"]),
        "=change-tcp-mss="+(this._str(data.changeTcpMss??data["change-tcp-mss"])||"default"),
        "=rate-limit="+this._str(data.rateLimit??data["rate-limit"])
      ];
      await connection.write("/ppp/profile/set",params);
      return {id:this._str(item[".id"]),name:this._str(data.name).trim()};
    });
  }

  async isProfileInUse(profileName){
    const name=this._str(profileName).trim();
    if(!name)return false;
    return this._withConnection("PPPoE profile usage check",async(connection)=>{
      const rows=await connection.write("/ppp/secret/print");
      return (Array.isArray(rows)?rows:[]).some(item=>this._str(item.profile).trim().toLowerCase()===name.toLowerCase());
    });
  }

  async removeProfile(identifier){
    const key=this._str(identifier).trim();
    if(this._isSystemProfileName(key)) throw new Error("System/internal MikroTik PPP profiles are protected and cannot be deleted.");
    return this._withConnection("PPPoE profile removal",async(connection)=>{
      const rows=await connection.write("/ppp/profile/print");
      const items=Array.isArray(rows)?rows:[];
      const item=items.find(x=>this._str(x[".id"])===key)||items.find(x=>this._str(x.name)===key);
      if(!item||!item[".id"])throw new Error("PPPoE profile not found.");
      const profileName=this._str(item.name);
      if(this._isSystemProfileName(profileName))throw new Error("System/internal MikroTik PPP profiles are protected and cannot be deleted.");
      try{
        await connection.write("/ppp/profile/remove",["=.id="+item[".id"]]);
      }catch(error){
        const message=this._str(error?.message||error).trim();
        if(/used|in use|reference|referenced/i.test(message))throw new Error('MikroTik profile "'+profileName+'" is in use and cannot be deleted. Disconnect or reassign its users first.');
        throw error;
      }
      return {id:this._str(item[".id"]),name:profileName,removed:true};
    });
  }

  async createSecret(data) {
    const name = this._str(data.username).trim(); const password = this._str(data.password); const profile = this._str(data.profile).trim();
    if (!name || !password || !profile) throw new Error("Username, password, and profile are required.");
    return this._withConnection("PPPoE user creation", async (connection) => { const params = this._writeParams({ name, password, profile, service: "pppoe", "caller-id": data.callerId, comment: data.comment, disabled: data.disabled ? "yes" : undefined }); await connection.write("/ppp/secret/add", params); return { username: name }; });
  }
  async renewSecret(username, data) {
    const name = this._str(username).trim();
    const comment = this._str(data?.comment).trim();
    if (!name || !comment) throw new Error("PPPoE username and renewal comment are required.");
    return this._withConnection("PPPoE user renewal", async (connection) => {
      const secret = await this._findSecret(connection, name);
      const params = ["=.id=" + secret[".id"], "=comment=" + comment, "=disabled=" + (data?.disabled ? "yes" : "no")];
      const cmdArray=["/ppp/secret/set",...params];
      console.log("[MIKROTIK PPP SET CMD]:",cmdArray);
      await connection.write(cmdArray);
      return { username: name, id: this._str(secret[".id"]), disabled: Boolean(data?.disabled), comment };
    });
  }

  async removeCustomer(username) {
    const name = this._str(username).trim();
    if (!name) throw new Error("PPPoE username is required.");
    return this._withConnection("PPPoE customer removal", async (connection) => {
      // Remove active sessions even if the secret was already removed manually.
      const activeRows = await connection.write("/ppp/active/print");
      const active = (Array.isArray(activeRows) ? activeRows : []).filter(item =>
        this._str(item.name).trim().toLowerCase() === name.toLowerCase() && item[".id"]
      );
      for (const session of active) {
        await connection.write("/ppp/active/remove", ["=.id=" + session[".id"]]);
      }

      const secretRows = await connection.write("/ppp/secret/print");
      const secret = (Array.isArray(secretRows) ? secretRows : []).find(item =>
        this._str(item.name).trim().toLowerCase() === name.toLowerCase()
      );
      if (secret && secret[".id"]) {
        await connection.write("/ppp/secret/remove", ["=.id=" + secret[".id"]]);
      }

      // Confirm RouterOS has no matching secret before reporting success.
      const remainingRows = await connection.write("/ppp/secret/print");
      const remains = (Array.isArray(remainingRows) ? remainingRows : []).some(item =>
        this._str(item.name).trim().toLowerCase() === name.toLowerCase()
      );
      if (remains) {
        throw new Error('MikroTik still reports PPPoE secret "' + name + '" after removal.');
      }
      return {
        username: name,
        secretId: this._str(secret?.[".id"]),
        terminatedSessions: active.length,
        removed: Boolean(secret),
        alreadyAbsent: !secret,
        verifiedAbsent: true
      };
    });
  }

  async removeSecret(username) {
    const name = this._str(username).trim();
    if (!name) throw new Error("PPPoE username is required.");

    return this._withConnection("PPPoE user removal", async (connection) => {
      const secret = await this._findSecret(connection, name);
      await connection.write("/ppp/secret/remove", ["=.id=" + secret[".id"]]);
      return { username: name, removed: true };
    });
  }
  async _findSecret(connection, username) { const rows = await connection.write("/ppp/secret/print"); const match = (Array.isArray(rows) ? rows : []).find((item) => this._str(item.name) === username); if (!match || !match[".id"]) throw new Error("PPPoE user \"" + username + "\" was not found on MikroTik."); return match; }
  async updateSecretIdentity(username, data) {
    const oldName = this._str(username).trim();
    const newName = this._str(data?.username).trim();
    if (!oldName || !newName) throw new Error("Current and new PPPoE username are required.");
    return this._withConnection("PPPoE user identity update", async (connection) => {
      const secret = await this._findSecret(connection, oldName);
      const params = [
        "=.id=" + secret[".id"],
        "=name=" + newName,
        "=password=" + this._str(data?.password),
        "=profile=" + this._str(data?.profile),
        ...(data?.allowStaticRemoteAddress && this._validStaticRemoteAddress(data?.remoteAddress)
          ? ["=remote-address=" + this._validStaticRemoteAddress(data?.remoteAddress)]
          : []),
        "=comment=" + this._str(data?.comment),
        "=disabled=" + (data?.disabled ? "yes" : "no")
      ];
      const cmdArray=["/ppp/secret/set",...params];
      console.log("[MIKROTIK PPP SET CMD]:",cmdArray);
      await connection.write(cmdArray);
      return { username: newName, previousUsername: oldName, id: this._str(secret[".id"]) };
    });
  }

  _validStaticRemoteAddress(value){
    const ip=this._str(value).trim();
    if(!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip))return undefined;
    if(!ip.split(".").every(octet=>Number(octet)>=0&&Number(octet)<=255))return undefined;
    return ip;
  }

  async updateSecret(username,data){
    const name=this._str(username).trim();
    return this._withConnection("PPPoE user update",async(connection)=>{
      const secret=await this._findSecret(connection,name);
      const params=this._writeParams({
        password:data.password,
        profile:data.profile,
        "remote-address":data.allowStaticRemoteAddress ? this._validStaticRemoteAddress(data.remoteAddress) : undefined,
        "caller-id":data.callerId,
        comment:data.comment,
        disabled:data.disabled?"yes":"no"
      });
      const cmdArray=["/ppp/secret/set","=.id="+secret[".id"],...params];
      console.log("[MIKROTIK PPP SET CMD]:",cmdArray);
      await connection.write(cmdArray);
      return {username:name};
    });
  }

  async ensureExpiredProfile(){
    const name="EXPIRED-PROFILE";
    const existing=await this.fetchExistingProfiles();
    const profile=(Array.isArray(existing)?existing:[]).find(item=>String(item.name||"").toLowerCase()===name.toLowerCase());
    if(!profile){
      await this.createProfile({name,rateLimit:"1k/1k",changeTcpMss:"default"});
      return {name,rateLimit:"1k/1k",created:true};
    }
    if(String(profile.rateLimit||"").trim()!=="1k/1k"){
      await this.updateProfile(profile.id||name,{name,rateLimit:"1k/1k",localAddress:profile.localAddress||"",remoteAddress:profile.remoteAddress||"",dnsServer:profile.dnsServer||"",changeTcpMss:profile.changeTcpMss||"default"});
    }
    return {name,rateLimit:"1k/1k",created:false};
  }

  async changeSecretProfile(username,profileName){
    const name=this._str(username).trim();
    const profile=this._str(profileName).trim();
    if(!name||!profile)throw new Error("PPPoE username and profile are required.");
    return this._withConnection("PPPoE package profile change",async(connection)=>{
      const secret=await this._findSecret(connection,name);
      const cmdArray=["/ppp/secret/set","=.id="+secret[".id"],"=profile="+profile];
      console.log("[MIKROTIK PPP SET CMD]:",cmdArray);
      await connection.write(cmdArray);
      return {username:name,profile};
    });
  }
  async toggleSecret(username, disabled) {
    const name=this._str(username).trim();
    return this._withConnection("PPPoE user toggle",async(connection)=>{
      const secret=await this._findSecret(connection,name);
      const cmdArray=["/ppp/secret/set","=.id="+secret[".id"],"=disabled="+(disabled?"yes":"no")];
      console.log("[MIKROTIK PPP SET CMD]:",cmdArray);
      await connection.write(cmdArray);
      return {username:name,disabled:Boolean(disabled)};
    });
  }
  async kickActiveUser(username) { const name = this._str(username).trim(); return this._withConnection("active PPPoE user kick", async (connection) => { const rows = await connection.write("/ppp/active/print"); const matches = (Array.isArray(rows) ? rows : []).filter((item) => this._str(item.name) === name && this._str(item.service).toLowerCase() === "pppoe" && item[".id"]); if (!matches.length) return { username: name, kicked: false, count: 0, message: "User is not currently online." }; for (const session of matches) await connection.write("/ppp/active/remove", ["=.id=" + session[".id"]]); return { username: name, kicked: true, count: matches.length }; }); }
}

module.exports = new MikroTikService();
