"use client";

import { useEffect, useState, useCallback } from "react";

import type { Task, TaskPriority, TaskStatus, TaskType } from "@/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AGENT_SPRITES } from "@/lib/sprites/zone-layout";
import { useTaskStore } from "@/store/task-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import TaskCard from "./TaskCard";
import TaskDetail from "./TaskDetail";
import CreateTaskDialog from "./CreateTaskDialog";

// ── Constants ──────────────────────────────────────────────────────

const AGENT_CODES = AGENT_SPRITES.map((a) => a.code);

interface KanbanColumn {
  status: TaskStatus;
  label: string;
  className: string;
}

const COLUMNS: KanbanColumn[] = [
  {
    status: "pending",
    label: "Pending",
    className: "border-gray-300",
  },
  {
    status: "in_progress",
    label: "In Progress",
    className: "border-yellow-400",
  },
  {
    status: "waiting",
    label: "Waiting (for Javier)",
    className: "border-blue-600",
  },
  {
    status: "completed",
    label: "Done",
    className: "border-green-500",
  },
];

// ── Component ──────────────────────────────────────────────────────

export default function TaskBoard() {
  const {
    tasks,
    filters,
    loading,
    setTasks,
    setFilters,
    setLoading,
    moveTask,
    updateTask,
    addTask,
    removeTask,
    getFilteredTasks,
    setDraggedTask,
    draggedTaskId,
  } = useTaskStore();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Fetch tasks on mount
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      const mapped: Task[] = (data ?? []).map((row) => ({
        id: row.id as string,
        conv_id: row.conv_id as string | null,
        assigned_to_code: row.assigned_to_code as string | null,
        assigned_to_javier: row.assigned_to_javier as boolean,
        type: row.type as TaskType,
        priority: row.priority as TaskPriority,
        title: row.title as string,
        description: row.description as string | null,
        status: row.status as TaskStatus,
        due_at: row.due_at as string | null,
        completed_at: row.completed_at as string | null,
        created_at: row.created_at as string,
      }));

      setTasks(mapped);
    } finally {
      setLoading(false);
    }
  }, [setTasks, setLoading]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Subscribe to Realtime updates
  useEffect(() => {
    const supabase = getBrowserSupabase();

    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks" },
        (payload) => {
          const row = payload.new;
          const task: Task = {
            id: row.id as string,
            conv_id: row.conv_id as string | null,
            assigned_to_code: row.assigned_to_code as string | null,
            assigned_to_javier: row.assigned_to_javier as boolean,
            type: row.type as TaskType,
            priority: row.priority as TaskPriority,
            title: row.title as string,
            description: row.description as string | null,
            status: row.status as TaskStatus,
            due_at: row.due_at as string | null,
            completed_at: row.completed_at as string | null,
            created_at: row.created_at as string,
          };
          // Only add if not already present (from optimistic update)
          const existing = useTaskStore.getState().tasks;
          if (!existing.find((t) => t.id === task.id)) {
            addTask(task);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks" },
        (payload) => {
          const row = payload.new;
          updateTask(row.id as string, {
            assigned_to_code: row.assigned_to_code as string | null,
            assigned_to_javier: row.assigned_to_javier as boolean,
            type: row.type as TaskType,
            priority: row.priority as TaskPriority,
            title: row.title as string,
            description: row.description as string | null,
            status: row.status as TaskStatus,
            due_at: row.due_at as string | null,
            completed_at: row.completed_at as string | null,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "tasks" },
        (payload) => {
          removeTask(payload.old.id as string);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addTask, updateTask, removeTask]);

  // Filter tasks
  const filteredTasks = getFilteredTasks();

  // Get tasks for a specific column
  const getColumnTasks = (status: TaskStatus): Task[] => {
    if (status === "waiting") {
      // Waiting column shows tasks where assigned_to_javier=true and status is not completed/cancelled
      return filteredTasks.filter(
        (t) =>
          t.assigned_to_javier &&
          t.status !== "completed" &&
          t.status !== "cancelled"
      );
    }
    return filteredTasks.filter((t) => {
      // Tasks assigned to Javier that are not completed go to waiting column instead
      if (
        t.assigned_to_javier &&
        status !== "completed" &&
        status !== "cancelled" &&
        t.status !== "completed" &&
        t.status !== "cancelled"
      ) {
        return false;
      }
      return t.status === status;
    });
  };

  // Drag handlers
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    taskId: string
  ) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    targetStatus: TaskStatus
  ) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    setDraggedTask(null);

    // Optimistic update
    moveTask(taskId, targetStatus);

    // Persist to DB
    const supabase = getBrowserSupabase();
    if (targetStatus === "waiting") {
      await supabase
        .from("tasks")
        .update({ assigned_to_javier: true, status: "pending" as const })
        .eq("id", taskId);
    } else if (targetStatus === "completed") {
      await supabase
        .from("tasks")
        .update({
          status: targetStatus,
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId);
    } else {
      await supabase
        .from("tasks")
        .update({ status: targetStatus })
        .eq("id", taskId);
    }
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleCardClick = (task: Task) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <header className="mb-6">
        <a
          href="/"
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          &larr; Back
        </a>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
            <p className="text-sm text-gray-500">
              Drag-and-drop task board with real-time updates
            </p>
          </div>
          <CreateTaskDialog>
            <Button size="sm">+ New Task</Button>
          </CreateTaskDialog>
        </div>
      </header>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Priority filter */}
        <Select
          value={filters.priority ?? "all"}
          onValueChange={(v) =>
            setFilters({ priority: v === "all" ? null : (v as TaskPriority) })
          }
        >
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="P0">P0</SelectItem>
            <SelectItem value="P1">P1</SelectItem>
            <SelectItem value="P2">P2</SelectItem>
            <SelectItem value="P3">P3</SelectItem>
          </SelectContent>
        </Select>

        {/* Agent filter */}
        <Select
          value={filters.agentCode ?? "all"}
          onValueChange={(v) =>
            setFilters({ agentCode: v === "all" ? null : v })
          }
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {AGENT_CODES.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Solo mios toggle */}
        <Button
          variant={filters.onlyMine ? "default" : "outline"}
          size="sm"
          onClick={() => setFilters({ onlyMine: !filters.onlyMine })}
          className="h-8 text-xs"
        >
          Solo mios
        </Button>

        {loading && (
          <span className="ml-auto text-xs text-gray-400">Loading...</span>
        )}

        <Badge variant="outline" className="ml-auto text-xs">
          {tasks.length} total
        </Badge>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const columnTasks = getColumnTasks(col.status);
          return (
            <div
              key={col.status}
              className={`rounded-lg border-t-4 bg-white p-3 shadow-sm ${col.className}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                  {col.label}
                </h2>
                <Badge variant="secondary" className="text-[10px]">
                  {columnTasks.length}
                </Badge>
              </div>

              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-2 pr-2">
                  {columnTasks.length === 0 && (
                    <div className="rounded border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
                      No tasks
                    </div>
                  )}
                  {columnTasks.map((task) => (
                    <div key={task.id} onDragEnd={handleDragEnd}>
                      <TaskCard
                        task={task}
                        onDragStart={handleDragStart}
                        onClick={handleCardClick}
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>

      {/* Task detail sheet */}
      <TaskDetail
        task={selectedTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </main>
  );
}
