-- Migration v7: Email verification codes (persistent storage for serverless)
CREATE TABLE IF NOT EXISTS email_verification_codes (
  user_id text PRIMARY KEY,
  code text NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_codes_expires ON email_verification_codes (expires_at);
