"use client";

import type { Task } from "@/types";
import { Badge } from "@/components/ui/badge";

// ── Priority colors ────────────────────────────────────────────────

const PRIORITY_CLASSES: Record<string, string> = {
  P0: "bg-red-500 text-white",
  P1: "bg-orange-500 text-white",
  P2: "bg-yellow-500 text-white",
  P3: "bg-green-500 text-white",
};

// ── Relative date ──────────────────────────────────────────────────

function relativeDue(due: string | null): string | null {
  if (!due) return null;
  const now = new Date();
  const dueDate = new Date(due);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate()
  );
  const diffMs = dueDay.getTime() - todayStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)}d ago`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `${diffDays}d`;
}

// ── Component ──────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  onClick: (task: Task) => void;
}

export default function TaskCard({ task, onDragStart, onClick }: TaskCardProps) {
  const isJavier = task.assigned_to_javier;
  const dueLabel = relativeDue(task.due_at);

  return (
    <div
      draggable="true"
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onClick(task)}
      className={`cursor-grab rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${
        isJavier ? "border-l-4 border-l-blue-600 border-t-gray-200 border-r-gray-200 border-b-gray-200" : "border-gray-200"
      }`}
    >
      <div className="flex items-start gap-2">
        <Badge
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
            PRIORITY_CLASSES[task.priority] ?? PRIORITY_CLASSES.P3
          }`}
        >
          {task.priority}
        </Badge>
        {isJavier && (
          <Badge className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
            Decision
          </Badge>
        )}
      </div>

      <p className="mt-1.5 text-sm font-medium leading-snug text-gray-900 line-clamp-2">
        {task.title}
      </p>

      <div className="mt-2 flex items-center justify-between">
        {task.assigned_to_code ? (
          <span className="text-xs font-mono text-gray-500">
            {task.assigned_to_code}
          </span>
        ) : (
          <span className="text-xs text-gray-400 italic">Unassigned</span>
        )}

        <div className="flex items-center gap-2">
          {dueLabel && (
            <span
              className={`text-xs font-medium ${
                dueLabel.includes("ago")
                  ? "text-red-500"
                  : dueLabel === "Today"
                    ? "text-orange-500"
                    : "text-gray-500"
              }`}
            >
              {dueLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
