-- Transaction-local tenant context helpers (ARCHITECTURE §8.2).
-- All three functions return NULL when the setting is absent or empty:
-- `workspace_id = NULL` is never true, so missing context fails closed.

CREATE OR REPLACE FUNCTION app_current_workspace_id() RETURNS uuid
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.current_workspace_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_invitation_token_hash() RETURNS text
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.invitation_token_hash', true), '') $$;
