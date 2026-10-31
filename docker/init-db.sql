-- Create separate test database
SELECT 'CREATE DATABASE subscriptiq_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'subscriptiq_test')\gexec
