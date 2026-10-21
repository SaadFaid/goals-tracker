import { createHttpError, cleanText, isIsoDate } from "../validation/validate.js";

const MAX_TEXT = 1000;
const isInt = (v) => Number.isInteger(v) && v >= 0 && v <= 100000;

/**
 * Turn the client's `days.map` into the rows the NoteDay table stores.
 *
 * The note's client id goes in `noteId`; the row's own `id` is left unset so
 * the schema default (a uuid) applies.
 *
 * Reusing the note id as the primary key made one note id usable on ONE date
 * only. Filing the same task on a second date then raised a unique-constraint
 * failure that rolled back the whole transaction — every day in the map was
 * lost, not just the offending one — and the client swallowed the 500. The day
 * history silently stopped saving and the days a user had worked on vanished
 * on the next load.
 */
export function buildDayRows(rawMap, userId) {
  const rows = [];
  for (const [date, list] of Object.entries(rawMap || {})) {
    if (!isIsoDate(date)) throw createHttpError(400, `Invalid notes day ${date}`);
    if (!Array.isArray(list)) throw createHttpError(400, `Notes day ${date} must be an array`);
    if (list.length > 200) throw createHttpError(400, `Too many notes on ${date}`);
    const seen = new Set();
    list.forEach((raw, i) => {
      const noteId = typeof raw?.id === "string" && raw.id ? raw.id : null;
      if (!noteId) throw createHttpError(400, "Note needs an id");
      const text = cleanText(raw.text, MAX_TEXT);
      // Empty text means the client is clearing a list or dropping a row while
      // a full-list batch is in flight. Skipping it (not 400ing the whole
      // request) keeps one stale/empty row from wedging every save.
      if (!text) return;
      if (seen.has(noteId)) throw createHttpError(400, `Duplicate note id ${noteId} on ${date}`);
      seen.add(noteId);
      rows.push({
        userId,
        date,
        noteId,
        text,
        done: !!raw.done,
        sortOrder: raw?.sortOrder == null ? i : isInt(raw.sortOrder) ? raw.sortOrder : i,
      });
    });
  }
  return rows;
}
