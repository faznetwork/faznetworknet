'use strict';

// Delegate to the canonical RBAC guard so database-backed account status and
// the supported legacy shared-admin session follow the same authorization rules.
const { requireRole } = require('./rbac');
module.exports = requireRole(['super_admin']);
