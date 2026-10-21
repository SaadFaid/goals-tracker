import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDayRows } from "../src/lib/notesDays.js";

const U = "user-1";
const N = (id, text, extra = {}) => ({ id, text, ...extra });

test("a day row carries the note id in noteId, not in the row's own id", () => {
  const rows = buildDayRows({ "2026-10-20": [N("note-a", "gym")] }, U);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].noteId, "note-a");
  // The row's own primary key must stay unset so the schema default (a uuid)
  // applies. Putting the note id there made one note id usable on one date
  // only, and filing it on a second date blew up the whole day map.
  assert.equal("id" in rows[0], false);
});

test("the same note id can be filed on two different dates", () => {
  const rows = buildDayRows(
    {
      "2026-10-20": [N("note-a", "gym")],
      "2026-10-21": [N("note-a", "gym")],
    },
    U,
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.date), ["2026-10-20", "2026-10-21"]);
  assert.deepEqual(rows.map((r) => r.noteId), ["note-a", "note-a"]);
});

test("the same note id twice on ONE date is a duplicate", () => {
  assert.throws(
    () => buildDayRows({ "2026-10-20": [N("note-a", "gym"), N("note-a", "gym again")] }, U),
    /Duplicate note id/,
  );
});

test("an empty row is dropped instead of wedging the batch", () => {
  const rows = buildDayRows({ "2026-10-20": [N("note-a", "gym"), N("note-b", "   ")] }, U);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].noteId, "note-a");
});

test("sortOrder comes from the array position and survives an explicit one", () => {
  const rows = buildDayRows(
    { "2026-10-20": [N("a", "one"), N("b", "two"), N("c", "three", { sortOrder: 7 })] },
    U,
  );
  assert.deepEqual(rows.map((r) => r.sortOrder), [0, 1, 7]);
});

test("a malformed date is rejected", () => {
  assert.throws(() => buildDayRows({ "20-10-2026": [] }, U), /Invalid notes day/);
  assert.throws(() => buildDayRows({ "2026-02-30": [] }, U), /Invalid notes day/);
});
