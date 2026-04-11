/**
 * Task Store — Bloque 4 PHASE 1
 *
 * Task board state: tasks, filters, and drag-and-drop state.
 * Fed by Supabase Realtime on the tasks table.
 */

import { create } from "zustand";

import type { Task, TaskFilters, TaskStatus } from "@/types";

interface TaskState {
  tasks: Task[];
  filters: TaskFilters;
  draggedTaskId: string | null;
  loading: boolean;
}

interface TaskActions {
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  moveTask: (id: string, newStatus: TaskStatus) => void;
  setFilters: (filters: Partial<TaskFilters>) => void;
  setDraggedTask: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  getFilteredTasks: () => Task[];
}

export const useTaskStore = create<TaskState & TaskActions>((set, get) => ({
  tasks: [],
  filters: {
    priority: null,
    division: null,
    agentCode: null,
    onlyMine: false,
  },
  draggedTaskId: null,
  loading: false,

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) =>
    set((state) => ({ tasks: [task, ...state.tasks] })),

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      ),
    })),

  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    })),

  moveTask: (id, newStatus) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status: newStatus,
              completed_at:
                newStatus === "completed"
                  ? new Date().toISOString()
                  : t.completed_at,
            }
          : t,
      ),
    })),

  setFilters: (partial) =>
    set((state) => ({
      filters: { ...state.filters, ...partial },
    })),

  setDraggedTask: (id) => set({ draggedTaskId: id }),

  setLoading: (loading) => set({ loading }),

  getFilteredTasks: () => {
    const { tasks, filters } = get();
    return tasks.filter((t) => {
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.agentCode && t.assigned_to_code !== filters.agentCode)
        return false;
      if (filters.onlyMine && !t.assigned_to_javier) return false;
      return true;
    });
  },
}));
