-- Enable the core ISP operational modules for tenants whose module map predates
-- tenant-scoped operational workspaces. Explicitly disabled flags are preserved.
BEGIN;
UPDATE public.tenants
SET modules = COALESCE(modules, '{}'::jsonb) ||
  jsonb_build_object(
    'customers', CASE WHEN COALESCE(modules, '{}'::jsonb) ? 'customers' THEN modules->'customers' ELSE 'true'::jsonb END,
    'hotspot', CASE WHEN COALESCE(modules, '{}'::jsonb) ? 'hotspot' THEN modules->'hotspot' ELSE 'true'::jsonb END,
    'billing', CASE WHEN COALESCE(modules, '{}'::jsonb) ? 'billing' THEN modules->'billing' ELSE 'true'::jsonb END,
    'pppoe', CASE WHEN COALESCE(modules, '{}'::jsonb) ? 'pppoe' THEN modules->'pppoe' ELSE 'true'::jsonb END,
    'mikrotik', CASE WHEN COALESCE(modules, '{}'::jsonb) ? 'mikrotik' THEN modules->'mikrotik' ELSE 'true'::jsonb END,
    'olt', CASE WHEN COALESCE(modules, '{}'::jsonb) ? 'olt' THEN modules->'olt' ELSE 'true'::jsonb END,
    'reports', CASE WHEN COALESCE(modules, '{}'::jsonb) ? 'reports' THEN modules->'reports' ELSE 'true'::jsonb END
  ),
  updated_at = NOW()
WHERE modules IS NULL
   OR NOT (modules ? 'customers')
   OR NOT (modules ? 'hotspot')
   OR NOT (modules ? 'billing')
   OR NOT (modules ? 'pppoe')
   OR NOT (modules ? 'mikrotik')
   OR NOT (modules ? 'olt')
   OR NOT (modules ? 'reports');
COMMIT;
