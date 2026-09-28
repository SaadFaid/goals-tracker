import { useState } from "react";
import { api, setAccessToken } from "../lib/api";

export default function ChangePassword({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("The two new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { accessToken } = await api.changePassword(currentPassword, newPassword);
      // The server drops every refresh token on a password change and hands
      // back a fresh access token, so keep this session alive rather than
      // dropping the user back on the login screen.
      if (accessToken) setAccessToken(accessToken);
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Could not change the password.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">Change password</h2>

        {done ? (
          <>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Password updated. Any other device is signed out.
            </p>
            <button onClick={onClose} className="nav-btn nav-btn-primary py-2" style={{ background: "var(--color-accent)", color: "#101010" }}>
              Close
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              Current password
              <input
                type="password"
                className={field}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              New password
              <input
                type="password"
                className={field}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <span className="font-normal" style={{ color: "var(--color-text-tertiary)" }}>
                8+ characters, with an uppercase letter, a number and a symbol.
              </span>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              Confirm new password
              <input
                type="password"
                className={field}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            {error && (
              <p className="text-xs" style={{ color: "var(--color-danger, #e5484d)" }}>
                {error}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="nav-btn py-2" disabled={busy}>
                Cancel
              </button>
              <button
                type="submit"
                className="nav-btn nav-btn-primary py-2"
                style={{ background: "var(--color-accent)", color: "#101010" }}
                disabled={busy}
              >
                {busy ? "Updating..." : "Update password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
