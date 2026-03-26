-- =====================================================
-- DATABASE CLEANUP SCRIPT (POSTGRESQL)
-- Removes all data from every table in the public schema
-- while preserving table structures and constraints.
-- =====================================================

BEGIN;

DO $$
DECLARE
    truncate_sql TEXT;
BEGIN
    SELECT
        'TRUNCATE TABLE ' ||
        string_agg(format('%I.%I', schemaname, tablename), ', ') ||
        ' RESTART IDENTITY CASCADE;'
    INTO truncate_sql
    FROM pg_tables
    WHERE schemaname = 'public';

    IF truncate_sql IS NOT NULL THEN
        EXECUTE truncate_sql;
    END IF;
END $$;

COMMIT;
