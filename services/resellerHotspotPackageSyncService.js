'use strict';

const { resolveHotspotPackage } = require('./hotspotProfileConfig');

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function resolveCatalogEntry(profileKey, metadata) {
  const key = String(profileKey || '').trim();
  if (!key || key.toLowerCase() === 'default' || key.length > 120 || !asPlainObject(metadata)) return null;

  const retailPrice = Number(metadata.price);
  const retailCents = Math.round(retailPrice * 100);
  if (!Number.isFinite(retailPrice) || retailPrice < 0 || !Number.isSafeInteger(retailCents)) {
    console.warn('[POP Hotspot packages] Skipping core profile with invalid retail price.', { profileKey: key });
    return null;
  }
  const wholesaleCents = (BigInt(retailCents) * 70n + 50n) / 100n;
  const wholesalePrice = (wholesaleCents / 100n).toString() + '.' + (wholesaleCents % 100n).toString().padStart(2, '0');

  let resolved;
  try {
    resolved = resolveHotspotPackage({}, metadata);
  } catch (error) {
    console.warn('[POP Hotspot packages] Skipping core profile with invalid validity metadata.', {
      profileKey: key, message: error.message
    });
    return null;
  }
  if (!resolved || resolved.type === 'INVALID') {
    console.warn('[POP Hotspot packages] Skipping core profile with unsupported validity metadata.', { profileKey: key });
    return null;
  }

  const packageName = String(metadata.label || metadata.packageName || metadata.package_name || key).trim();
  if (!packageName || packageName.length > 120) {
    console.warn('[POP Hotspot packages] Skipping core profile with invalid package label.', { profileKey: key });
    return null;
  }
  const durationMs = Number(resolved.durationMs || 0);
  if (!Number.isSafeInteger(durationMs) || durationMs < 0 || durationMs % 1000 !== 0) {
    console.warn('[POP Hotspot packages] Skipping core profile with invalid duration.', { profileKey: key });
    return null;
  }
  const dataLimitBytes = Math.max(0, Math.floor(Number(resolved.limitBytesTotal || 0)));
  if (!Number.isSafeInteger(dataLimitBytes)) {
    console.warn('[POP Hotspot packages] Skipping core profile with invalid data quota.', { profileKey: key });
    return null;
  }

  return {
    profileKey: key,
    packageName,
    validitySeconds: String(durationMs / 1000),
    dataLimitBytes: dataLimitBytes > 0 ? dataLimitBytes : null,
    retailPrice: (retailCents / 100).toFixed(2),
    wholesalePrice
  };
}

async function syncPopPackages(client, popId) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('A transactional PostgreSQL client is required to materialize POP Hotspot packages.');
  }
  const settings = await client.query(
    "SELECT value FROM public.app_settings WHERE key='hotspot_profile_metadata' LIMIT 1"
  );
  const raw = settings.rows?.[0]?.value;
  if (raw == null || String(raw).trim() === '') {
    return { created: 0, updated: 0, deactivated: 0, skipped: 0, reason: 'core_profile_metadata_not_configured' };
  }

  let metadata;
  try {
    metadata = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (error) {
    throw new Error('The saved core Hotspot profile metadata is not valid JSON: ' + error.message);
  }
  if (!asPlainObject(metadata)) {
    throw new Error('The saved core Hotspot profile metadata must be a JSON object keyed by profile name.');
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const syncedKeys = [];
  for (const [profileKey, profileMetadata] of Object.entries(metadata)) {
    const entry = resolveCatalogEntry(profileKey, profileMetadata);
    if (!entry) {
      skipped += 1;
      continue;
    }
    // Panel is the master: an existing POP row is updated in place so price,
    // validity, quota and active state stay in sync with the core profile.
    // (xmax = 0) distinguishes a fresh insert from an ON CONFLICT update.
    const result = await client.query(
      `INSERT INTO public.pop_hotspot_packages
         (pop_id,package_name,profile_key,validity_seconds,data_limit_bytes,retail_price,wholesale_price,is_active)
       VALUES ($1,$2,$3,$4::bigint,$5::bigint,$6::numeric,$7::numeric,TRUE)
       ON CONFLICT (pop_id,profile_key) DO UPDATE SET
         package_name=EXCLUDED.package_name,
         validity_seconds=EXCLUDED.validity_seconds,
         data_limit_bytes=EXCLUDED.data_limit_bytes,
         retail_price=EXCLUDED.retail_price,
         wholesale_price=EXCLUDED.wholesale_price,
         is_active=TRUE,
         updated_at=NOW()
       RETURNING id, (xmax = 0) AS inserted`,
      [popId, entry.packageName, entry.profileKey, entry.validitySeconds, entry.dataLimitBytes, entry.retailPrice, entry.wholesalePrice]
    );
    if (result.rows?.length) {
      if (result.rows[0].inserted === false) updated += 1;
      else created += 1;
    }
    syncedKeys.push(entry.profileKey);
  }

  // A profile removed from core metadata stops selling: deactivate its POP
  // rows instead of leaving a stale package on sale. Guarded so a transient
  // empty/invalid metadata read can never wipe the catalogue: deactivation
  // runs only when at least one profile synced successfully.
  let deactivated = 0;
  if (syncedKeys.length) {
    const deactivatedResult = await client.query(
      `UPDATE public.pop_hotspot_packages
          SET is_active=FALSE, updated_at=NOW()
        WHERE pop_id=$1 AND is_active=TRUE AND NOT (profile_key = ANY($2::text[]))`,
      [popId, syncedKeys]
    );
    deactivated = Number(deactivatedResult?.rowCount || 0);
  }
  return { created, updated, deactivated, skipped, reason: null };
}

async function syncAllPopPackages(client) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('A PostgreSQL client is required to sync POP Hotspot packages.');
  }
  const pops = await client.query('SELECT id FROM public.pops ORDER BY id ASC');
  const results = [];
  for (const pop of pops.rows || []) {
    const popId = Number(pop.id);
    if (!Number.isSafeInteger(popId) || popId < 1) continue;
    const result = await syncPopPackages(client, popId);
    results.push({ popId, ...result });
  }
  return results;
}

module.exports = { syncPopPackages, syncAllPopPackages, resolveCatalogEntry };
