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
  try {
    const interfaceName = String(req.query.interface || "").trim();
    if (!interfaceName) {
      return res.status(400).json({
        success: false,
        error: "Query parameter 'interface' is required."
      });
    }

    const traffic = await mikrotikService.getInterfaceTraffic(interfaceName);
    res.json({ success: true, traffic });
  } catch (error) {
    sendFallback(res, "traffic query", error, { traffic: { rxMbps: 0, txMbps: 0, rxBps: 0, txBps: 0 } });
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
