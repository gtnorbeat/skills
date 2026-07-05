import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Task, TaskStatus, TaskCategory, Priority } from "@/types";
import { fetchTasks, createTask, updateTask, deleteTask, restoreTask } from "@/utils/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterBar } from "@/components/ui/FilterBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageLoader } from "@/components/ui/PageLoader";
import { ErrorState } from "@/components/ui/ErrorState";
import { TaskCard } from "./TaskCard";
import { TaskDetail } from "./TaskDetail";
import { TASK_CATEGORY_LABELS } from "@/utils/statusHelpers";

const STATUS_FILTERS = [
  { label: "To Do", value: "todo" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done", value: "done" },
  { label: "Backlog", value: "backlog" },
];

const PRIORITY_FILTERS = [
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const CATEGORY_FILTERS = Object.entries(TASK_CATEGORY_LABELS).map(([value, label]) => ({
  label,
  value,
}));

type TaskView = "all" | "overdue" | "upcoming" | "high_priority" | "done";

export function CalendarPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [view, setView] = useState<TaskView>("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [newTask, setNewTask] = useState<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: Priority;
    category: TaskCategory;
    dueDate: string;
    assignee: string;
  }>({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    category: "admin",
    dueDate: today,
    assignee: "Label Owner",
  });

  useEffect(() => {
    let mounted = true;
    loadTasks(mounted);
    return () => { mounted = false; };
  }, []);

  async function loadTasks(mounted = true) {
    try {
      setLoading(true);
      const data = await fetchTasks();
      if (mounted) {
        setTasks(data);
        setError(null);
      }
    } catch (err) {
      if (mounted) {
        setError(err instanceof Error ? err.message : "Failed to load tasks");
      }
    } finally {
      if (mounted) setLoading(false);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    try {
      const created = await createTask({
        title: newTask.title.trim(),
        description: newTask.description,
        status: newTask.status,
        priority: newTask.priority,
        category: newTask.category,
        dueDate: newTask.dueDate,
        assignee: newTask.assignee,
      });
      setTasks((prev) => [...prev, created]);
      setShowNewForm(false);
      setNewTask({
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        category: "admin",
        dueDate: today,
        assignee: "Label Owner",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    }
  }

  const handleStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t
      )
    );
    try {
      await updateTask(taskId, { status: newStatus });
    } catch {
      // Revert on failure by refetching
      const data = await fetchTasks().catch(() => null);
      if (data) setTasks(data);
    }
  }, []);

  /**
   * Card-row delete quick action. Mirrors the same pattern as the other
   * pages: confirm + API call + remove from local state + close the
   * open detail panel if it's rooted at the same id.
   */
  /** Card-row delete + undo flow. Routes through useUndoableDelete so
   *  the user gets a 5 s undo window on the toast; this handler only
   *  owns the post-delete routing (close the open detail panel). */
  const { delete: deleteTaskRow } = useUndoableDelete<Task>({
    apiDelete: deleteTask,
    apiRestore: restoreTask,
    items: tasks,
    setItems: setTasks,
    labelFn: (t) => `Task "${t.title}"`,
  });

  async function handleTaskCardDelete(task: Task) {
    await deleteTaskRow(task);
    if (id === task.id) navigate("/calendar");
  }

  const filtered = tasks.filter((task) => {
    const ms = task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.description.toLowerCase().includes(search.toLowerCase()) ||
      (task.relatedTo?.title ?? "").toLowerCase().includes(search.toLowerCase());
    const ss = statusFilter === "all" || task.status === statusFilter;
    const ps = priorityFilter === "all" || task.priority === priorityFilter;
    const cs = categoryFilter === "all" || task.category === categoryFilter;

    let vs = true;
    if (view === "overdue") vs = task.overdue && task.status !== "done";
    else if (view === "upcoming") vs = !task.overdue && task.status !== "done";
    else if (view === "high_priority") vs = (task.priority === "high" || task.priority === "critical") && task.status !== "done";
    else if (view === "done") vs = task.status === "done";

    return ms && ss && ps && cs && vs;
  });

  const selectedTask = id ? tasks.find((t) => t.id === id) ?? null : null;
  const overdueCount = tasks.filter((t) => t.overdue && t.status !== "done").length;
  const upcomingCount = tasks.filter((t) => !t.overdue && t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const highPriorityCount = tasks.filter((t) => (t.priority === "high" || t.priority === "critical") && t.status !== "done").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader title="Calendar / Tasks" subtitle={`${tasks.length} total • ${overdueCount} overdue`} />
        <div className="flex items-center gap-3">
          <div className="w-full sm:w-56">
            <SearchInput value={search} onChange={setSearch} placeholder="Search tasks..." />
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 hover:text-cyan-300"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </div>

      {/* Quick views */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "All Tasks", count: tasks.length },
          { key: "high_priority", label: "High Priority", count: highPriorityCount, accent: highPriorityCount > 0 },
          { key: "overdue", label: "Overdue", count: overdueCount, accent: overdueCount > 0, urgent: true },
          { key: "upcoming", label: "Upcoming", count: upcomingCount },
          { key: "done", label: "Completed", count: doneCount },
        ].map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key as TaskView)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
              view === v.key
                ? "bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30"
                : "bg-zinc-800/40 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            }`}
          >
            {v.label} ({v.count})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-6">
        <FilterBar label="Status" options={STATUS_FILTERS} selected={statusFilter} onChange={setStatusFilter} />
        <FilterBar label="Priority" options={PRIORITY_FILTERS} selected={priorityFilter} onChange={setPriorityFilter} />
        <FilterBar label="Category" options={CATEGORY_FILTERS} selected={categoryFilter} onChange={setCategoryFilter} />
      </div>

      {/* Error — offline-aware */}
      {error && (
        <ErrorState
          message={!isOnline ? "You appear to be offline — check your connection and try again" : error}
          onRetry={() => void loadTasks()}
        />
      )}

      {/* Task list */}
      {loading ? (
        <PageLoader message="" />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-16 text-center">
          <span className="mb-3 text-3xl text-zinc-600 aura-float">▤</span>
          <p className="text-sm font-medium text-zinc-400">No tasks found</p>
          <p className="mt-1 text-xs text-zinc-600">
            {tasks.length === 0
              ? 'Add your first task with the "+ New Task" button'
              : "Try adjusting your search or filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task, i) => (
            <div key={task.id} className={`aura-enter-fade-up aura-stagger-${(i % 6) + 1}`}>
              <TaskCard
                task={task}
                onClick={() => navigate(`/calendar/${task.id}`)}
                onStatusChange={handleStatusChange}
                onDelete={handleTaskCardDelete}
              />
            </div>
          ))}
        </div>
      )}

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => navigate("/calendar")}
          onStatusChange={handleStatusChange}
          onUpdate={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          }}
        />
      )}

      {/* New Task modal — local state modal mirror of the existing
          add-buttons on ArtistPage / ContractPage. Reuses the same
          blank-form backdrop pattern from the existing pages. */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewForm(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">New Task</h3>
              <button
                onClick={() => setShowNewForm(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800/50 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors"
              >✕</button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label htmlFor="task-title" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Title
                </label>
                <input
                  id="task-title"
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Approve BN1 press kit"
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="task-description" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Description
                </label>
                <textarea
                  id="task-description"
                  value={newTask.description}
                  onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="task-status" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</label>
                  <select
                    id="task-status"
                    value={newTask.status}
                    onChange={(e) => setNewTask((p) => ({ ...p, status: e.target.value as TaskStatus }))}
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="task-priority" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Priority</label>
                  <select
                    id="task-priority"
                    value={newTask.priority}
                    onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value as Priority }))}
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="task-due-date" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Due Date</label>
                  <input
                    id="task-due-date"
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask((p) => ({ ...p, dueDate: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="task-assignee" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Assignee</label>
                  <input
                    id="task-assignee"
                    type="text"
                    value={newTask.assignee}
                    onChange={(e) => setNewTask((p) => ({ ...p, assignee: e.target.value }))}
                    placeholder="Label Owner"
                    className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="task-category" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Category</label>
                <select
                  id="task-category"
                  value={newTask.category}
                  onChange={(e) => setNewTask((p) => ({ ...p, category: e.target.value as TaskCategory }))}
                  className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                >
                  {CATEGORY_FILTERS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="rounded-lg px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTask.title.trim()}
                  className="rounded-lg bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
