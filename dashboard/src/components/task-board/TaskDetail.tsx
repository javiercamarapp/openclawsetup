"use client";

import { useState, useEffect, useCallback } from "react";

import type { Task, TaskStatus } from "@/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AGENT_SPRITES } from "@/lib/sprites/zone-layout";
import { useTaskStore } from "@/store/task-store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

// ── Constants ──────────────────────────────────────────────────────

const AGENT_CODES = AGENT_SPRITES.map((a) => a.code);

const PRIORITY_COLORS: Record<string, string> = {
  P0: "bg-red-500 text-white",
  P1: "bg-orange-500 text-white",
  P2: "bg-yellow-500 text-white",
  P3: "bg-green-500 text-white",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  waiting: "Waiting",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface ConvMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

// ── Component ──────────────────────────────────────────────────────

interface TaskDetailProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TaskDetail({
  task,
  open,
  onOpenChange,
}: TaskDetailProps) {
  const { updateTask } = useTaskStore();
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reassignAgent, setReassignAgent] = useState<string>("");
  const [javierResponse, setJavierResponse] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true);
    try {
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from("msg_log")
        .select("id, role, content, created_at")
        .eq("conv_id", convId)
        .order("created_at", { ascending: true })
        .limit(50);

      setMessages(
        (data ?? []).map((m) => ({
          id: m.id as string,
          role: m.role as string,
          content: m.content as string,
          created_at: m.created_at as string,
        }))
      );
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (open && task?.conv_id) {
      fetchMessages(task.conv_id);
    } else {
      setMessages([]);
    }
    setReassignAgent("");
    setJavierResponse("");
  }, [open, task?.conv_id, fetchMessages]);

  if (!task) return null;

  const handleStatusUpdate = async (newStatus: TaskStatus) => {
    setActionLoading(true);
    try {
      const supabase = getBrowserSupabase();
      const updates: Partial<Task> = { status: newStatus };
      if (newStatus === "completed") {
        updates.completed_at = new Date().toISOString();
      }
      await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id);
      updateTask(task.id, updates);
      onOpenChange(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignAgent) return;
    setActionLoading(true);
    try {
      const supabase = getBrowserSupabase();
      const updates = {
        assigned_to_code: reassignAgent,
        assigned_to_javier: false,
      };
      await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id);
      updateTask(task.id, updates);
      setReassignAgent("");
    } finally {
      setActionLoading(false);
    }
  };

  const handleJavierDecision = async (decision: "approve" | "reject") => {
    setActionLoading(true);
    try {
      const supabase = getBrowserSupabase();
      const updates: Partial<Task> = {
        status: "completed" as TaskStatus,
        completed_at: new Date().toISOString(),
        description: `${task.description ?? ""}\n\n---\nJavier: ${decision.toUpperCase()}${javierResponse ? ` - ${javierResponse}` : ""}`,
      };
      await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id);
      updateTask(task.id, updates);
      onOpenChange(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleJavierRespond = async () => {
    if (!javierResponse.trim()) return;
    setActionLoading(true);
    try {
      const supabase = getBrowserSupabase();
      const updates: Partial<Task> = {
        description: `${task.description ?? ""}\n\n---\nJavier: ${javierResponse}`,
      };
      await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id);
      updateTask(task.id, updates);
      setJavierResponse("");
    } finally {
      setActionLoading(false);
    }
  };

  const isDecisionTask = task.assigned_to_javier;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.P3
              }`}
            >
              {task.priority}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {task.type}
            </Badge>
            {isDecisionTask && (
              <Badge className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                Decision
              </Badge>
            )}
          </div>
          <SheetTitle className="text-gray-900">{task.title}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 pb-4">
            {/* Status & assignment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500">Status</p>
                <p className="text-sm text-gray-900">
                  {STATUS_LABELS[task.status] ?? task.status}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Assigned to</p>
                <p className="text-sm font-mono text-gray-900">
                  {task.assigned_to_code ?? "Unassigned"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Due</p>
                <p className="text-sm text-gray-900">
                  {task.due_at
                    ? new Date(task.due_at).toLocaleDateString()
                    : "No due date"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Created</p>
                <p className="text-sm text-gray-900">
                  {new Date(task.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Description */}
            {task.description && (
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">
                  Description
                </p>
                <p className="whitespace-pre-wrap text-sm text-gray-700">
                  {task.description}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3 border-t border-gray-200 pt-3">
              <div className="flex flex-wrap gap-2">
                {task.status !== "completed" && (
                  <Button
                    size="sm"
                    onClick={() => handleStatusUpdate("completed")}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Complete
                  </Button>
                )}
                {task.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleStatusUpdate("cancelled")}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                )}
              </div>

              {/* Reassign */}
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">
                  Reassign
                </p>
                <div className="flex gap-2">
                  <Select
                    value={reassignAgent}
                    onValueChange={setReassignAgent}
                  >
                    <SelectTrigger className="h-8 w-48 text-xs">
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReassign}
                    disabled={!reassignAgent || actionLoading}
                  >
                    Reassign
                  </Button>
                </div>
              </div>
            </div>

            {/* Javier decision section */}
            {isDecisionTask && task.status !== "completed" && (
              <div className="space-y-3 rounded-lg border-2 border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-semibold text-blue-700">
                  Decision Required
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleJavierDecision("approve")}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleJavierDecision("reject")}
                    disabled={actionLoading}
                  >
                    Reject
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={javierResponse}
                    onChange={(e) => setJavierResponse(e.target.value)}
                    placeholder="Add a response..."
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleJavierRespond}
                    disabled={!javierResponse.trim() || actionLoading}
                  >
                    Respond
                  </Button>
                </div>
              </div>
            )}

            {/* Conversation messages */}
            {task.conv_id && (
              <div className="border-t border-gray-200 pt-3">
                <p className="mb-2 text-xs font-medium text-gray-500">
                  Original Conversation
                </p>
                {loadingMessages ? (
                  <p className="text-xs text-gray-400">Loading messages...</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-gray-400">No messages found.</p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`rounded-md p-2 text-xs ${
                          msg.role === "assistant"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-blue-50 text-blue-900"
                        }`}
                      >
                        <p className="mb-0.5 font-semibold capitalize text-gray-500">
                          {msg.role}
                        </p>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
