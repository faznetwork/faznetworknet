const mikrotikService = require("../services/mikrotikService");
const db = require("../db");
const {evaluateCustomerBillingStatus}=require("../utils/billingStatus");

function errorResponse(res, error) {
  console.error("[PPPoE API]", error);
  const message = error?.message || "PPPoE operation failed.";
  return res.status(error?.statusCode || 503).json({
    success: false,
    users: [],
    profiles: [],
    message,
    error: message
  });
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "yes";
}

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function extractExpiryDate(comment) {
  const match = String(comment || "").match(/(?:^|[|;\s])EXP:\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
  if (!match) return "";
  const value = match[1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [, day, month, year] = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) || [];
  if (!day) return "";
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return parsed.getUTCFullYear() === Number(year) && parsed.getUTCMonth() === Number(month) - 1 && parsed.getUTCDate() === Number(day)
    ? year + "-" + month + "-" + day
    : "";
}

function extractPhone(comment) {
  const text = String(comment || "");
  const match = text.match(/(?:phone|mobile|tel|মোবাইল|ফোন)\s*[:=-]?\s*([+\d][\d\s-]{7,})/i);
  return match ? match[1].trim() : "";
}

function buildSyncPhone(username) {
  const crypto = require("crypto");
  const normalized = String(username || "").trim().toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]/g, "").slice(0, 20) || "user";
  const digest = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return ("SYNC-" + slug + "-" + digest).slice(0, 40);
}

async function syncFromRouter(options = {}) {
  const onlyUsername = clean(options.onlyUsername, 100).toLowerCase();
  const [profiles, fetchedSecrets] = await Promise.all([
    onlyUsername ? Promise.resolve([]) : mikrotikService.fetchExistingProfiles(),
    mikrotikService.fetchExistingSecrets()
  ]);
  const secrets = onlyUsername
    ? fetchedSecrets.filter(user => String(user.name || "").trim().toLowerCase() === onlyUsername)
    : fetchedSecrets;
  const routerId = String(process.env.ROUTER_HOST || "");
  const summary = {
    profiles: 0, users: 0, importedCustomers: 0, existingCustomers: 0,
    skippedDeleted: [], failedUsers: [], failedCustomerImports: []
  };

  await db.withTransaction(async (client) => {
    // Sync is non-destructive: existing Billing Panel customers are never deleted
    // or overwritten by a MikroTik import. Tombstoned usernames remain protected.
    const tombstoneResult = await client.query("SELECT LOWER(username) AS username FROM customer_deletion_tombstones");
    const deletedUsernames = new Set(tombstoneResult.rows.map(row => String(row.username || "").toLowerCase()));

    for (const profile of profiles) {
      await client.query(
        `INSERT INTO pppoe_profiles
          (name, rate_limit, local_address, remote_address, session_timeout, idle_timeout, only_one, change_tcp_mss, comment, router_id, raw_config, synced_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW(),NOW())
         ON CONFLICT (name) DO UPDATE SET
           rate_limit=EXCLUDED.rate_limit, local_address=EXCLUDED.local_address, remote_address=EXCLUDED.remote_address,
           session_timeout=EXCLUDED.session_timeout, idle_timeout=EXCLUDED.idle_timeout, only_one=EXCLUDED.only_one,
           change_tcp_mss=EXCLUDED.change_tcp_mss, comment=EXCLUDED.comment, router_id=EXCLUDED.router_id,
           raw_config=EXCLUDED.raw_config, synced_at=NOW(), updated_at=NOW()`,
        [
          profile.name, profile.rateLimit, profile.localAddress, profile.remoteAddress, profile.sessionTimeout,
          profile.idleTimeout, profile.onlyOne, profile.changeTcpMss, profile.comment, routerId, JSON.stringify(profile.raw || {})
        ]
      );
      summary.profiles++;
    }

    for (const user of secrets) {
      const username = String(user.name || "").trim().slice(0, 100);
      const usernameKey = username.toLowerCase();
      if (!usernameKey) continue;
      if (deletedUsernames.has(usernameKey)) {
        summary.skippedDeleted.push(username);
        console.log("[PPPoE SYNC] Protected explicitly deleted username; no delete or automatic restore performed:", username);
        continue;
      }

      await client.query("SAVEPOINT pppoe_user_sync");
      try {
        const comment = user.comment || "";
        await client.query(
          `INSERT INTO pppoe_users
            (username, password, profile, service, caller_id, disabled, comment, phone, local_address, remote_address, router_id, raw_config, expiry_date, status, synced_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::date,CASE WHEN $13::date IS NOT NULL AND $13::date < (NOW() AT TIME ZONE 'Asia/Dhaka')::date THEN 'expired' ELSE 'active' END,NOW(),NOW())
           ON CONFLICT (username) DO UPDATE SET
             password=COALESCE(EXCLUDED.password, pppoe_users.password), profile=EXCLUDED.profile, service=EXCLUDED.service,
             caller_id=COALESCE(NULLIF(EXCLUDED.caller_id,''),pppoe_users.caller_id), disabled=EXCLUDED.disabled, comment=EXCLUDED.comment,
             phone=COALESCE(NULLIF(EXCLUDED.phone,''), pppoe_users.phone), local_address=EXCLUDED.local_address,
             remote_address=EXCLUDED.remote_address, router_id=EXCLUDED.router_id, raw_config=EXCLUDED.raw_config, expiry_date=EXCLUDED.expiry_date,
             status=EXCLUDED.status, synced_at=NOW(), updated_at=NOW()`,
          [
            username, user.password, user.profile, user.service, user.callerId, user.disabled, comment,
            extractPhone(comment).slice(0, 40), user.localAddress, user.remoteAddress, routerId, JSON.stringify(user.raw || {}), extractExpiryDate(comment)
          ]
        );
        summary.users++;

        // Per-customer import savepoint means one duplicate phone or malformed
        // record cannot rollback other synced users.
        await client.query("SAVEPOINT billing_customer_import");
        try {
          const existingCustomer = await client.query(
            "SELECT id FROM customers WHERE LOWER(username)=LOWER($1) LIMIT 1",
            [username]
          );
          if (existingCustomer.rows.length) {
            summary.existingCustomers++;
          } else {
            const commentText = String(comment || "").trim();
            const importedName = (commentText.match(/Customer:\s*([^|]+)/i)?.[1] || commentText.split("|")[0] || username).trim().slice(0, 200) || username;
            const importedExpiry = extractExpiryDate(comment) || null;
            const importedProfile = String(user.profile || "Imported").trim().slice(0, 100) || "Imported";
            const phoneFromComment = extractPhone(comment).slice(0, 40);
            let importedPhone = phoneFromComment || buildSyncPhone(username);
            const phoneTaken = await client.query("SELECT 1 FROM customers WHERE phone=$1 LIMIT 1", [importedPhone]);
            if (phoneTaken.rows.length) importedPhone = buildSyncPhone(username);

            let salt = 0;
            while (true) {
              const phoneCollision = await client.query("SELECT 1 FROM customers WHERE phone=$1 LIMIT 1", [importedPhone]);
              if (!phoneCollision.rows.length) break;
              salt++;
              importedPhone = buildSyncPhone(username + ":" + salt);
              if (salt > 5) throw new Error("Could not generate a unique import phone placeholder.");
            }

            const inserted = await client.query(
              `INSERT INTO customers
                (full_name, phone, connection_date, username, password, package_name, profile,
                 monthly_bill, expiration_date, provisioning_status, status, router_id, created_at, updated_at)
               SELECT $1,$2,(NOW() AT TIME ZONE 'Asia/Dhaka')::date,$3,$4,
                      LEFT(COALESCE(p.plan_name,$5),100),$5,COALESCE(p.price,0),$6::date,'provisioned',
                      CASE WHEN $6::date IS NOT NULL AND $6::date < (NOW() AT TIME ZONE 'Asia/Dhaka')::date THEN 'expired' ELSE 'active' END,
                      $7,NOW(),NOW()
               FROM (SELECT 1) seed
               LEFT JOIN LATERAL (
                 SELECT plan_name, price FROM packages
                 WHERE LOWER(profile_name)=LOWER($5) OR LOWER(plan_name)=LOWER($5)
                 ORDER BY CASE WHEN LOWER(profile_name)=LOWER($5) THEN 0 ELSE 1 END
                 LIMIT 1
               ) p ON TRUE
               ON CONFLICT (username) DO NOTHING`,
              [importedName, importedPhone, username, user.password || "", importedProfile, importedExpiry, routerId]
            );
            if (inserted.rowCount) summary.importedCustomers++;
            else summary.existingCustomers++;
          }
          await client.query("RELEASE SAVEPOINT billing_customer_import");
        } catch (importError) {
          await client.query("ROLLBACK TO SAVEPOINT billing_customer_import");
          await client.query("RELEASE SAVEPOINT billing_customer_import");
          summary.failedCustomerImports.push({ username, reason: importError.message || "Billing customer import failed." });
          console.warn("[PPPoE SYNC] Router user synced, but Billing customer import failed for " + username + ":", importError.message);
        }
        await client.query("RELEASE SAVEPOINT pppoe_user_sync");
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT pppoe_user_sync");
        await client.query("RELEASE SAVEPOINT pppoe_user_sync");
        summary.failedUsers.push({ username, reason: error.message || "PPPoE user sync failed." });
        console.warn("[PPPoE SYNC] A single PPPoE sync failed; other records are preserved:", username, error.message);
      }
    }
  });
  return summary;
}

const crypto = require("crypto");

function secureTokenEqual(expected, supplied) {
  const a = Buffer.from(String(expected || ""));
  const b = Buffer.from(String(supplied || ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function ingestLiveSessions(req, res) {
  try {
    const body = req.body || {};
    if (!Array.isArray(body.sessions) || body.sessions.length > 5000) {
      return res.status(400).json({ success: false, message: "sessions must be an array containing 0–5000 entries." });
    }
    const declaredCount = Number(body.count);
    if (!Number.isInteger(declaredCount) || declaredCount !== body.sessions.length) {
      return res.status(400).json({ success: false, message: "count must equal sessions.length." });
    }

    const sessions = [];
    const seen = new Set();
    for (const item of body.sessions) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return res.status(400).json({ success: false, message: "Each session must be an object." });
      }
      const username = clean(item.username, 100);
      if (!username) return res.status(400).json({ success: false, message: "Every session requires username." });
      const key = username.toLowerCase();
      if (seen.has(key)) return res.status(400).json({ success: false, message: "Duplicate username in session snapshot: " + username });
      seen.add(key);
      const service = clean(item.service || "pppoe", 40).toLowerCase();
      if (service !== "pppoe") continue;
      const bytes = value => {
        if (value === undefined || value === null || value === "") return 0;
        const n = Number(value);
        if (!Number.isSafeInteger(n) || n < 0) throw new Error("Session byte counters must be non-negative safe integers.");
        return n;
      };
      sessions.push({
        username, address: clean(item.address, 64) || null,
        uptime: clean(item.uptime, 80) || null, service,
        bytesIn: bytes(item.bytesIn), bytesOut: bytes(item.bytesOut),
        callerId: clean(item.callerId || item["caller-id"], 100) || null
      });
    }

    const client = await db.getPool().connect();
    try {
      await client.query("BEGIN");
      // Replace the complete snapshot atomically so disconnected users do not remain online.
      await client.query("DELETE FROM pppoe_live_sessions");
      for (const session of sessions) {
        await client.query(
          `INSERT INTO pppoe_live_sessions
             (username, address, uptime, service, bytes_in, bytes_out, caller_id, received_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
          [session.username, session.address, session.uptime, session.service, String(session.bytesIn), String(session.bytesOut), session.callerId]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch (_) {}
      throw error;
    } finally {
      client.release();
    }
    return res.status(200).json({
      success: true, code: 200, received: body.sessions.length, stored: sessions.length,
      receivedAt: new Date().toISOString(), source: "mikrotik-push"
    });
  } catch (error) {
    console.error("[PPPoE session ingest]", error.message);
    return res.status(400).json({ success: false, message: error.message || "Unable to store PPPoE sessions." });
  }
}

const syncSessions = [function authenticatePppoeAgent(req, res, next) {
  const expected = String(process.env.PPPOE_SESSION_SYNC_TOKEN || process.env.OLT_COLLECTOR_TOKEN || "");
  const authorization = String(req.get("authorization") || "");
  const supplied = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!expected) return res.status(503).json({ success: false, message: "PPPoE session sync token is not configured." });
  if (!secureTokenEqual(expected, supplied)) return res.status(401).json({ success: false, message: "Unauthorized PPPoE session collector." });
  return next();
}, ingestLiveSessions];

async function users(req, res) {
  try {
    const filter = clean(req.query.filter || "all", 40).toLowerCase();
    const allowedFilters = new Set([
      "all", "online", "offline", "active", "expire",
      "expire_today_yesterday", "expire_7_days", "new", "due"
    ]);
    if (!allowedFilters.has(filter)) {
      return res.status(400).json({
        success: false,
        error: "Invalid customer filter.",
        allowedFilters: Array.from(allowedFilters)
      });
    }

    const conditions = [];
    const params = [];

    if (filter === "active") {
      conditions.push("u.status = 'active'");
      conditions.push("(u.expiry_date IS NULL OR u.expiry_date >= (NOW() AT TIME ZONE 'Asia/Dhaka')::date)");
      conditions.push("u.disabled = FALSE");
    } else if (filter === "expire") {
      conditions.push("u.expiry_date IS NOT NULL");
      conditions.push("u.expiry_date IS NOT NULL");
      conditions.push("u.expiry_date < (NOW() AT TIME ZONE 'Asia/Dhaka')::date");
    } else if (filter === "expire_today_yesterday") {
      conditions.push("u.expiry_date IS NOT NULL");
      conditions.push("u.expiry_date BETWEEN ((NOW() AT TIME ZONE 'Asia/Dhaka')::date - INTERVAL '1 day') AND (NOW() AT TIME ZONE 'Asia/Dhaka')::date");
    } else if (filter === "expire_7_days") {
      conditions.push("u.expiry_date IS NOT NULL");
      conditions.push("u.expiry_date BETWEEN (NOW() AT TIME ZONE 'Asia/Dhaka')::date AND ((NOW() AT TIME ZONE 'Asia/Dhaka')::date + INTERVAL '7 days')");
    } else if (filter === "new") {
      conditions.push("u.created_at >= NOW() - INTERVAL '7 days'");
    } else if (filter === "due") {
      conditions.push("(u.expiry_date IS NOT NULL AND u.expiry_date < (NOW() AT TIME ZONE 'Asia/Dhaka')::date) OR LOWER(COALESCE(u.status, '')) IN ('disabled', 'left', 'terminated') OR u.disabled = TRUE");
    }

    const whereClause = conditions.length ? "WHERE " + conditions.map(c => "(" + c + ")").join(" AND ") : "";

    const result = await db.query(`
      SELECT u.*,
             c.id AS customer_id, c.created_at AS customer_created_at,
             c.expiration_date AS customer_expiration_date,
             c.package_name AS customer_package_name,
             c.profile AS customer_profile,
             c.status AS customer_billing_state
      FROM pppoe_users u
      LEFT JOIN customers c ON LOWER(c.username)=LOWER(u.username)
      ${whereClause}
      ORDER BY COALESCE(c.created_at, '1970-01-01'::timestamp) ASC, c.username ASC, c.id ASC
    `, params);

    // Use the live RouterOS active-session table for the current online state.
    // Only use a recent pushed snapshot when the RouterOS read fails.
    let liveRows;
    try {
      liveRows = await mikrotikService.getActiveSessions();
      if (!Array.isArray(liveRows)) throw new Error("Invalid MikroTik active-session response.");
    } catch (liveError) {
      console.warn("[PPPoE API] Live session lookup unavailable:", liveError.message);
      const snapshot = await db.query(
        `SELECT username,address,uptime,service,bytes_in AS "bytesIn",
                bytes_out AS "bytesOut",caller_id AS "callerId",received_at AS "receivedAt"
         FROM pppoe_live_sessions
         WHERE received_at >= NOW() - INTERVAL '3 minutes'
         ORDER BY username ASC`
      );
      if (!snapshot.rows.length) {
        return res.status(503).json({success:false,users:[],profiles:[],code:"LIVE_SESSION_SOURCE_UNAVAILABLE",message:"Live session data is unavailable; customer status was not inferred."});
      }
      liveRows = snapshot.rows;
    }
    const sessionMap = new Map();
    for (const session of liveRows) {
      const username = String(session.username || "").trim().toLowerCase();
      if (username && !sessionMap.has(username)) sessionMap.set(username, session);
    }

    let users = result.rows.map(user => {
      const session = sessionMap.get(String(user.username || "").trim().toLowerCase());
      // Billing/customer metadata must come from the same canonical row as All Customer.
      // MikroTik/pppoe_users is authoritative only for live session and router fields.
      const hasCustomerRecord = user.customer_id != null;
      const canonicalExpiry = hasCustomerRecord ? (user.customer_expiration_date || null) : (user.expiry_date || null);
      const billing=evaluateCustomerBillingStatus({expiration_date:canonicalExpiry});
      return {
        ...user,
        package_name: (hasCustomerRecord ? user.customer_package_name : null) || user.package_name || user.customer_profile || user.profile || "",
        profile: (hasCustomerRecord ? user.customer_profile : null) || user.profile || "",
        expiration_date: canonicalExpiry,
        expiry_date: canonicalExpiry,
        customer_billing_state: user.customer_billing_state || null,
        billing_status:billing.status,
        billing_badge_class:billing.badgeClass,
        badgeClass:billing.badgeClass,
        billing_label:billing.label,
        days_left:billing.daysLeft,
        active: Boolean(session),
        online: Boolean(session),
        session: session || null,
        session_ip: session?.address || null,
        session_uptime: session?.uptime || null,
        session_caller_id: session?.callerId || null,
        computed_status:billing.status
      };
    });

    if (filter === "online") users = users.filter(user => user.online);
    if (filter === "offline") users = users.filter(user => !user.online);

    return res.json({
      success: true,
      count: users.length,
      filter,
      users
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function profiles(req, res) {
  try {
    const result = await db.query("SELECT * FROM pppoe_profiles WHERE LOWER(name) NOT LIKE '%default%' AND LOWER(name) <> 'vpn' AND LOWER(name) NOT LIKE 'template-%' AND LOWER(name) NOT LIKE 'internal-%' AND LOWER(name) NOT LIKE 'system-%' ORDER BY name ASC");
    res.json({ success: true, profiles: result.rows });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function active(req, res) {
  try {
    const result = await db.query(
      `SELECT username, address, uptime, service, bytes_in AS "bytesIn",
              bytes_out AS "bytesOut", caller_id AS "callerId", received_at AS "receivedAt"
       FROM pppoe_live_sessions
       WHERE received_at >= NOW() - INTERVAL '3 minutes'
       ORDER BY username ASC`
    );
    return res.json({ success: true, count: result.rows.length, sessions: result.rows, source: "mikrotik-push", stale: result.rows.length === 0 });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function createUser(req, res) {
  try {
    const username = clean(req.body.username, 100);
    const password = String(req.body.password ?? "").trim();
    const profile = clean(req.body.profile, 100);
    const callerId = clean(req.body.callerId, 100);
    const comment = clean(req.body.comment, 500);
    const disabled = normalizeBoolean(req.body.disabled);
    if (!username || !password || !profile) {
      return res.status(400).json({ success: false, error: "Username, password, and profile are required." });
    }
    await mikrotikService.createSecret({ username, password, profile, callerId, comment, disabled });
    await syncFromRouter();
    res.json({ success: true, message: "PPPoE user created on MikroTik and synced to database." });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function updateUser(req, res) {
  try {
    const username = clean(req.body.username, 100);
    if (!username) return res.status(400).json({ success: false, error: "Username is required." });
    const data = {
      password: String(req.body.password ?? "").trim(),
      profile: clean(req.body.profile, 100),
      callerId: clean(req.body.callerId, 100),
      comment: clean(req.body.comment, 500),
      disabled: normalizeBoolean(req.body.disabled)
    };
    if (!data.profile) return res.status(400).json({ success: false, error: "Profile is required." });
    await mikrotikService.updateSecret(username, data);
    await syncFromRouter();
    res.json({ success: true, message: "PPPoE user updated and synchronized." });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function toggleUser(req, res) {
  try {
    const username = clean(req.body.username, 100);
    const disabled = normalizeBoolean(req.body.disabled);
    if (!username) return res.status(400).json({ success: false, error: "Username is required." });
    await mikrotikService.toggleSecret(username, disabled);
    await db.query("UPDATE pppoe_users SET disabled=$1, updated_at=NOW() WHERE username=$2", [disabled, username]);
    res.json({ success: true, username, disabled });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function kickUser(req, res) {
  try {
    const username = clean(req.body.username, 100);
    if (!username) return res.status(400).json({ success: false, error: "Username is required." });
    const result = await mikrotikService.kickActiveUser(username);
    res.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function createProfile(req, res) {
  try {
    const data = {
      name: clean(req.body.name, 100),
      rateLimit: clean(req.body.rateLimit, 100),
      localAddress: clean(req.body.localAddress, 100),
      remoteAddress: clean(req.body.remoteAddress, 100),
      sessionTimeout: clean(req.body.sessionTimeout, 50),
      idleTimeout: clean(req.body.idleTimeout, 50),
      comment: clean(req.body.comment, 500),
      onlyOne: normalizeBoolean(req.body.onlyOne),
      changeTcpMss: normalizeBoolean(req.body.changeTcpMss)
    };
    if (!data.name) return res.status(400).json({ success: false, error: "Profile name is required." });
    await mikrotikService.createProfile(data);
    await syncFromRouter();
    res.json({ success: true, message: "Profile created on MikroTik and synchronized." });
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function restoreUserToPanel(req, res) {
  const username = clean(req.body?.username, 100);
  if (!username) return res.status(400).json({ success: false, message: "PPPoE username is required." });

  let previousTombstone = null;
  try {
    // This explicit admin action restores only a secret that really exists on
    // MikroTik. RouterOS configuration is read-only; no secret/session is changed.
    const secret = await mikrotikService.getPppoeSecret(username);
    if (!secret) {
      return res.status(404).json({ success: false, message: `MikroTik PPPoE secret "${username}" was not found; nothing was changed.` });
    }

    const previous = await db.query(
      "SELECT username, customer_id, deleted_at FROM customer_deletion_tombstones WHERE LOWER(username)=LOWER($1) LIMIT 1",
      [username]
    );
    previousTombstone = previous.rows[0] || null;
    await db.query("DELETE FROM customer_deletion_tombstones WHERE LOWER(username)=LOWER($1)", [username]);

    try {
      await syncFromRouter({ onlyUsername: username });
      const restored = await db.query(
        "SELECT id, username, full_name, phone, package_name, profile, expiration_date, provisioning_status, status FROM customers WHERE LOWER(username)=LOWER($1) LIMIT 1",
        [username]
      );
      if (!restored.rows.length) {
        const err = new Error("MikroTik user was found, but the Billing Panel customer row could not be created. Check for a duplicate phone number or database constraint.");
        err.statusCode = 409;
        throw err;
      }
      return res.json({
        success: true,
        message: `Restored ${username} into FAZ NETWORK Billing Panel. MikroTik secret and active session were not changed.`,
        customer: restored.rows[0]
      });
    } catch (syncError) {
      // If restoration failed, reinstate the protection that existed before
      // this explicit attempt. A failed restore must not silently un-delete.
      if (previousTombstone) {
        await db.query(
          "INSERT INTO customer_deletion_tombstones(username, customer_id, deleted_at) VALUES($1,$2,$3) ON CONFLICT(username) DO UPDATE SET customer_id=EXCLUDED.customer_id, deleted_at=EXCLUDED.deleted_at",
          [previousTombstone.username, previousTombstone.customer_id, previousTombstone.deleted_at]
        );
      }
      throw syncError;
    }
  } catch (error) {
    return errorResponse(res, error);
  }
}

async function removeUser(req,res){
  // Keep PPPoE deletion on the exact same unconditional deletion path used
  // by /api/customers/:id so either endpoint handles customer IDs, PPPoE
  // usernames, router-synced users, and already-partially-deleted records.
  const customerController=require("./customerController");
  return customerController.removeCustomer(req,res);
}

module.exports = { users, profiles, active, syncSessions, createUser, updateUser, toggleUser, kickUser, createProfile, restoreUserToPanel, removeUser };
