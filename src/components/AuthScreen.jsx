import { useState } from "react";
import { useGoalsStore } from "../store/useGoalsStore";

export default function AuthScreen() {
  const { register, login, error, startGuest } = useGoalsStore();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(null);

  const startGuestLocal = () => {
    startGuest();
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      if (mode === "register") {
        await register({ email, password, name });
      } else {
        await login({ email, password });
      }
    } catch (err) {
      setLocalError(err.message || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const brand = (
    <div className="flex items-center gap-2.5 mb-4">
      <span
        className="grid place-items-center w-9 h-9 rounded-lg"
        style={{
          background: "var(--color-accent-muted)",
          color: "var(--color-accent)",
          boxShadow: "0 0 18px rgba(109,245,227,0.35)",
        }}
        aria-hidden="true"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
      <h1 className="display text-heading mb-0">Tchizu Goal Tracker</h1>
    </div>
  );

  return (
    <main className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
      <div className="card w-full max-w-[400px] p-6">
        {brand}

        <p className="caption text-text-tertiary mb-6">
          {mode === "register"
            ? "Create an account. Your goals are saved on this device only."
            : "Log in to see your stats. Data stays on this device."}
        </p>

        <div className="flex gap-2 mb-4">
          {["login", "register"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setLocalError(null); }}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                mode === m ? "text-accent" : "text-muted hover:text-heading"
              }`}
              style={mode === m ? { background: "var(--color-accent-muted)" } : { background: "transparent" }}
            >
              {m === "login" ? "Log in" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "register" && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-sunken text-heading text-sm rounded-lg px-3 py-2.5 outline-none"
              style={{ border: "1px solid var(--color-border-subtle)" }}
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-sunken text-heading text-sm rounded-lg px-3 py-2.5 outline-none"
            style={{ border: "1px solid var(--color-border-subtle)" }}
          />
          <input
            type="password"
            required
            placeholder={mode === "register" ? "Password (4+ characters)" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-sunken text-heading text-sm rounded-lg px-3 py-2.5 outline-none"
            style={{ border: "1px solid var(--color-border-subtle)" }}
          />

          {(localError || error) && (
            <p className="text-xs" style={{ color: "var(--color-danger)" }} role="alert">
              {localError || error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-lift w-full py-2.5 text-sm font-bold rounded-lg text-black"
            style={{ background: "var(--color-accent)" }}
          >
            {busy ? "Please wait..." : mode === "register" ? "Create account" : "Log in"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px" style={{ background: "var(--color-border-subtle)" }} />
          <span className="text-text-tertiary text-xs">or</span>
          <div className="flex-1 h-px" style={{ background: "var(--color-border-subtle)" }} />
        </div>

        <button
          onClick={startGuestLocal}
          className="btn-lift w-full py-2.5 text-sm font-semibold rounded-lg text-heading"
          style={{ background: "transparent", border: "1px solid var(--color-border-active)" }}
        >
          Continue as guest
        </button>
        <p className="text-text-tertiary text-[11px] text-center mt-3">
          Accounts and guest data are stored on this device only.
        </p>
      </div>
    </main>
  );
}
