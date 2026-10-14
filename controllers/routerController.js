const mikrotikService = require("../services/mikrotikService");

const sendFallback = (res, label, error, data) => {
  const message = error && error.message ? error.message : "Unknown MikroTik service error";
  console.warn("[Router API] " + label + " unavailable; returning fallback:", message);
  return res.status(200).json({
    success: false,
    degraded: true,
    error: message,
    ...data
  });
};

exports.test = async (req, res) => {
  try {
    const result = await mikrotikService.testConnection();
    res.json({ success: true, routerName: result.routerName, version: result.version });
  } catch (error) {
    sendFallback(res, "connection test", error, { routerName: "MikroTik", version: "N/A" });
  }
};

exports.resources = async (req, res) => {
  try {
    const resources = await mikrotikService.getSystemResources();
    res.json({ success: true, resources });
  } catch (error) {
    sendFallback(res, "resource query", error, { resources: { cpuLoad: 0, freeMemoryMb: 0, totalMemoryMb: 0, memoryUsedMb: 0, memoryUsagePercent: 0, uptime: "N/A", version: "N/A" } });
  }
};

exports.interfaces = async (req, res) => {
  try {
    const interfaces = await mikrotikService.getInterfaces();
    res.json({ success: true, interfaces });
  } catch (error) {
    sendFallback(res, "interface query", error, { interfaces: [] });
  }
};

exports.traffic = async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  try {
    const interfaceName = String(req.query.interface || "").trim();
    if (!interfaceName || interfaceName.length > 100 || /[\r\n\0]/.test(interfaceName)) {
      return res.status(400).json({ error: "A valid interface query parameter is required." });
    }

    // Prefer the role supplied by the interface selector; infer only unambiguous names otherwise.
    let role = String(req.query.role || "").trim().toLowerCase();
    if (role !== "wan" && role !== "lan") {
      const key = interfaceName.toLowerCase();
      if (/(pppoe|wireguard|eoip|l2tp|sstp|ovpn|openvpn|gre|ipip|ipsec|lte|starlink|wan|uplink|external|internet|isp|provider|tunnel)/i.test(key)) role = "wan";
      else if (/(bridge|lan|subscriber|onu|distribution|access|switch|ether|sfp|vlan|bonding)/i.test(key)) role = "lan";
      else return res.status(400).json({ error: "Interface role is ambiguous; choose a WAN or LAN interface from the dashboard." });
    }

    const traffic = await mikrotikService.getInterfaceTraffic(interfaceName);
    const rxBps = Math.max(0, Number(traffic.rxBitsPerSecond) || 0);
    const txBps = Math.max(0, Number(traffic.txBitsPerSecond) || 0);
    // WAN RX/TX maps to download/upload; subscriber-facing LAN reverses the direction.
    return res.json({
      rx: (role === "wan" ? rxBps : txBps) / 8,
      tx: (role === "wan" ? txBps : rxBps) / 8,
      timestamp: Date.now()
    });
  } catch (error) {
    console.warn("[Router API] live traffic unavailable:", error.message || error);
    return res.status(503).json({ error: "Live traffic is temporarily unavailable.", timestamp: Date.now() });
  }
};

exports.vpn = async (req, res) => {
  try {
    const inventory = await mikrotikService.getVpnInventory();
    return res.json({ success: true, ...inventory });
  } catch (error) {
    return sendFallback(res, "VPN inventory", error, {
      sections: { wireguard: [], l2tp: [], sstp: [], openvpn: [], ipsecPeers: [] },
      warnings: [{ section: "VPN inventory", message: "MikroTik VPN configuration could not be read." }]
    });
  }
};

exports.portForwarding = async (req, res) => {
  try {
    const rules = await mikrotikService.getPortForwardRules();
    return res.json({ success: true, rules });
  } catch (error) {
    return sendFallback(res, "port forwarding inventory", error, { rules: [] });
  }
};
