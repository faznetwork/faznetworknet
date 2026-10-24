-- Allow invitation recipients to choose their username during acceptance.
-- Existing invitation usernames and account records are preserved.
BEGIN;
ALTER TABLE admin_invitations ALTER COLUMN username DROP NOT NULL;
COMMIT;
