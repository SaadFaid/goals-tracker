import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { Btn, Field, Input, Select } from "./ui";
import { useGoalsStore } from "../store/useGoalsStore";
import { toast } from "../lib/toast";
import { BRAND } from "../lib/brand";

/* ════════════════════════════════════════════════════════════
   The goal popups: add, edit, delete, log progress — plus the
   plan picker and the delete-account confirmation.
   ════════════════════════════════════════════════════════════ */

const TYPE_NOTE = {
  action: "What you do. Counts toward your Execution score.",
  result: "What you get. Tracked, not scored.",
};

function TypePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { id: "action", label: "Action" },
        { id: "result", label: "Result" },
      ].map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={on}
            className="text-left px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
            style={{
              background: on ? "var(--color-accent-muted)" : "var(--color-sunken)",
              border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
            }}
          >
            <span className="block text-sm font-bold" style={{ color: on ? "var(--color-accent)" : "var(--color-text-primary)" }}>
              {t.label}
            </span>
            <span className="block text-[11px] text-text-tertiary mt-0.5 leading-snug">{TYPE_NOTE[t.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Add a goal ────────────────────────────────────────────── */
export function AddGoalDialog({ categoryId, categoryName, initialType = "action", onClose }) {
  const addAction = useGoalsStore((s) => s.addAction);
  const addResult = useGoalsStore((s) => s.addResult);
  const [type, setType] = useState(initialType);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [oneTime, setOneTime] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const targetNum = Number(target);
  const valid = name.trim().length > 0 && Number.isFinite(targetNum) && targetNum > 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (type === "action") {
        addAction(categoryId, {
          label: name.trim(),
          target: targetNum,
          unit: unit.trim(),
          weight: 50,
          actionType: oneTime ? "check" : unit.trim() ? "amount" : "count",
        });
      } else {
        addResult(categoryId, {
          label: name.trim(),
          target: targetNum,
          unit: unit.trim(),
          weight: 50,
          resultType: oneTime ? "check" : "count",
        });
      }
      toast("Goal added");
      onClose();
    } catch (err) {
      setError(err?.message || "Could not add the goal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a goal"
      subtitle={categoryName ? `to ${categoryName}` : undefined}
      confirmClose={() => (name.trim() ? undefined : true)}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <div className="grow" />
          <Btn onClick={submit} disabled={!valid} busy={busy}>
            Add goal
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TypePicker value={type} onChange={setType} />

        <Field label="Goal name" id="pl-add-name" required>
          <Input id="pl-add-name" value={name} onChange={setName} placeholder="e.g. Workout sessions" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target" id="pl-add-target" required>
            <Input id="pl-add-target" type="number" min="0" value={target} onChange={setTarget} placeholder="16" />
          </Field>
          <Field label="Unit" id="pl-add-unit" hint="optional">
            <Input id="pl-add-unit" value={unit} onChange={setUnit} placeholder="km, DH, hours" />
          </Field>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={oneTime}
            onChange={(e) => setOneTime(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[var(--color-accent)]"
          />
          <span className="text-sm text-muted">One-time goal (just tick it when done)</span>
        </label>

        {error ? (
          <p className="text-xs" style={{ color: "var(--color-danger)" }} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/* ── Edit a goal ───────────────────────────────────────────── */
export function EditGoalDialog({ kind, categoryId, index, onClose }) {
  const categories = useGoalsStore((s) => s.categories);
  const updateAction = useGoalsStore((s) => s.updateAction);
  const updateResult = useGoalsStore((s) => s.updateResult);
  const moveGoal = useGoalsStore((s) => s.moveGoalToCategory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const category = categories.find((c) => c.id === categoryId);
  const item = category ? (kind === "action" ? category.actions?.[index] : category.results?.[index]) : null;

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!item) return;
    setForm({
      type: kind,
      name: item.label || "",
      target: String(item.target ?? ""),
      unit: item.unit || "",
      oneTime:
        kind === "action"
          ? item.actionType === "check"
          : (item.resultType || (item.invert ? "check" : "count")) === "check",
      categoryId,
    });
  }, [item, kind, categoryId]);

  const otherCategories = useMemo(
    () => categories.filter((c) => !c.isRewards && c.id !== categoryId),
    [categories, categoryId]
  );

  if (!form || !item) return null;

  const targetNum = Number(form.target);
  const valid = form.name.trim().length > 0 && Number.isFinite(targetNum) && targetNum > 0;
  const changed =
    form.name.trim() !== (item.label || "") ||
    targetNum !== item.target ||
    form.unit.trim() !== (item.unit || "") ||
    form.oneTime !== (kind === "action" ? item.actionType === "check" : (item.resultType || (item.invert ? "check" : "count")) === "check") ||
    form.categoryId !== categoryId;

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Update in place first — the index is still valid in the source
      // category — then move, so the row's progress survives the move.
      if (kind === "action") {
        updateAction(categoryId, index, "label", form.name.trim());
        updateAction(categoryId, index, "target", targetNum);
        updateAction(categoryId, index, "unit", form.unit.trim());
        updateAction(categoryId, index, "actionType", form.oneTime ? "check" : item.actionType === "check" ? "count" : item.actionType);
      } else {
        updateResult(categoryId, index, "label", form.name.trim());
        updateResult(categoryId, index, "target", targetNum);
        updateResult(categoryId, index, "unit", form.unit.trim());
        updateResult(categoryId, index, "resultType", form.oneTime ? "check" : item.resultType || "count");
      }
      if (form.categoryId !== categoryId) {
        moveGoal(kind, categoryId, index, form.categoryId);
      }
      toast("Goal updated");
      onClose();
    } catch (err) {
      setError(err?.message || "Could not save the goal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit goal"
      subtitle={category?.name}
      confirmClose={() => (changed ? undefined : true)}
      footer={
        <>
          <button
            type="button"
            onClick={() => onClose({ delete: true })}
            className="text-xs font-semibold cursor-pointer hover:underline"
            style={{ color: "var(--color-danger)" }}
          >
            Delete goal
          </button>
          <div className="grow" />
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn onClick={save} disabled={!valid || !changed} busy={busy}>
            Save changes
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TypePicker value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} />

        <Field label="Goal name" id="pl-edit-name" required>
          <Input id="pl-edit-name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target" id="pl-edit-target" required>
            <Input
              id="pl-edit-target"
              type="number"
              min="0"
              value={form.target}
              onChange={(v) => setForm((f) => ({ ...f, target: v }))}
            />
          </Field>
          <Field label="Unit" id="pl-edit-unit" hint="optional">
            <Input id="pl-edit-unit" value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} />
          </Field>
        </div>

        <Field label="Category" id="pl-edit-cat" hint="Move this goal to another category.">
          <Select id="pl-edit-cat" value={form.categoryId} onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
            <option value={categoryId}>{category?.name}</option>
            {otherCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.oneTime}
            onChange={(e) => setForm((f) => ({ ...f, oneTime: e.target.checked }))}
            className="mt-0.5 w-4 h-4 accent-[var(--color-accent)]"
          />
          <span className="text-sm text-muted">One-time goal (just tick it when done)</span>
        </label>

        {kind === "result" ? (
          <p className="text-[11px] text-text-tertiary">Results are tracked, not scored.</p>
        ) : null}

        {error ? (
          <p className="text-xs" style={{ color: "var(--color-danger)" }} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/* ── Delete a goal ─────────────────────────────────────────── */
export function DeleteGoalDialog({ kind, categoryId, index, name, onClose }) {
  const deleteAction = useGoalsStore((s) => s.deleteAction);
  const deleteResult = useGoalsStore((s) => s.deleteResult);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === "action") deleteAction(categoryId, index);
      else deleteResult(categoryId, index);
      toast("Goal deleted");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete this goal?"
      size="sm"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <div className="grow" />
          <Btn variant="danger" onClick={remove} busy={busy}>
            Delete
          </Btn>
        </>
      }
    >
      <p className="text-sm text-muted leading-relaxed">
        This removes “{name}” and all its progress. This can&rsquo;t be undone.
      </p>
    </Modal>
  );
}

/* ── Log progress ──────────────────────────────────────────── */
export function LogProgressDialog({ kind, categoryId, index, onClose }) {
  const categories = useGoalsStore((s) => s.categories);
  const updateAction = useGoalsStore((s) => s.updateAction);
  const updateResult = useGoalsStore((s) => s.updateResult);
  const [busy, setBusy] = useState(false);

  const category = categories.find((c) => c.id === categoryId);
  const item = category ? (kind === "action" ? category.actions?.[index] : category.results?.[index]) : null;
  const [value, setValue] = useState(null);

  useEffect(() => {
    if (item) setValue(String(item.current ?? 0));
  }, [item]);

  if (!item) return null;

  const isCheck = kind === "action" ? item.actionType === "check" : (item.resultType || (item.invert ? "check" : "count")) === "check";
  const num = Math.max(0, Number(value) || 0);

  const save = () => {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === "action") {
        updateAction(categoryId, index, "current", isCheck ? (num > 0 ? item.target : 0) : num);
      } else {
        updateResult(categoryId, index, "current", isCheck ? (num > 0 ? item.target : 0) : num);
      }
      toast("Progress saved");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item.label}
      size="sm"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <div className="grow" />
          <Btn onClick={save} busy={busy}>
            Save
          </Btn>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="stepper-btn"
            onClick={() => setValue(String(Math.max(0, num - 1)))}
            aria-label="Decrease"
          >
            −
          </button>
          <input
            type="number"
            min="0"
            value={value ?? "0"}
            onChange={(e) => setValue(e.target.value)}
            aria-label={`${item.label} value`}
            className="w-24 text-center bg-sunken text-heading rounded-lg py-2 outline-none stat-num"
            style={{ border: "1px solid var(--color-border-subtle)", fontSize: 22 }}
          />
          <button type="button" className="stepper-btn" onClick={() => setValue(String(num + 1))} aria-label="Increase">
            +
          </button>
        </div>
        <p className="text-sm text-text-tertiary">
          of {item.target}
          {item.unit ? ` ${item.unit}` : ""}
        </p>
      </div>
    </Modal>
  );
}

/* ── Delete the account ────────────────────────────────────── */
export function DeleteAccountDialog({ onClose }) {
  const deleteAccount = useGoalsStore((s) => s.deleteAccount);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const confirmed = typed.trim().toUpperCase() === "DELETE";

  const remove = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      toast("Account deleted");
      onClose();
    } catch (err) {
      setError(err?.message || "Could not delete the account.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete your account?"
      size="sm"
      confirmClose={() => (typed ? undefined : true)}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <div className="grow" />
          <Btn variant="danger" onClick={remove} disabled={!confirmed} busy={busy}>
            Delete my account
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted leading-relaxed">
          This permanently deletes your goals, progress and streak. This can&rsquo;t be undone.
        </p>
        <Field label="Type DELETE to confirm" id="pl-delete-confirm">
          <Input
            id="pl-delete-confirm"
            value={typed}
            onChange={setTyped}
            placeholder="DELETE"
            autoComplete="off"
          />
        </Field>
        {error ? (
          <p className="text-xs" style={{ color: "var(--color-danger)" }} role="alert">
            {error}
          </p>
        ) : null}
        <p className="text-[11px] text-text-tertiary">
          Your data is on {BRAND.name}&rsquo;s server. Deleting the account removes it for good.
        </p>
      </div>
    </Modal>
  );
}

/* ── The one host that renders whichever dialog is open ────── */
export function DialogHost() {
  const dialog = useGoalsStore((s) => s.dialog);
  const closeDialog = useGoalsStore((s) => s.closeDialog);
  const openDialog = useGoalsStore((s) => s.openDialog);

  if (!dialog) return null;

  const close = () => closeDialog();

  if (dialog.type === "add-goal") {
    return (
      <AddGoalDialog
        categoryId={dialog.categoryId}
        categoryName={dialog.categoryName}
        initialType={dialog.kind === "result" ? "result" : "action"}
        onClose={close}
      />
    );
  }
  if (dialog.type === "edit-goal") {
    return (
      <EditGoalDialog
        kind={dialog.kind}
        categoryId={dialog.categoryId}
        index={dialog.index}
        onClose={(payload) => {
          if (payload?.delete) {
            const categories = useGoalsStore.getState().categories;
            const cat = categories.find((c) => c.id === dialog.categoryId);
            const item = cat ? (dialog.kind === "action" ? cat.actions?.[dialog.index] : cat.results?.[dialog.index]) : null;
            openDialog({
              type: "delete-goal",
              kind: dialog.kind,
              categoryId: dialog.categoryId,
              index: dialog.index,
              name: item?.label || "this goal",
            });
            return;
          }
          close();
        }}
      />
    );
  }
  if (dialog.type === "delete-goal") {
    return (
      <DeleteGoalDialog
        kind={dialog.kind}
        categoryId={dialog.categoryId}
        index={dialog.index}
        name={dialog.name}
        onClose={close}
      />
    );
  }
  if (dialog.type === "log-progress") {
    return (
      <LogProgressDialog kind={dialog.kind} categoryId={dialog.categoryId} index={dialog.index} onClose={close} />
    );
  }
  if (dialog.type === "delete-account") {
    return <DeleteAccountDialog onClose={close} />;
  }
  return null;
}
