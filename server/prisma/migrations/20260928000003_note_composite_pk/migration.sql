-- Note.id was a bare primary key, so note ids were only unique across the whole
-- table. Two accounts could therefore never both hold a note with the same
-- client-generated id, and a matching id let one account's upsert land on
-- another account's row. Key on (userId, id) so the row is structurally owned.

ALTER TABLE "Note" DROP CONSTRAINT "Note_pkey";
ALTER TABLE "Note" ADD CONSTRAINT "Note_pkey" PRIMARY KEY ("userId", "id");
