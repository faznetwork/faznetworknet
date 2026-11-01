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

  return {
    profileKey: key,
    packageName,
    validitySeconds: String(durationMs / 1000),
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
    return { created: 0, skipped: 0, reason: 'core_profile_metadata_not_configured' };
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
  let skipped = 0;
  for (const [profileKey, profileMetadata] of Object.entries(metadata)) {
    const entry = resolveCatalogEntry(profileKey, profileMetadata);
    if (!entry) {
      skipped += 1;
      continue;
    }
    const inserted = await client.query(
      `INSERT INTO public.pop_hotspot_packages
         (pop_id,package_name,profile_key,validity_seconds,retail_price,wholesale_price,is_active)
       VALUES ($1,$2,$3,$4::bigint,$5::numeric,$6::numeric,TRUE)
       ON CONFLICT (pop_id,profile_key) DO NOTHING
       RETURNING id`,
      [popId, entry.packageName, entry.profileKey, entry.validitySeconds, entry.retailPrice, entry.wholesalePrice]
    );
    if (inserted.rows?.length) created += 1;
  }
  return { created, skipped, reason: null };
}

module.exports = { syncPopPackages, resolveCatalogEntry };
