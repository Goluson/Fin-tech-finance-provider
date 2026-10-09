-- Run once against an existing database before deploying the AWS version.
-- Existing user rows keep their roles and financing history; cognito_sub is
-- linked on the user's first sign-in using their verified Cognito email.
ALTER TABLE users ADD COLUMN IF NOT EXISTS cognito_sub VARCHAR(128);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cognito_sub ON users(cognito_sub);
ALTER TABLE users DROP COLUMN IF EXISTS firebase_uid;

-- Keep the same object keys when copying the GCS bucket to S3. After the copy,
-- the column rename lets existing PO records point to those same keys.
ALTER TABLE purchase_orders RENAME COLUMN document_gcs_path TO document_s3_key;
