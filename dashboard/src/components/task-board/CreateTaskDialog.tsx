"use client";

import { useState } from "react";

import type { Task, TaskPriority, TaskType } from "@/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AGENT_SPRITES } from "@/lib/sprites/zone-layout";
import { useTaskStore } from "@/store/task-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Constants ──────────────────────────────────────────────────────

const AGENT_CODES = AGENT_SPRITES.map((a) => a.code);

const PRIORITIES: TaskPriority[] = ["P0", "P1", "P2", "P3"];
const TYPES: TaskType[] = ["todo", "decision", "followup", "deploy", "alert"];

// ── Component ──────────────────────────────────────────────────────

interface CreateTaskDialogProps {
  children: React.ReactNode;
}

export default function CreateTaskDialog({ children }: CreateTaskDialogProps) {
  const { addTask } = useTaskStore();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("P2");
  const [type, setType] = useState<TaskType>("todo");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("P2");
    setType("todo");
    setAssignedTo("");
    setDueDate("");
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const supabase = getBrowserSupabase();

      const newTask = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        type,
        assigned_to_code: assignedTo || null,
        assigned_to_javier: type === "decision",
        status: "pending" as const,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
        conv_id: null,
      };

      const { data, error } = await supabase
        .from("tasks")
        .insert(newTask)
        .select()
        .single();

      if (error) {
        console.error("Failed to create task:", error);
        return;
      }

      if (data) {
        const taskData: Task = {
          id: data.id as string,
          conv_id: data.conv_id as string | null,
          assigned_to_code: data.assigned_to_code as string | null,
          assigned_to_javier: data.assigned_to_javier as boolean,
          type: data.type as TaskType,
          priority: data.priority as TaskPriority,
          title: data.title as string,
          description: data.description as string | null,
          status: data.status as "pending",
          due_at: data.due_at as string | null,
          completed_at: data.completed_at as string | null,
          created_at: data.created_at as string,
        };
        addTask(taskData);
      }

      resetForm();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gray-900">New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          {/* Priority + Type row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Priority
              </label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Type
              </label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as TaskType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assign to */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Assign to
            </label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select agent..." />
              </SelectTrigger>
              <SelectContent>
                {AGENT_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Due date
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!title.trim() || saving}
            >
              {saving ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
