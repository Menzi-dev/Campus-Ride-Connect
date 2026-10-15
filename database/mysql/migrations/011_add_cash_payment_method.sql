-- Database migration: add cash payment method. Apply these schema/data changes to the intended
-- database after checking its current structure.
-- Where: SQL statements in database/mysql/migrations/011_add_cash_payment_method.sql, involving
-- payments.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.
ALTER TABLE payments
    MODIFY COLUMN method ENUM('CAMPUS_WALLET', 'CARD', 'MOBILE_MONEY', 'CASH') NOT NULL;