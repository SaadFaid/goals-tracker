// A tiny toast bus. Components push a message, one <Toaster /> renders them.
// Kept outside React so a non-component (an API callback) can fire one too.

const listeners = new Set();
let current = null;
let timer = null;
let seq = 0;

function emit() {
  for (const fn of listeners) fn(current);
}

export function toast(message, tone = "ok") {
  seq += 1;
  current = { id: seq, message: String(message || ""), tone };
  emit();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    emit();
  }, 2600);
}

export function dismissToast() {
  if (timer) clearTimeout(timer);
  current = null;
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  if (current) fn(current);
  return () => listeners.delete(fn);
}

export function useToast() {
  // useSyncExternalStore keeps this correct under React 19's concurrent render.
  return { toast, dismiss: dismissToast };
}
