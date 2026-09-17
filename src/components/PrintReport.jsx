import { createPortal } from "react-dom";
import {
  actionPct,
  resultPct,
  categoryPct,
  checkRewardUnlock,
  computeOverallPct,
  aggregateResultsPct,
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

const RING_EXEC = "#DB6088";
const RING_MONEY = "#C9A227";
const RING_RESULTS = "#D97A26";
const RING_DAYS = "#8FA8A3";
const RING_TRACK = "#E2EBE7";
const RING_MARK = "#8FA8A3";

const monthDays = (key) => {
  const [y, m] = String(key || "").split("-").map(Number);
  return y && m ? new Date(y, m, 0).getDate() : 30;
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

// Stat ring — same arc + start dot + expected marker as the dashboard StatsBar,
// rendered in a paper palette for the printed sheet.
function PaperRing({ label, center, sub, pct, color, textColor, expectedPct }) {
  const size = 96;
  const stroke = 7;
  const r = (size - stroke) / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const expAngle = (Math.max(0, Math.min(100, expectedPct)) / 100) * 2 * Math.PI - Math.PI / 2;
  const ex = cx + r * Math.cos(expAngle);
  const ey = cy + r * Math.sin(expAngle);
  return (
    <div className="pl-ring">
      <div className="pl-ring-svg">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={RING_TRACK} strokeWidth={stroke} />
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - clamped / 100)}
            />
          </g>
          <circle cx={cx} cy={cy - r} r="2.6" fill={color} />
          <circle cx={ex} cy={ey} r="2.3" fill={RING_MARK} />
        </svg>
        <span className="pl-ring-num" style={{ color: textColor }}>{center}</span>
      </div>
      <div className="pl-ring-label">{label}</div>
      <div className="pl-ring-sub">{sub}</div>
    </div>
  );
}

function LegendSwatch({ color, label, dashed }) {
  return (
    <span className="pl-legend-item">
      <span
        className="pl-legend-line"
        style={{
          borderTopColor: color,
          borderTopStyle: dashed ? "dashed" : "solid",
        }}
      />
      {label}
    </span>
  );
}

// Progress chart — the same upwards lines as the dashboard ProgressChart
// (expected dashed pace, execution pink, results orange), static for print.
function PaperChart({ logs, dashboard, selectedMonth }) {
  const w = 480;
  const h = 140;
  const pad = { top: 12, right: 14, bottom: 24, left: 32 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const totalDays = monthDays(selectedMonth);
  const metaDate = dashboard?.meta?.currentDate ? new Date(dashboard.meta.currentDate) : new Date();
  const viewYear = Number(String(selectedMonth || "").split("-")[0]) || metaDate.getFullYear();
  const viewMonth = Number(String(selectedMonth || "").split("-")[1]) || (metaDate.getMonth() + 1);

  const points = (logs || [])
    .map((l) => ({
      day: l.dayOfMonth,
      value: l.qualityScore,
      results: l.resultsScore,
      dateKey: `${l.year}-${l.month}-${l.dayOfMonth}`,
    }))
    .filter((p) => Number(p.dateKey.split("-")[0]) === viewYear && Number(p.dateKey.split("-")[1]) === viewMonth)
    .filter((p) => p.day >= 1 && p.day <= totalDays)
    .sort((a, b) => a.day - b.day);

  const x = (day) => pad.left + ((day - 1) / (totalDays - 1)) * cw;
  const y = (pct) => pad.top + ch - (Math.max(0, Math.min(pct, 100)) / 100) * ch;

  const expectedPath = `M ${x(1)} ${y(0)} L ${x(totalDays)} ${y(100)}`;

  const execByDay = new Map();
  for (const p of points) execByDay.set(p.day, p.value);
  const execSteps = [...execByDay]
    .sort((a, b) => a[0] - b[0])
    .map(([day, value]) => ({ day, value }));
  const actualPath = `M ${x(1)} ${y(0)}` + execSteps.map((p) => ` L ${x(p.day)} ${y(p.value)}`).join("");
  const areaPath = execSteps.length
    ? `${actualPath} L ${x(execSteps[execSteps.length - 1].day)} ${y(0)} Z`
    : "";

  const resByDay = new Map();
  for (const p of points) {
    if (typeof p.results === "number") resByDay.set(p.day, p.results);
  }
  const resSteps = [...resByDay]
    .sort((a, b) => a[0] - b[0])
    .map(([day, value]) => ({ day, value }));
  const resultsPath = resSteps.length
    ? `M ${x(1)} ${y(0)}` + resSteps.map((p) => ` L ${x(p.day)} ${y(p.value)}`).join("")
    : "";

  const gridLines = [25, 50, 75, 100];
  const ticks = [5, 10, 15, 20, 25, 30];

  return (
    <div className="pl-chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Progress chart for the month">
        {gridLines.map((pct) => (
          <g key={pct}>
            <line
              x1={pad.left} y1={y(pct)} x2={w - pad.right} y2={y(pct)}
              stroke="rgba(16, 22, 21, 0.10)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <text
              x={pad.left - 6}
              y={y(pct)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="#5A756E"
              fontSize="8"
              fontWeight="600"
            >
              {pct}%
            </text>
          </g>
        ))}

        <path d={areaPath} fill="rgba(219,96,136,0.08)" />

        <path
          d={expectedPath}
          stroke={RING_DAYS}
          strokeWidth="1"
          strokeDasharray="4 6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {resSteps.length > 0 && (
          <path d={resultsPath} stroke={RING_RESULTS} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        )}

        {execSteps.length > 0 && (
          <path d={actualPath} stroke={RING_EXEC} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {execSteps.map((p) => (
          <circle key={`e-${p.day}`} cx={x(p.day)} cy={y(p.value)} r="2" fill={RING_EXEC} stroke="#fff" strokeWidth="1" />
        ))}
        {points
          .filter((p) => typeof p.results === "number")
          .map((p) => (
            <circle key={`r-${p.day}`} cx={x(p.day)} cy={y(p.results)} r="2" fill={RING_RESULTS} stroke="#fff" strokeWidth="1" />
          ))}

        {ticks.map((d) => (
          <text key={d} x={x(d)} y={h - 6} textAnchor="middle" fill="#5A756E" fontSize="8" fontWeight="600">
            {d}
          </text>
        ))}
      </svg>
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

  // Month stats mirroring the dashboard ProgressBar (live dashboard vs last saved log).
  const now = new Date();
  const liveKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isLive = selectedMonth === liveKey;
  const daysTotal = monthDays(selectedMonth);

  let monthStats = null;
  if (isLive) {
    monthStats = {
      actual: dashboard?.stats?.qualityPercent ?? 0,
      expected: dashboard?.stats?.expectedPercent ?? 0,
      daysCompleted: dashboard?.meta?.dayOfMonth ?? 0,
      daysInMonth: dashboard?.meta?.daysInMonth ?? daysTotal,
    };
  } else if (monthLogs.length) {
    const last = monthLogs[monthLogs.length - 1];
    monthStats = {
      actual: last.qualityScore,
      expected: last.expectedScore,
      daysCompleted: last.dayOfMonth,
      daysInMonth: daysTotal,
    };
  }
  const daysShown = monthStats?.daysInMonth ?? daysTotal;

  const diff = monthStats ? Math.round(monthStats.actual) - Math.round(monthStats.expected) : null;
  const status = !monthStats ? "empty" : diff >= 1 ? "AHEAD" : diff <= -1 ? "BEHIND" : "ON TRACK";
  const STATUS_WORDS = { AHEAD: "Ahead", "ON TRACK": "On Track", BEHIND: "Behind", empty: "No data" };
  const STATUS_COLORS = { AHEAD: PAPER.accent, "ON TRACK": "#1E7A33", BEHIND: "#B04A31", empty: "#7A8B86" };
  const statusWord = STATUS_WORDS[status];
  const delta = diff;
  const deltaColor = !monthStats ? "#7A8B86" : delta >= 1 ? PAPER.accent : delta <= -1 ? "#B04A31" : "#5A756E";

  // Rings mirroring the dashboard StatsBar.
  const actives = (cats || []).filter((c) => !c.isRewards);
  const totalActions = actives.reduce((s, c) => s + (c.actions || []).filter((a) => !a._deleted).length, 0);
  const hitCount = actives.reduce(
    (s, c) => s + (c.actions || []).filter((a) => !a._deleted && a.target > 0 && a.current >= a.target).length,
    0
  );
  const score = Math.round(computeOverallPct(cats));
  const resultsPct = Math.round(aggregateResultsPct(cats));
  const moneyItems = (cats || []).flatMap((c) => c.results || []).filter((r) => r.unit === "$");
  const moneyCurrent = moneyItems.reduce((s, r) => s + (r.current || 0), 0);
  const moneyTarget = moneyItems.reduce((s, r) => s + (r.target || 0), 0) || 1000;
  const moneyPct = moneyTarget > 0 ? Math.min(Math.round((moneyCurrent / moneyTarget) * 100), 100) : 0;
  const expectedPct = monthStats ? Math.round(monthStats.expected) : 0;

  const rings = [
    {
      label: "Execution",
      pct: score,
      center: `${score}%`,
      sub: `${hitCount} / ${totalActions} actions`,
      color: RING_EXEC,
      textColor: "#C7507A",
    },
    {
      label: "Money",
      pct: moneyPct,
      center: `${moneyPct}%`,
      sub: `$${moneyCurrent} of $${moneyTarget}`,
      color: RING_MONEY,
      textColor: "#A8821A",
    },
    {
      label: "Results",
      pct: resultsPct,
      center: `${resultsPct}%`,
      sub: "tracked · scored",
      color: RING_RESULTS,
      textColor: "#B96A23",
    },
    {
      label: "Days",
      pct: expectedPct,
      center: monthStats ? `${monthStats.daysCompleted}/${daysShown}` : `0/${daysShown}`,
      sub: "of the month",
      color: RING_DAYS,
      textColor: "#5A756E",
    },
  ];
  const title = monthName + " " + displayYear;

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

        {/* Dashboard-style top: stat rings + score rail + progress chart */}
        <div className="pl-summary">
          <div className="pl-rings-row">
            {rings.map((ring) => (
              <PaperRing key={ring.label} {...ring} expectedPct={expectedPct} />
            ))}
          </div>

          <div className="pl-metrics">
            <div className="pl-rail-card">
              <div className="pl-rail-head">
                <span className="pl-block-title">Execution score</span>
                <span className="pl-rail-chip">{title} · Day {monthStats ? monthStats.daysCompleted : 0}/{daysShown}</span>
              </div>
              <div className="pl-readout" style={{ color: deltaColor }}>
                {diff === null ? "—" : diff === 0 ? "±0" : diff > 0 ? `+${diff}` : diff}
                <span style={{ fontSize: 22, fontWeight: 600, marginLeft: 3 }}>%</span>
              </div>
              <div className="pl-status" style={{ color: STATUS_COLORS[status] }}>{statusWord}</div>
              <div className="pl-rail">
                <div
                  className="pl-rail-fill"
                  style={{
                    width: `${Math.min(monthStats?.actual ?? 0, 100)}%`,
                    background: RING_EXEC,
                  }}
                />
                {monthStats && (
                  <span
                    aria-hidden="true"
                    title={`Expected pace ${Math.round(monthStats.expected)}%`}
                    className="pl-rail-mark"
                    style={{
                      left: `calc(${Math.min(Math.max(monthStats.expected, 0), 100)}% - 5px)`,
                      background: RING_DAYS,
                    }}
                  />
                )}
              </div>
              <div className="pl-rail-foot">
                <span>Actual <b>{monthStats ? Math.round(monthStats.actual) : "–"}%</b></span>
                <span>Expected <b>{monthStats ? Math.round(monthStats.expected) : "–"}%</b></span>
                <span>Days <b>{monthStats ? `${monthStats.daysCompleted}/${daysShown}` : `0/${daysShown}`}</b></span>
              </div>
            </div>

            <div className="pl-chart-card">
              <div className="pl-rail-head">
                <span className="pl-block-title">Progress</span>
                <span className="pl-rail-chip">daily execution vs pace</span>
              </div>
              <PaperChart logs={logs} dashboard={dashboard} selectedMonth={selectedMonth} />
              <div className="pl-legend">
                <LegendSwatch color={RING_EXEC} label="Execution" />
                <LegendSwatch color={RING_DAYS} label="Should be" dashed />
                <LegendSwatch color={RING_RESULTS} label="Results" />
              </div>
            </div>
          </div>
        </div>

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