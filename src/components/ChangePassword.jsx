import { useState } from "react";
import { api, setAccessToken } from "../lib/api";
import { setStoredRefreshToken } from "../lib/storageScope";
import { Btn, Field, Input } from "./ui";
import { IconEye, IconEyeOff } from "./Icons";
import { toast } from "../lib/toast";

const strong = (value) =>
  value.length >= 8 &&
  /[A-Z]/.test(value) &&
  /[0-9]/.test(value) &&
  /[^A-Za-z0-9]/.test(value);

/**
 * Change password, inline inside Settings. The server drops every other refresh
 * token on success and hands back this session's replacement, so the current
 * device stays signed in.
 */
export default function ChangePassword({ onDone }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!strong(newPassword)) {
      setError("Min. 8 characters, with a capital, a number and a symbol.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { accessToken, refreshToken } = await api.changePassword(currentPassword, newPassword);
      if (accessToken) setAccessToken(accessToken);
      setStoredRefreshToken(refreshToken);
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Password updated");
      onDone?.();
    } catch (err) {
      setError(err.message || "Could not change the password.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="text-sm" style={{ color: "var(--color-accent)" }}>
        Password updated. Any other device is signed out.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 max-w-[380px]">
      <Field label="Current password" id="pl-cur-pw">
        <Input
          id="pl-cur-pw"
          type={show ? "text" : "password"}
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
      </Field>

      <Field
        label="New password"
        id="pl-new-pass"
        hint="8+ characters, with a capital, a number and a symbol."
      >
        <div className="relative">
          <Input
            id="pl-new-pass"
            type={show ? "text" : "password"}
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-md cursor-pointer"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {show ? <IconEyeOff size={15} /> : <IconEye size={15} />}
          </button>
        </div>
      </Field>

      <Field label="Confirm new password" id="pl-confirm-pass">
        <Input
          id="pl-confirm-pass"
          type={show ? "text" : "password"}
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />
      </Field>

      {error ? (
        <p className="text-xs" style={{ color: "var(--color-danger)" }} role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <Btn type="submit" busy={busy} disabled={busy}>
          Update password
        </Btn>
      </div>
    </form>
  );
}
