-- Local-clone-only migration. Not executed by application startup.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
LOCK TABLE router_devices IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE customers IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE pppoe_profiles IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$ DECLARE n INTEGER; p BIGINT; BEGIN
 SELECT COUNT(*) INTO n FROM router_devices WHERE host='10.10.10.1' AND api_port=8728 AND api_type='native_api' AND is_active=TRUE;
 IF n<>1 THEN RAISE EXCEPTION 'Expected exactly one active canonical router 10.10.10.1:8728; found %',n; END IF;
 SELECT COUNT(*) INTO p FROM pppoe_profiles; IF p=0 THEN RAISE EXCEPTION 'pppoe_profiles is empty'; END IF;
 IF EXISTS(SELECT 1 FROM pppoe_profiles GROUP BY name HAVING COUNT(*)>1) THEN RAISE EXCEPTION 'Duplicate profile names exist'; END IF;
 IF EXISTS(SELECT 1 FROM customers c WHERE c.router_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM router_devices r WHERE r.id::TEXT=c.router_id)) THEN RAISE EXCEPTION 'Orphan customers.router_id values exist'; END IF;
END; $preflight$;
CREATE TABLE IF NOT EXISTS faz_router_reconcile_backup(migration_id TEXT NOT NULL,router_id TEXT NOT NULL,old_router_name TEXT,old_host TEXT NOT NULL,old_api_type TEXT NOT NULL,old_api_port INTEGER NOT NULL,old_is_active BOOLEAN NOT NULL,old_status TEXT,snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(migration_id,router_id));
CREATE TABLE IF NOT EXISTS faz_customer_router_backup(migration_id TEXT NOT NULL,customer_id BIGINT NOT NULL,old_router_id TEXT,snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(migration_id,customer_id));
CREATE TABLE IF NOT EXISTS faz_pppoe_profile_router_backup(migration_id TEXT NOT NULL,profile_id BIGINT NOT NULL,profile_name TEXT NOT NULL,old_router_id TEXT,snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(migration_id,profile_id));
DO $snapshot_guard$ BEGIN
 IF EXISTS(SELECT 1 FROM faz_router_reconcile_backup WHERE migration_id='router-reconcile-v1') OR EXISTS(SELECT 1 FROM faz_customer_router_backup WHERE migration_id='router-reconcile-v1') OR EXISTS(SELECT 1 FROM faz_pppoe_profile_router_backup WHERE migration_id='router-reconcile-v1') THEN RAISE EXCEPTION 'Snapshot router-reconcile-v1 already exists'; END IF;
END; $snapshot_guard$;
INSERT INTO faz_router_reconcile_backup(migration_id,router_id,old_router_name,old_host,old_api_type,old_api_port,old_is_active,old_status)
SELECT 'router-reconcile-v1',id::TEXT,router_name,host,api_type,api_port,is_active,status FROM router_devices WHERE host IN('103.54.37.182','10.10.10.1') AND api_type='native_api';
INSERT INTO faz_customer_router_backup(migration_id,customer_id,old_router_id)
SELECT 'router-reconcile-v1',c.id,c.router_id FROM customers c WHERE c.router_id IS NULL OR EXISTS(SELECT 1 FROM router_devices r WHERE r.id::TEXT=c.router_id AND r.host='103.54.37.182' AND r.api_type='native_api');
INSERT INTO faz_pppoe_profile_router_backup(migration_id,profile_id,profile_name,old_router_id) SELECT 'router-reconcile-v1',id,name,router_id FROM pppoe_profiles;
UPDATE customers c SET router_id=(SELECT id::TEXT FROM router_devices WHERE host='10.10.10.1' AND api_port=8728 AND api_type='native_api' AND is_active=TRUE),updated_at=NOW()
WHERE c.router_id IS NULL OR EXISTS(SELECT 1 FROM router_devices r WHERE r.id::TEXT=c.router_id AND r.host='103.54.37.182' AND r.api_type='native_api');
UPDATE router_devices SET is_active=FALSE,status='offline',updated_at=NOW() WHERE host='103.54.37.182' AND api_type='native_api';
UPDATE pppoe_profiles SET router_id=(SELECT id::TEXT FROM router_devices WHERE host='10.10.10.1' AND api_port=8728 AND api_type='native_api' AND is_active=TRUE),updated_at=NOW();
DO $profile_check$ BEGIN
 IF EXISTS(SELECT 1 FROM pppoe_profiles WHERE router_id IS NULL) THEN RAISE EXCEPTION 'Profiles still have NULL router_id'; END IF;
 IF EXISTS(SELECT 1 FROM pppoe_profiles GROUP BY router_id,name HAVING COUNT(*)>1) THEN RAISE EXCEPTION 'Duplicate (router_id,name) profile pairs'; END IF;
END; $profile_check$;
DO $drop_unique_name$ DECLARE r RECORD; BEGIN
 FOR r IN SELECT c.conname FROM pg_constraint c WHERE c.conrelid='pppoe_profiles'::regclass AND c.contype='u'
 AND (SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality) FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum)=ARRAY['name']::TEXT[]
 LOOP EXECUTE format('ALTER TABLE pppoe_profiles DROP CONSTRAINT %I',r.conname); END LOOP;
END; $drop_unique_name$;
ALTER TABLE pppoe_profiles ALTER COLUMN router_id SET NOT NULL;
DO $add_composite$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='pppoe_profiles'::regclass AND c.contype='u'
 AND (SELECT array_agg(a.attname::TEXT ORDER BY k.ordinality) FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum)=ARRAY['router_id','name']::TEXT[])
 THEN ALTER TABLE pppoe_profiles ADD CONSTRAINT pppoe_profiles_router_id_name_key UNIQUE(router_id,name); END IF;
END; $add_composite$;
DO $final_check$ BEGIN
 IF EXISTS(SELECT 1 FROM customers c WHERE c.router_id IS NULL OR NOT EXISTS(SELECT 1 FROM router_devices r WHERE r.id::TEXT=c.router_id)) THEN RAISE EXCEPTION 'Customer router references failed final check'; END IF;
END; $final_check$;
COMMIT;