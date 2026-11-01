-- FAZ NETWORK | Reseller billing and POP Hotspot package automation
-- Forward-only and idempotent. Existing balances and POP package overrides are preserved.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';
SET LOCAL idle_in_transaction_session_timeout = '120s';

SELECT pg_advisory_xact_lock(
  hashtext('faznetwork:reseller-hotspot-automation:v1')
);

DO $preflight$
BEGIN
  IF to_regclass('public.reseller_billing_accounts') IS NULL THEN
    RAISE EXCEPTION 'Reseller Hotspot automation aborted: public.reseller_billing_accounts does not exist; apply the reseller voucher foundation migration first.';
  END IF;
  IF to_regclass('public.reseller_voucher_batches') IS NULL
     OR to_regclass('public.pop_hotspot_packages') IS NULL
     OR to_regclass('public.pop_hotspot_bindings') IS NULL THEN
    RAISE EXCEPTION 'Reseller Hotspot automation aborted: reseller voucher tables are incomplete; apply the reseller voucher foundation migration first.';
  END IF;
  IF to_regclass('public.app_settings') IS NULL THEN
    RAISE EXCEPTION 'Reseller Hotspot automation aborted: public.app_settings does not exist.';
  END IF;
END
$preflight$;

-- Existing resellers receive one default prepaid account only when none exists.
-- ON CONFLICT protects concurrent provisioning and never overwrites balances or policy.
INSERT INTO public.reseller_billing_accounts
  (reseller_id,billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status,created_at,updated_at)
SELECT r.id,'prepaid',0.00,0.00,0.00,'BDT','active',NOW(),NOW()
FROM public.resellers r
WHERE NOT EXISTS (
  SELECT 1
  FROM public.reseller_billing_accounts rba
  WHERE rba.reseller_id=r.id
)
ON CONFLICT (reseller_id) DO NOTHING;

-- Materialize core profile metadata for POPs that already have an active Hotspot
-- binding and a non-empty IP pool. Existing POP-level price/status overrides survive.
WITH settings AS (
  SELECT value::jsonb AS profiles
  FROM public.app_settings
  WHERE key='hotspot_profile_metadata'
  LIMIT 1
),
core_profiles AS (
  SELECT
    profile.profile_key,
    profile.profile_meta,
    COALESCE(
      NULLIF(BTRIM(profile.profile_meta->>'validityLabel'),''),
      NULLIF(BTRIM(profile.profile_meta->>'validity'),''),
      CASE
        WHEN LOWER(COALESCE(profile.profile_meta->>'validityUnit','')) IN ('gb','data','quota')
          AND NULLIF(profile.profile_meta->>'validityValue','') IS NOT NULL
          THEN (profile.profile_meta->>'validityValue') || ' GB'
        WHEN NULLIF(profile.profile_meta->>'validityValue','') IS NOT NULL
          AND NULLIF(profile.profile_meta->>'validityUnit','') IS NOT NULL
          THEN (profile.profile_meta->>'validityValue') || ' ' || (profile.profile_meta->>'validityUnit')
        WHEN COALESCE(NULLIF(profile.profile_meta->>'limitBytesTotal','')::numeric,
                      NULLIF(profile.profile_meta->>'limit_bytes_total','')::numeric,0) > 0
          THEN ROUND(COALESCE(NULLIF(profile.profile_meta->>'limitBytesTotal','')::numeric,
                              NULLIF(profile.profile_meta->>'limit_bytes_total','')::numeric)/1073741824.0,2)::text || ' GB'
        ELSE NULL
      END
    ) AS validity,
    COALESCE(NULLIF(profile.profile_meta->>'timeLimit',''),
             NULLIF(profile.profile_meta->>'time_limit',''),
             CASE LOWER(COALESCE(profile.profile_meta->>'validityUnit',''))
               WHEN 'minutes' THEN (profile.profile_meta->>'validityValue') || 'm'
               WHEN 'hours' THEN (profile.profile_meta->>'validityValue') || 'h'
               WHEN 'days' THEN (profile.profile_meta->>'validityValue') || 'd'
               WHEN 'months' THEN ((profile.profile_meta->>'validityValue')::numeric * 30)::text || 'd'
               ELSE NULL
             END) AS time_limit,
    COALESCE(NULLIF(profile.profile_meta->>'dataLimit',''),
             NULLIF(profile.profile_meta->>'data_limit','')) AS data_limit,
    COALESCE(NULLIF(profile.profile_meta->>'price','')::numeric,0)::numeric(12,2) AS retail_price
  FROM settings
  CROSS JOIN LATERAL jsonb_each(
    CASE WHEN jsonb_typeof(settings.profiles)='object' THEN settings.profiles ELSE '{}'::jsonb END
  ) AS profile(profile_key,profile_meta)
  WHERE LOWER(profile.profile_key)<>'default'
    AND jsonb_typeof(profile.profile_meta)='object'
    AND LENGTH(BTRIM(profile.profile_key)) BETWEEN 1 AND 120
)
INSERT INTO public.pop_hotspot_packages
  (pop_id,package_name,profile_key,validity,time_limit,data_limit,retail_price,wholesale_price,status)
SELECT
  p.id,cp.profile_key,cp.profile_key,cp.validity,cp.time_limit,cp.data_limit,
  cp.retail_price,cp.retail_price,'active'
FROM public.pops p
INNER JOIN public.pop_hotspot_bindings b
  ON b.pop_id=p.id AND b.status='active' AND NULLIF(BTRIM(b.ip_pool),'') IS NOT NULL
INNER JOIN core_profiles cp
  ON cp.validity IS NOT NULL
 AND LENGTH(BTRIM(cp.validity)) BETWEEN 1 AND 50
 AND cp.retail_price >= 0
WHERE p.status='active'
ON CONFLICT (pop_id,profile_key) DO NOTHING;

COMMIT;
