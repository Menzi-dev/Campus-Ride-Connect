-- Database migration: fix face embedding size. Apply these schema/data changes to the intended
-- database after checking its current structure.
-- Fix face_embedding column size to support base64-encoded images
-- Changes from TEXT (64KB limit) to LONGTEXT (4GB limit)
-- Where: SQL statements in database/mysql/migrations/003_fix_face_embedding_size.sql, involving
-- users.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.

ALTER TABLE users MODIFY face_embedding LONGTEXT NULL;
