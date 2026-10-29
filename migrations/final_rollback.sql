-- Guarded rollback for the matching local-clone migration. Does not delete data or snapshots.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
LOCK TABLE router_devices IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE customers IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE pppoe_profiles IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$ DECLARE canonical_id TEXT; BEGIN
 SELECT id::TEXT INTO canonical_id FROM router_devices WHERE host='10.10.10.1' AND api_port=8728 AND api_type='native_api' ORDER BY id LIMIT 1;
 IF canonical_id IS NULL THEN RAISE EXCEPTION 'Canonical router not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM faz_router_reconcile_backup WHERE migration_id='router-reconcile-v1') OR NOT EXISTS(SELECT 1 FROM faz_pppoe_profile_router_backup WHERE migration_id='router-reconcile-v1') THEN RAISE EXCEPTION 'Required snapshots missing'; END IF;
 IF EXISTS(SELECT 1 FROM faz_customer_router_backup b WHERE b.migration_id='router-reconcile-v1' AND NOT EXISTS(SELECT 1 FROM customers c WHERE c.id=b.customer_id)) THEN RAISE EXCEPTION 'Snapshotted customer disappeared'; END IF;
 IF EXISTS(SELECT 1 FROM faz_customer_router_backup b JOIN customers c ON c.id=b.customer_id WHERE b.migration_id='router-reconcile-v1' AND c.router_id IS DISTINCT FROM canonical_id) THEN RAISE EXCEPTION 'Customer router_id changed since migration'; END IF;
 IF EXISTS(SELECT 1 FROM faz_pppoe_profile_router_backup b LEFT JOIN pppoe_profiles p ON p.id=b.profile_id WHERE b.migration_id='router-reconcile-v1' AND (p.id IS NULL OR p.name IS DISTINCT FROM b.profile_name OR p.router_id IS DISTINCT FROM canonical_id)) THEN RAISE EXCEPTION 'Snapshotted profile changed or disappeared'; END IF;
 IF EXISTS(SELECT 1 FROM pppoe_profiles p WHERE NOT EXISTS(SELECT 1 FROM faz_pppoe_profile_router_backup b WHERE b.migration_id='router-reconcile-v1' AND b.profile_id=p.id)) THEN RAISE EXCEPTION 'New PPPoE profiles exist; refusing rollback'; END IF;
END; $preflight$;
UPDATE customers c SET router_id=b.old_router_id,updated_at=NOW() FROM faz_customer_router_backup b WHERE b.migration_id='router-reconcile-v1' AND c.id=b.customer_id;
UPDATE pppoe_profiles p SET router_id=b.old_router_id,updated_at=NOW() FROM faz_pppoe_profile_router_backup b WHERE b.migration_id='router-reconcile-v1' AND p.id=b.profile_id;
DO $restore_constraints$ DECLARE n BIGINT; composite_name TEXT; BEGIN
 SELECT COUNT(*) INTO n FROM(SELECT name FROM pppoe_profiles GROUP BY name HAVING COUNT(*)>1)d;
 IF n>0 THEN RAISE EXCEPTION 'Duplicate profile names prevent restoring UNIQUE(name)'; END IF;
 SELECT c.conname INTO composite_name FROM pg_constraint c WHERE c.conrelid='pppoe_profiles'::regclass AND c.contype='u'
 AND (SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality) FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum)=ARRAY['router_id','name']::TEXT[] LIMIT 1;
 IF composite_name IS NOT NULL THEN EXECUTE format('ALTER TABLE pppoe_profiles DROP CONSTRAINT %I',composite_name); END IF;
 ALTER TABLE pppoe_profiles ALTER COLUMN router_id DROP NOT NULL;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='pppoe_profiles'::regclass AND c.contype='u'
 AND (SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality) FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum)=ARRAY['name']::TEXT[])
 THEN ALTER TABLE pppoe_profiles ADD CONSTRAINT pppoe_profiles_name_key UNIQUE(name); END IF;
END; $restore_constraints$;
DO $restore_routers$ DECLARE b RECORD; BEGIN
 FOR b IN SELECT * FROM faz_router_reconcile_backup WHERE migration_id='router-reconcile-v1' AND old_host='103.54.37.182'
 LOOP
  UPDATE router_devices SET is_active=b.old_is_active,status=b.old_status,updated_at=NOW() WHERE id::TEXT=b.router_id AND host='103.54.37.182' AND is_active=FALSE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stale router % no longer matches rollback guard',b.router_id; END IF;
 END LOOP;
END; $restore_routers$;
COMMIT;