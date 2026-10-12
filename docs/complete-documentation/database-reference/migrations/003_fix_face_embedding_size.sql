-- Fix face_embedding column size to support base64-encoded images
-- Changes from TEXT (64KB limit) to LONGTEXT (4GB limit)

ALTER TABLE users MODIFY face_embedding LONGTEXT NULL;
