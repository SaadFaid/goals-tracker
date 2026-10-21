import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Brand from "./Brand";
import { Btn, Field, Input } from "./ui";
import { IconEye, IconEyeOff } from "./Icons";

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

/**
 * The password reset flow.
 *
 * "Forgot" never says whether the address has an account — the same message
 * comes back either way. The link in the email is single-use and expires in
 * an hour (the server owns both of those rules).
 */
export default function ResetPassword({ mode = "forgot", token: initialToken = "", onBack, onDone }) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState({});
  const [devLink, setDevLink] = useState(null);
  const [googleUser, setGoogleUser] = useState(false);

  useEffect(() => {
    setToken(initialToken);
  }, [initialToken]);

  const sendLink = async (e) => {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    setFieldError({});
    if (!emailOk(email)) {
      setFieldError({ email: "Enter a valid email address." });
      return;
    }
    setBusy(true);
    try {
      const res = await api.forgotPassword(email.trim());
      setSent(true);
      // Only returned when the server has no mail transport configured yet.
      if (res?.resetToken) {
        const base = `${window.location.origin}${window.location.pathname}`;
        setDevLink(`${base}#/reset?token=${encodeURIComponent(res.resetToken)}`);
      }
    } catch (err) {
      setError(err?.message || "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    const errs = {};
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password))
      errs.password = "Min. 8 characters, with a capital, a number and a symbol.";
    if (password !== confirm) errs.confirm = "The two passwords do not match.";
    setFieldError(errs);
    if (Object.keys(errs).length) return;
    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      onDone?.();
    } catch (err) {
      const msg = err?.message || "Could not save the new password.";
      setError(msg);
      if (/expired|invalid|used/i.test(msg)) setGoogleUser(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "var(--color-base)" }}>
      <div aria-hidden className="bg-anim">
        <div className="bg-orb orb-mint" />
        <div className="bg-orb orb-periwinkle" />
      </div>

      <div className="relative w-full max-w-[420px]">
        <div className="card p-6">
          <Brand size="md" />

          {mode === "forgot" ? (
            <>
              <h1 className="h2 text-heading mt-4" style={{ fontSize: 18 }}>
                Reset your password
              </h1>
              <p className="text-sm text-muted mt-1.5 mb-5">
                Enter the address you signed up with and we will send you a link.
              </p>

              {sent ? (
                <div
                  className="rounded-xl p-4 text-sm leading-relaxed"
                  style={{ background: "var(--color-accent-muted)", border: "1px solid rgba(109,245,227,0.25)", color: "var(--color-accent)" }}
                  role="status"
                >
                  If this email has an account, we sent a reset link. It expires in one hour.
                  {devLink ? (
                    <a
                      href={devLink}
                      className="block mt-2 text-xs underline underline-offset-4"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      No mail server configured — open the reset link
                    </a>
                  ) : null}
                </div>
              ) : (
                <form onSubmit={sendLink} className="flex flex-col gap-3" noValidate>
                  <Field label="Email" id="pl-forgot-email" error={fieldError.email}>
                    <Input
                      id="pl-forgot-email"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
                  </Field>
                  {error ? (
                    <p className="text-xs" style={{ color: "var(--color-danger)" }} role="alert">
                      {error}
                    </p>
                  ) : null}
                  <Btn type="submit" size="lg" busy={busy} disabled={busy}>
                    Send reset link
                  </Btn>
                </form>
              )}

              <button
                type="button"
                onClick={onBack}
                className="mt-5 text-xs cursor-pointer hover:underline"
                style={{ color: "var(--color-accent)" }}
              >
                Back to log in
              </button>
            </>
          ) : (
            <>
              <h1 className="h2 text-heading mt-4" style={{ fontSize: 18 }}>
                Set a new password
              </h1>
              <p className="text-sm text-muted mt-1.5 mb-5">
                {googleUser
                  ? "This account signs in with Google, so you do not need a password."
                  : "Choose something you have not used here before."}
              </p>

              {googleUser ? (
                <Btn size="lg" onClick={onBack}>
                  Back to log in
                </Btn>
              ) : (
                <form onSubmit={savePassword} className="flex flex-col gap-3" noValidate>
                  <Field label="New password" id="pl-new-pw" error={fieldError.password} hint="8+ characters, with a capital, a number and a symbol.">
                    <div className="relative">
                      <Input
                        id="pl-new-pw"
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={setPassword}
                        autoComplete="new-password"
                        placeholder="Min. 8 characters"
                        className="pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? "Hide password" : "Show password"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-md cursor-pointer"
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        {showPw ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                      </button>
                    </div>
                  </Field>

                  <Field label="Confirm new password" id="pl-confirm-pw" error={fieldError.confirm}>
                    <Input
                      id="pl-confirm-pw"
                      type={showPw ? "text" : "password"}
                      value={confirm}
                      onChange={setConfirm}
                      autoComplete="new-password"
                      placeholder="Type it again"
                    />
                  </Field>

                  {error ? (
                    <p className="text-xs" style={{ color: "var(--color-danger)" }} role="alert">
                      {error}
                    </p>
                  ) : null}

                  <Btn type="submit" size="lg" busy={busy} disabled={busy}>
                    Save password
                  </Btn>
                </form>
              )}

              <button
                type="button"
                onClick={onBack}
                className="mt-5 text-xs cursor-pointer hover:underline"
                style={{ color: "var(--color-accent)" }}
              >
                Back to log in
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
