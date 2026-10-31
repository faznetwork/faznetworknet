'use strict';

const { resolveHotspotPackage } = require('./hotspotProfileConfig');

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function resolveCatalogEntry(profileKey, metadata) {
  const key = String(profileKey || '').trim();
  if (!key || key.toLowerCase() === 'default' || key.length > 120 || !asPlainObject(metadata)) return null;

  const retailPrice = Number(metadata.price);
  if (!Number.isFinite(retailPrice) || retailPrice < 0) {
    console.warn('[POP Hotspot packages] Skipping core profile with invalid retail price.', { profileKey: key });
    return null;
  }

  let resolved;
  try {
    resolved = resolveHotspotPackage({}, metadata);
  } catch (error) {
    console.warn('[POP Hotspot packages] Skipping core profile with invalid validity metadata.', {
      profileKey: key, message: error.message
    });
    return null;
  }

  const validity = String(
    metadata.validityLabel ||
    metadata.validity ||
    (Number(metadata.validityValue) > 0 && metadata.validityUnit
      ? Number(metadata.validityValue) + ' ' + String(metadata.validityUnit)
      : '') ||
    (Number(metadata.limitBytesTotal || metadata.limit_bytes_total) > 0
      ? (Number(metadata.limitBytesTotal || metadata.limit_bytes_total) / 1073741824) + ' GB'
      : '')
  ).trim();
  if (!validity || validity.length > 50) {
    console.warn('[POP Hotspot packages] Skipping core profile without a valid package validity label.', { profileKey: key });
    return null;
  }

  const timeLimit = String(metadata.timeLimit || metadata.time_limit || resolved.validity || '').trim() || null;
  const dataLimit = String(metadata.dataLimit || metadata.data_limit || '').trim() || null;
  return {
    profileKey: key,
    packageName: key,
    validity,
    timeLimit,
    dataLimit,
    retailPrice: retailPrice.toFixed(2)
  };
}

async function syncPopPackages(client, popId) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('A transactional PostgreSQL client is required to synchronize POP Hotspot packages.');
  }
  const settings = await client.query(
    "SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1"
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
         (pop_id,package_name,profile_key,validity,time_limit,data_limit,retail_price,wholesale_price,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7::numeric,$7::numeric,'active')
       ON CONFLICT (pop_id,profile_key) DO NOTHING
       RETURNING id`,
      [popId, entry.packageName, entry.profileKey, entry.validity, entry.timeLimit, entry.dataLimit, entry.retailPrice]
    );
    if (inserted.rows?.length) created += 1;
  }
  return { created, skipped, reason: null };
}

module.exports = { syncPopPackages, resolveCatalogEntry };
