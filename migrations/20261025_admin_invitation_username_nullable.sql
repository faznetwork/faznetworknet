-- Backward-compatible correction for installations created with username NOT NULL.
-- Usernames are assigned only when an invitation is accepted; existing invitation rows are preserved.
BEGIN;

DO $admin_invitation_username_nullable$
BEGIN
  IF to_regclass('admin_invitations') IS NULL THEN
    RAISE EXCEPTION 'Required table admin_invitations does not exist; refusing to skip invitation schema correction';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'admin_invitations'
      AND column_name = 'username'
  ) THEN
    ALTER TABLE admin_invitations ALTER COLUMN username DROP NOT NULL;
  ELSE
    RAISE EXCEPTION 'Required column admin_invitations.username does not exist';
  END IF;
END;
$admin_invitation_username_nullable$;

COMMIT;
