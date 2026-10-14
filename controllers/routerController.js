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

    const key = interfaceName.toLowerCase();
    let role = String(req.query.role || "").trim().toLowerCase();
    if (role !== "wan" && role !== "lan") {
      if (/(wan|ether|sfp|starlink|pppoe-out|eoip|wireguard|l2tp|sstp|ovpn|openvpn|gre|ipip|ipsec|lte|tunnel|(^|[\s_-])wg(?:\d|[\s_-]|$))/i.test(key)) role = "wan";
      else if (/(bridge|lan|wlan|wifi|wireless)/i.test(key)) role = "lan";
      else role = "wan";
    }

    const traffic = await mikrotikService.getInterfaceTraffic(interfaceName);
    const rawRxBps = Number(traffic.rxBitsPerSecond);
    const rawTxBps = Number(traffic.txBitsPerSecond);
    if (!Number.isFinite(rawRxBps) || rawRxBps < 0 || !Number.isFinite(rawTxBps) || rawTxBps < 0) {
      throw new Error("MikroTik returned invalid numeric interface rates.");
    }

    const downloadBps = role === "lan" ? rawTxBps : rawRxBps;
    const uploadBps = role === "lan" ? rawRxBps : rawTxBps;
    return res.json({
      success: true,
      interface: interfaceName,
      role,
      rx: rawRxBps,
      tx: rawTxBps,
      rawRxBps,
      rawTxBps,
      downloadBps,
      uploadBps,
      timestamp: Date.now()
    });
  } catch (error) {
    console.warn("[Router API] live traffic poll failed:", error.message || error);
    return res.status(503).json({
      success: false,
      error: "Live traffic poll failed; retrying.",
      timestamp: Date.now()
    });
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
