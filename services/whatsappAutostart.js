"use strict";

// Permanent single-owner rule for the WhatsApp socket: it autostarts ONLY on
// Render (RENDER=true, set automatically by Render) or when WHATSAPP_ENABLED
// is explicitly "true". The PC never autostarts it any more.
//
// Why: the PC used to grab the socket lease on every boot, so Render could
// never be the stable owner and the Notification Hub kept showing
// "owned_elsewhere" forever. That red badge kept inviting an Unlink click,
// and Unlink deletes the shared PostgreSQL login — so the device kept
// "auto-disconnecting" after every PC restart. Render is always on, so it
// owns the socket; the PC only connects when someone clicks Connect /
// Reconnect manually. This gate controls the boot-time autostart only.
function resolveWhatsappAutostart(env = process.env) {
  return env.RENDER === "true" || env.WHATSAPP_ENABLED === "true";
}

module.exports = { resolveWhatsappAutostart };
