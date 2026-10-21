import { useState } from "react";
import { useGoalsStore } from "../store/useGoalsStore";
import Brand from "./Brand";
import { Btn, Field, Input } from "./ui";
import { IconEye, IconEyeOff } from "./Icons";
import { BRAND } from "../lib/brand";

/**
 * Sign up / log in. The two tabs, the Google button and the field list are
 * fixed by the product spec; everything is styled from the existing theme.
 */
export default function AuthScreen({ mode = "login", onModeChange, onForgot }) {
  const { register, login, error, startGuest } = useGoalsStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState({});
  const [googleNote, setGoogleNote] = useState(null);

  const isRegister = mode === "register";

  const switchMode = (next) => {
    setFieldError({});
    setGoogleNote(null);
    onModeChange?.(next);
  };

  const validate = () => {
    const errs = {};
    if (isRegister && !name.trim()) errs.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Enter a valid email address.";
    if (isRegister && phone.trim() && !/^[+()\d][\d\s().-]{5,}$/.test(phone.trim())) {
      errs.phone = "That does not look like a phone number.";
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password))
      errs.password = "Min. 8 characters, with a capital, a number and a symbol.";
    setFieldError(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setGoogleNote(null);
    if (!validate()) return;
    setBusy(true);
    try {
      if (isRegister) {
        await register({ email, password, name, phone });
      } else {
        await login({ email, password });
      }
      window.location.hash = "/app";
    } catch (err) {
      const msg = err?.message || "Request failed";
      // Put the failure under the field it belongs to.
      if (/password/i.test(msg) || /credentials/i.test(msg)) setFieldError({ password: msg });
      else if (/email/i.test(msg)) setFieldError({ email: msg });
      else setFieldError({ form: msg });
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
          {/* Wordmark, top-left. */}
          <Brand size="md" />

          <p className="text-sm text-muted mt-3 mb-5">Track your monthly goals. Execution is your score.</p>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: "var(--color-sunken)" }}>
            {[
              { id: "register", label: "Create account" },
              { id: "login", label: "Log in" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => switchMode(t.id)}
                aria-pressed={mode === t.id}
                className="flex-1 py-2 text-[13px] font-bold rounded-lg transition-colors cursor-pointer"
                style={
                  mode === t.id
                    ? { background: "var(--color-accent-muted)", color: "var(--color-accent)" }
                    : { background: "transparent", color: "var(--color-text-secondary)" }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={() =>
              setGoogleNote("Google sign-in is not available in this build yet — use your email and password.")
            }
            className="w-full h-10 rounded-lg text-sm font-bold flex items-center justify-center gap-2.5 cursor-pointer transition-colors"
            style={{ background: "transparent", border: "1px solid var(--color-border-active)", color: "var(--color-text-primary)" }}
          >
            <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5Z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.1 26.8 36 24 36c-5.2 0-9.6-3.1-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44Z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C39.6 36.4 44 30.7 44 24c0-1.2-.1-2.3-.4-3.5Z" />
            </svg>
            Continue with Google
          </button>
          {googleNote ? (
            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--color-warning)" }} role="status">
              {googleNote}
            </p>
          ) : null}

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: "var(--color-border-subtle)" }} />
            <span className="text-text-tertiary text-xs">or with your email</span>
            <div className="flex-1 h-px" style={{ background: "var(--color-border-subtle)" }} />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
            {isRegister ? (
              <>
                <Field label="Full name" id="pl-name" error={fieldError.name}>
                  <Input
                    id="pl-name"
                    value={name}
                    onChange={setName}
                    placeholder="e.g. Sara Bennani"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Phone number" id="pl-phone" error={fieldError.phone}>
                  <Input
                    id="pl-phone"
                    value={phone}
                    onChange={setPhone}
                    placeholder="+212 6 00 00 00 00"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </Field>
              </>
            ) : null}

            <Field label="Email" id="pl-email" error={fieldError.email}>
              <Input id="pl-email" type="email" value={email} onChange={setEmail} autoComplete="email" />
            </Field>

            <Field
              label="Password"
              id="pl-password"
              error={fieldError.password}
              hint={isRegister ? "8+ characters, with a capital, a number and a symbol." : undefined}
            >
              <div className="relative">
                <Input
                  id="pl-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder={isRegister ? "Min. 8 characters" : "Your password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
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

            {!isRegister ? (
              <button
                type="button"
                onClick={onForgot}
                className="self-start text-xs cursor-pointer hover:underline"
                style={{ color: "var(--color-accent)" }}
              >
                Forgot password?
              </button>
            ) : null}

            {fieldError.form || (error && !fieldError.email && !fieldError.password) ? (
              <p className="text-xs" style={{ color: "var(--color-danger)" }} role="alert">
                {fieldError.form || error}
              </p>
            ) : null}

            <Btn type="submit" size="lg" busy={busy} disabled={busy}>
              {isRegister ? "Create account" : "Log in"}
            </Btn>
          </form>

          <p className="text-[11px] text-text-tertiary mt-4 leading-relaxed">
            Only you see your goals. The leaderboard shows your first name, last initial and streak.
          </p>

          <button
            type="button"
            onClick={() => {
              startGuest();
              window.location.hash = "/app";
            }}
            className="mt-3 text-[11px] text-text-tertiary hover:text-muted underline-offset-4 hover:underline cursor-pointer transition-colors"
          >
            Continue without an account
          </button>
        </div>

        {/* Footer */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <p className="text-[11px] text-text-tertiary">
            {BRAND.name} · © {BRAND.year}
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1" aria-label="Legal">
            {["privacy", "terms", "refunds", "cookies"].map((id) => (
              <a
                key={id}
                href={`#/legal/${id}`}
                className="text-[11px] text-text-tertiary hover:text-heading transition-colors capitalize"
              >
                {id}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </main>
  );
}
