import { useEffect, useState } from "react";
import { useGoalsStore } from "./store/useGoalsStore";
import Nav from "./components/Nav";
import Header from "./components/Header";
import StatsBar from "./components/StatsBar";
import ProgressBar from "./components/ProgressBar";
import ProgressChart from "./components/ProgressChart";
import CategoryCard from "./components/CategoryCard";
import Footer from "./components/Footer";
import AuthScreen from "./components/AuthScreen";
import AddCategoryButton from "./components/AddCategoryButton";
import CheckIn from "./components/CheckIn";
import MonthEndAnalysis from "./components/MonthEndAnalysis";
import PlanPage from "./components/PlanPage";
import { userData } from "./data/goals";

function useDashboard() {
  const categories = useGoalsStore((s) => s.categories);
  const dashboard = useGoalsStore((s) => s.dashboard);
  const progressLogs = useGoalsStore((s) => s.progressLogs);
  return { categories, dashboard, progressLogs };
}

export default function App() {
  const sessionStarted = useGoalsStore((s) => s.sessionStarted);
  const bootstrapped = useGoalsStore((s) => s.bootstrapped);

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <p className="text-text-tertiary">Loading…</p>
      </div>
    );
  }

  if (!sessionStarted) {
    return <AuthScreen />;
  }

  return <Dashboard />;
}

function Dashboard() {
  const { categories, dashboard, progressLogs } = useDashboard();
  const [showAnalysis, setShowAnalysis] = useState(false);
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
  const resetAll = useGoalsStore((s) => s.resetAll);
  const copyLastMonth = useGoalsStore((s) => s.copyLastMonth);
  const emptyMonth = useGoalsStore((s) => s.emptyMonth);
  const checkDailyResets = useGoalsStore((s) => s.checkDailyResets);

  useEffect(() => {
    checkDailyResets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen text-muted overflow-hidden relative isolate">
      <div aria-hidden className="bg-anim">
        <div className="bg-orb orb-mint" />
        <div className="bg-orb orb-periwinkle" />
        <div className="bg-orb orb-coral" />
        <div className="bg-orb orb-teal" />
        <div className="bg-sheen" />
      </div>
      <Nav view={view} onSetView={setView} />
      {view === "plan" ? (
        <PlanPage categories={categories} onBack={() => setView("dashboard")} />
      ) : (
      <>
      <div className="page-container flex flex-col gap-4">
        <div className="hero-row grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Header daysElapsed={userData.daysPassed} categories={categories} logs={progressLogs} />
          <StatsBar cats={categories} />
        </div>

        <button
          onClick={() => setShowAnalysis(true)}
          className="card w-full py-3 px-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
          style={{
            background: "linear-gradient(90deg, var(--color-elevated), var(--color-surface))",
            border: "1px solid var(--color-border-active)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[18px]">🔍</span>
            <span className="text-sm font-semibold text-white">Month Analysis</span>
          </div>
          <span className="text-xs text-text-tertiary">tap to review →</span>
        </button>
        {showAnalysis && (
          <MonthEndAnalysis cats={categories || []} onClose={() => setShowAnalysis(false)} />
        )}

        <ProgressBar cats={categories} />
        <ProgressChart logs={progressLogs} dashboard={dashboard} />

        <section aria-label="Your categories" className="cats-grid grid gap-4 md:grid-cols-2">
          {categories.map((cat, i) => (
            <div key={cat.id} className={cat.fullWidth ? "col-span-2" : ""}>
              <CategoryCard
                category={cat}
                index={i}
                onMove={moveCategory}
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
          updateResult(catId, idx, "current", checked ? result.target : 0);
        }}
      />
      </>
      )}
    </main>
  );
}
