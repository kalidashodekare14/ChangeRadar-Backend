-- Bootstrap role creation (runs as a cluster superuser).
-- Passwords are injected by scripts/db/create-roles.ts from the environment;
-- the __MIGRATOR_PASSWORD__ / __APP_PASSWORD__ tokens are replaced there.
-- For manual psql use, substitute them with `psql -v` or edit locally (never commit).

-- PostgreSQL 15+ restricts CREATE on the public schema to the database owner.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'changeradar_migrator') THEN
    CREATE ROLE changeradar_migrator LOGIN NOSUPERUSER NOCREATEDB NOBYPASSRLS
      PASSWORD __MIGRATOR_PASSWORD__;
  ELSE
    ALTER ROLE changeradar_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOBYPASSRLS
      PASSWORD __MIGRATOR_PASSWORD__;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'changeradar_app') THEN
    CREATE ROLE changeradar_app LOGIN NOSUPERUSER NOCREATEDB NOBYPASSRLS
      PASSWORD __APP_PASSWORD__;
  ELSE
    ALTER ROLE changeradar_app WITH LOGIN NOSUPERUSER NOCREATEDB NOBYPASSRLS
      PASSWORD __APP_PASSWORD__;
  END IF;
END
$$;

-- PostgreSQL 15+ restricts CREATE on the public schema to the database owner.
GRANT CONNECT, CREATE ON DATABASE changeradar TO changeradar_migrator;
GRANT USAGE, CREATE ON SCHEMA public TO changeradar_migrator;

