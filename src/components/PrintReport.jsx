import { createPortal } from "react-dom";
import {
  actionPct,
  resultPct,
  categoryPct,
  checkRewardUnlock,
} from "../lib/score";
import { dotColorToHex } from "../lib/categoryColors";
import { IconPrint, IconClose } from "./Icons";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Paper palette for the printed sheet (separate from the dark app theme).
const PAPER = {
  ink: "#101615",
  sub: "#4A5A56",
  line: "#D8E2DE",
  soft: "#F4F8F6",
  accent: "#0E7A6B",
};

function fmt(n) {
  return Number.isFinite(n) ? String(n) : "0";
}

function ActionLine({ item }) {
  const pct = Math.round(actionPct(item));
  const done = item.target > 0 && item.current >= item.target;
  const unit = item.actionType !== "count" ? item.unit : "";
  return (
    <div className="pl-row">
      <span
        className="pl-dot"
        style={{ background: done ? PAPER.accent : PAPER.line }}
        aria-hidden="true"
      />
      <span className="pl-label">{item.label}</span>
      <span className="pl-value">
        {fmt(item.current)}{unit} <span className="pl-sep">/</span> {fmt(item.target)}{unit}
      </span>
      <span className="pl-pct" style={{ color: done ? PAPER.accent : PAPER.ink }}>
        {done ? "✓ done" : `${pct}%`}
      </span>
    </div>
  );
}

function ResultLine({ item }) {
  const pct = Math.round(resultPct(item));
  const done = pct >= 100;
  return (
    <div className="pl-row">
      <span
        className="pl-dot"
        style={{ background: done ? "#C7792B" : PAPER.line }}
        aria-hidden="true"
      />
      <span className="pl-label">{item.label}</span>
      <span className="pl-value">
        {fmt(item.current)}{item.unit} <span className="pl-sep">/</span> {fmt(item.target)}{item.unit}
      </span>
      <span className="pl-pct" style={{ color: done ? "#C7792B" : PAPER.ink }}>
        {done ? "✓ done" : `${pct}%`}
      </span>
    </div>
  );
}

function RewardTrigger({ reward }) {
  const r = reward;
  if (r.thresholdType === "daily") return <span>All daily tasks done</span>;
  if (r.thresholdType === "weekly") return <span>All weekly tasks done</span>;
  if (r.thresholdType === "revenue") return <span>${fmt(r.cost)} revenue</span>;
  if (r.thresholdType === "action") return <span>Linked task done</span>;
  if (r.thresholdType === "result") return <span>Linked result done</span>;
  const threshold = r.threshold ?? r.cost;
  return <span>Score reaches {fmt(threshold)}%</span>;
}

function RewardLine({ reward, categories, qualityPercent }) {
  const unlocked = checkRewardUnlock(reward, { categories, stats: { qualityPercent } });
  const status = reward.claimed
    ? { text: "Claimed", color: PAPER.accent }
    : unlocked
    ? { text: "Unlocked", color: "#1E7A33" }
    : { text: "Locked", color: "#B04A31" };
  return (
    <div className="pl-row">
      <span className="pl-dot" style={{ background: status.color }} aria-hidden="true" />
      <span className="pl-label">
        {reward.name}
        <span className="pl-sub"> · {reward.period || "monthly"}</span>
      </span>
      <span className="pl-value">
        <RewardTrigger reward={reward} />
      </span>
      <span className="pl-pct" style={{ color: status.color }}>{status.text}</span>
    </div>
  );
}

export default function PrintReport({ cats, dashboard, logs, selectedMonth, user, isGuest, onClose }) {
  const [year, monthIdx] = String(selectedMonth || "").split("-").map(Number);
  const monthName = year && monthIdx ? MONTHS[monthIdx - 1] : MONTHS[new Date().getMonth()];
  const displayYear = year || new Date().getFullYear();
  const account = !isGuest && user?.name ? user.name : !isGuest && user?.email ? user.email : "Guest · this device";

  const qualityPercent = Math.round(dashboard?.stats?.qualityPercent ?? 0);
  const daysFraction = dashboard?.stats?.daysProgress ?? "0/0";
  const dayOfMonth = dashboard?.meta?.dayOfMonth ?? new Date().getDate();

  const monthLogs = (logs || [])
    .filter((l) => Number(l.year) === year && Number(l.month) === monthIdx)
    .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

  const nonRewards = (cats || []).filter((c) => !c.isRewards && c.name?.toLowerCase() !== "rewards");
  const rewardsCat = (cats || []).find((c) => c.isRewards || c.name?.toLowerCase() === "rewards");

  return createPortal(
    <div className="print-overlay">
      {/* On-screen toolbar only — hidden when printing */}
      <div className="print-toolbar no-print">
        <span className="print-toolbar-title">Print preview · {monthName} {displayYear}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => window.print()} className="print-btn-primary">
            <IconPrint size={14} /> Print
          </button>
          <button type="button" onClick={onClose} className="print-btn-ghost">
            <IconClose size={14} /> Close
          </button>
        </div>
      </div>

      {/* The sheet itself */}
      <div className="print-doc">
        <header className="pl-header">
          <div>
            <div className="pl-kicker">Tchizu Goal Tracker</div>
            <h1>{monthName} {displayYear}</h1>
            <div className="pl-account">{account}</div>
          </div>
          <div className="pl-score">
            <div className="pl-score-num">{qualityPercent}%</div>
            <div className="pl-score-cap">overall · day {daysFraction}</div>
          </div>
        </header>

        {nonRewards.length === 0 && (!rewardsCat || !rewardsCat.rewards?.length) ? (
          <div className="pl-empty">Nothing set up yet for {monthName} {displayYear}.</div>
        ) : null}

        {nonRewards.map((cat) => {
          const color = dotColorToHex(cat.dotColor);
          const actions = (cat.actions || []).filter((a) => !a._deleted);
          const results = (cat.results || []).filter((r) => !r._deleted);
          if (actions.length === 0 && results.length === 0) return null;
          return (
            <section key={cat.id} className="pl-section">
              <header className="pl-section-head">
                <span className="pl-section-dot" style={{ background: color }} aria-hidden="true" />
                <span className="pl-section-name">{cat.name}</span>
                <span className="pl-section-pct">{Math.round(categoryPct(cat))}%</span>
              </header>
              {actions.length > 0 && (
                <div className="pl-block">
                  <div className="pl-block-title">Actions · scored</div>
                  {actions.map((a) => <ActionLine key={a.id || a.label} item={a} />)}
                </div>
              )}
              {results.length > 0 && (
                <div className="pl-block">
                  <div className="pl-block-title">Results · tracked</div>
                  {results.map((r) => <ResultLine key={r.id || r.label} item={r} />)}
                </div>
              )}
            </section>
          );
        })}

        {rewardsCat && (rewardsCat.rewards || []).length > 0 && (
          <section className="pl-section">
            <header className="pl-section-head">
              <span className="pl-section-dot" style={{ background: "#C7792B" }} aria-hidden="true" />
              <span className="pl-section-name">Rewards</span>
            </header>
            <div className="pl-block">
              {(rewardsCat.rewards || []).map((r) => (
                <RewardLine
                  key={r.id}
                  reward={r}
                  categories={cats}
                  qualityPercent={qualityPercent}
                />
              ))}
            </div>
          </section>
        )}

        {monthLogs.length > 0 && (
          <section className="pl-section">
            <header className="pl-section-head">
              <span className="pl-section-dot" style={{ background: PAPER.accent }} aria-hidden="true" />
              <span className="pl-section-name">Daily history</span>
            </header>
            <div className="pl-grid">
              {monthLogs.map((l) => (
                <div key={l.dayOfMonth} className="pl-day">
                  <span className="pl-day-num">{l.dayOfMonth}</span>
                  <span className="pl-day-pct">{Math.round(l.qualityScore)}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="pl-footer">
          Printed {new Date().toLocaleDateString()} · day {dayOfMonth}
        </footer>
      </div>
    </div>,
    document.body
  );
}