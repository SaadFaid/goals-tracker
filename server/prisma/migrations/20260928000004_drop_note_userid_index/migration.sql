-- Migration 3 moved Note to a composite primary key (userId, id), which already
-- creates an index leading with userId. The old standalone Note_userId_idx is
-- therefore redundant, and schema.prisma does not declare it — leaving it in
-- place made `prisma migrate diff` report permanent drift.
--
-- Note the index is `_idx`, not `_index`: Prisma's default naming for a
-- single-column `@@index([userId])` is <table>_userId_idx.
DROP INDEX IF EXISTS "Note_userId_idx";
