import { create } from "zustand";

export type ToastVariant = "default" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id"> & { id?: string }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = t.id ?? crypto.randomUUID();
    set((s) => ({
      toasts: [...s.toasts, { ...t, duration: t.duration ?? 4000, id }],
    }));
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  show: (title: string, opts?: Partial<Omit<Toast, "id" | "title">>) =>
    useToastStore.getState().push({
      title,
      variant: opts?.variant ?? "default",
      description: opts?.description,
      duration: opts?.duration ?? 4000,
    }),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "success", duration: 4000 }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "error", duration: 6000 }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "warning", duration: 5000 }),
};
