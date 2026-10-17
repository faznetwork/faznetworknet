"use strict";
// Compatibility shim: subscriber profile operations are unified in hotspotUserController.
// All profile writes are PostgreSQL-only in the safety-scoped Subscriber 360 rebuild.
module.exports = require("./hotspotUserController");
