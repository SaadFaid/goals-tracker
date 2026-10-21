import { useEffect, useState } from "react";
import { useGoalsStore } from "./store/useGoalsStore";
import { resultDoneValue, resultNotDoneValue } from "./lib/score";
import Nav from "./components/Nav";
import StatsBar from "./components/StatsBar";
import ProgressBar from "./components/ProgressBar";
import ProgressChart from "./components/ProgressChart";
import CategoryCard from "./components/CategoryCard";
import Footer from "./components/Footer";
import AuthScreen from "./components/AuthScreen";
import AddCategoryButton from "./components/AddCategoryButton";
import CheckIn from "./components/CheckIn";
import Notes from "./components/Notes";
import Pomodoro from "./components/Pomodoro";
import MonthEndAnalysis from "./components/MonthEndAnalysis";
import PrintReport from "./components/PrintReport";
import Leaderboard from "./components/Leaderboard";
import PlanPage from "./components/PlanPage";
import Landing from "./pages/Landing";
import Legal from "./pages/Legal";
import ResetPassword from "./components/ResetPassword";
import Onboarding from "./components/Onboarding";
import HowToTour from "./components/HowToTour";
import SettingsPanel from "./components/SettingsPanel";
import { DialogHost } from "./components/GoalDialogs";
import { Toaster } from "./components/ui";

const go = (path) => {
  if (window.location.hash !== `#${path}`) window.location.hash = path;
};

/* ── Hash routing ──────────────────────────────────────────────
   No router dependency: the app is served from a Pages subpath, and a hash
   route works there without any server rewrite rules.
   #/            landing (public)
   #/login       log in
   #/signup      create account
   #/forgot      request a reset link
   #/reset       set a new password (?token=…)
   #/legal/:id   privacy / terms / refunds / cookies
   #/app         the tracker
   ────────────────────────────────────────────────────────────── */
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const raw = hash.replace(/^#/, "") || "/";
  const [pathname, query] = raw.split("?");
  return { pathname: pathname || "/", params: new URLSearchParams(query || "") };
}

function useDashboard() {
  const categories = useGoalsStore((s) => s.categories);
  const dashboard = useGoalsStore((s) => s.dashboard);
  const progressLogs = useGoalsStore((s) => s.progressLogs);
  return { categories, dashboard, progressLogs };
}

function Loading() {
  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center">
      <p className="text-text-tertiary">Loading…</p>
    </div>
  );
}

export default function App() {
  const bootstrapped = useGoalsStore((s) => s.bootstrapped);
  const isGuest = useGoalsStore((s) => s.isGuest);
  const userEmail = useGoalsStore((s) => s.user?.email);
  const sessionStarted = useGoalsStore((s) => s.sessionStarted);
  const isServerBacked = useGoalsStore((s) => s.isServerBacked === true);
  const restoreSession = useGoalsStore((s) => s.restoreSession);
  const onboarding = useGoalsStore((s) => s.onboarding);
  const { pathname, params } = useHashRoute();

  const signedIn = !!userEmail && !isGuest;

  // A reload rehydrates "logged in" from localStorage, but the access token is
  // gone. Re-establish it on mount, otherwise every edit this session would
  // fail to save.
  useEffect(() => {
    if (!isGuest && userEmail) restoreSession();
  }, [isGuest, userEmail, restoreSession]);

  // Signed in but the server dropped us (tunnel rotation, API restart). Bring
  // the session back the moment the network returns, without a login flash.
  useEffect(() => {
    if (isGuest || !userEmail || isServerBacked) return undefined;
    const attempt = () => restoreSession();
    const onOnline = () => attempt();
    window.addEventListener("online", onOnline);
    const id = setInterval(attempt, 15000);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(id);
    };
  }, [isGuest, userEmail, isServerBacked, restoreSession]);

  // A signed-in member who lands on the marketing page keeps it, unless they
  // asked to open the tracker.
  useEffect(() => {
    if (pathname === "/app" && !sessionStarted) go(signedIn ? "/app" : "/");
  }, [pathname, sessionStarted, signedIn]);

  if (!bootstrapped) return <Loading />;

  /* ── Public pages ── */
  if (pathname === "/" || pathname === "") return <Landing />;

  if (pathname.startsWith("/legal/")) {
    return <Legal id={pathname.split("/")[2]} />;
  }

  if (pathname === "/login" || pathname === "/signup") {
    if (signedIn && sessionStarted) {
      return <Dashboard />;
    }
    return (
      <AuthScreen
        mode={pathname === "/signup" ? "register" : "login"}
        onModeChange={(next) => go(next === "register" ? "/signup" : "/login")}
        onForgot={() => go("/forgot")}
      />
    );
  }

  if (pathname === "/forgot") {
    return <ResetPassword mode="forgot" onBack={() => go("/login")} />;
  }

  if (pathname === "/reset") {
    return (
      <ResetPassword
        mode="reset"
        token={params.get("token") || ""}
        onBack={() => go("/login")}
        onDone={() => go("/login")}
      />
    );
  }

  /* ── The tracker ── */
  if (!sessionStarted) return <Landing />;

  if (onboarding.started && !onboarding.done) {
    return <Onboarding onFinish={() => go("/app")} />;
  }

  return <Dashboard />;
}

function Dashboard() {
  const { categories, dashboard, progressLogs } = useDashboard();
  const user = useGoalsStore((s) => s.user);
  const isGuest = useGoalsStore((s) => s.isGuest);
  const selectedMonth = useGoalsStore((s) => s.selectedMonth);
  const tourSeen = useGoalsStore((s) => s.tourSeen);
  const setTourSeen = useGoalsStore((s) => s.setTourSeen);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [view, setView] = useState("dashboard");

  const undo = useGoalsStore((s) => s.undo);
  const undoStack = useGoalsStore((s) => s.undoStack);
  const toggleExpanded = useGoalsStore((s) => s.toggleExpanded);
  const updateAction = useGoalsStore((s) => s.updateAction);
  const incrementAction = useGoalsStore((s) => s.incrementAction);
  const updateResult = useGoalsStore((s) => s.updateResult);
  const incrementResult = useGoalsStore((s) => s.incrementResult);
  const addAction = useGoalsStore((s) => s.addAction);
  const deleteAction = useGoalsStore((s) => s.deleteAction);
  const addResult = useGoalsStore((s) => s.addResult);
  const deleteResult = useGoalsStore((s) => s.deleteResult);
  const addCategory = useGoalsStore((s) => s.addCategory);
  const updateCategory = useGoalsStore((s) => s.updateCategory);
  const deleteCategory = useGoalsStore((s) => s.deleteCategory);
  const claimReward = useGoalsStore((s) => s.claimReward);
  const unclaimReward = useGoalsStore((s) => s.unclaimReward);
  const addReward = useGoalsStore((s) => s.addReward);
  const updateReward = useGoalsStore((s) => s.updateReward);
  const deleteReward = useGoalsStore((s) => s.deleteReward);
  const moveCategory = useGoalsStore((s) => s.moveCategory);
  const moveAction = useGoalsStore((s) => s.moveAction);
  const moveResult = useGoalsStore((s) => s.moveResult);
  const resetAll = useGoalsStore((s) => s.resetAll);
  const copyLastMonth = useGoalsStore((s) => s.copyLastMonth);
  const emptyMonth = useGoalsStore((s) => s.emptyMonth);
  const checkDailyResets = useGoalsStore((s) => s.checkDailyResets);

  useEffect(() => {
    checkDailyResets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The tour runs once, right after onboarding.
  useEffect(() => {
    if (!tourSeen) setShowTour(true);
  }, [tourSeen]);

  return (
    <main className="min-h-screen text-muted relative isolate">
      <div aria-hidden className="bg-anim">
        <div className="bg-orb orb-mint" />
        <div className="bg-orb orb-periwinkle" />
        <div className="bg-orb orb-coral" />
        <div className="bg-orb orb-teal" />
        <div className="bg-sheen" />
      </div>
      <Nav
        view={view}
        onSetView={setView}
        onOpenAnalysis={() => setShowAnalysis(true)}
        onOpenLeaderboard={() => setShowLeaderboard(true)}
        onPrint={() => setShowPrint(true)}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenTour={() => setShowTour(true)}
      />
      <HowToTour
        open={showTour}
        onClose={() => {
          setShowTour(false);
          setTourSeen(true);
        }}
        onDone={() => setTourSeen(true)}
      />
      <DialogHost />
      <Toaster />
      {showPrint && (
        <PrintReport
          cats={categories}
          dashboard={dashboard}
          logs={progressLogs}
          selectedMonth={selectedMonth}
          user={user}
          isGuest={isGuest}
          onClose={() => setShowPrint(false)}
        />
      )}
      {view === "plan" ? (
        <PlanPage categories={categories} onBack={() => setView("dashboard")} />
      ) : (
      <>
      <div className="page-container flex flex-col gap-4">
        <StatsBar cats={categories} />

        <ProgressBar cats={categories} />
        <ProgressChart logs={progressLogs} dashboard={dashboard} />

        {showAnalysis && (
          <MonthEndAnalysis cats={categories || []} onClose={() => setShowAnalysis(false)} />
        )}

        <section aria-label="Your categories" className="cats-grid grid grid-cols-1 gap-4 lg:grid-cols-2">
          {categories.map((cat, i) => (
            <div key={cat.id} className={"min-w-0" + (cat.fullWidth ? " lg:col-span-2" : "")}>
              <CategoryCard
                category={cat}
                index={i}
                onMove={moveCategory}
                onMoveAction={moveAction}
                onMoveResult={moveResult}
                onActionUpdate={updateAction}
                onActionIncrement={incrementAction}
                onResultUpdate={updateResult}
                onResultIncrement={incrementResult}
                onToggle={toggleExpanded}
                onAddAction={addAction}
                onDeleteAction={deleteAction}
                onAddResult={addResult}
                onDeleteResult={deleteResult}
                onUpdateCategory={updateCategory}
                onDeleteCategory={deleteCategory}
                onClaimReward={claimReward}
                onUnclaimReward={unclaimReward}
                onAddReward={addReward}
                onUpdateReward={updateReward}
                onDeleteReward={deleteReward}
              />
            </div>
          ))}
        </section>

        <div className="flex flex-col items-center gap-3 md:items-center w-full">
          <div className="w-full max-w-lg mx-auto">
            <AddCategoryButton onAdd={addCategory} />
          </div>

          {undoStack.length > 0 ? (
            <button
              onClick={undo}
              className="text-xs text-text-tertiary hover:text-muted underline-offset-4 hover:underline transition-colors"
            >
              Undo last change
            </button>
          ) : null}
        </div>

        <Footer onReset={resetAll} onCopyLastMonth={copyLastMonth} onEmptyMonth={emptyMonth} />
      </div>
      <CheckIn
        categories={categories}
        onIncrement={incrementAction}
        onDecrement={(catId, idx) => incrementAction(catId, idx, -1)}
        onResultToggle={(catId, idx, checked) => {
          const result = categories.find((c) => c.id === catId)?.results?.[idx];
          if (!result) return;
          updateResult(catId, idx, "current", checked ? resultDoneValue(result) : resultNotDoneValue(result));
        }}
      />
      <Notes />
      <Pomodoro />
      </>
      )}
    </main>
  );
}
