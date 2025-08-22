import { create } from "zustand";
import React, { useCallback, memo } from "react";

type Toast = { id: string; message: string; };
type ToastStore = {
  toasts: Toast[];
  push: (message: string, ms?: number) => void;
  remove: (id: string) => void;
};

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (message, ms = 3000) => {
    const id = crypto.randomUUID();
    set(s => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => get().remove(id), ms);
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

export function useToast() {
  return useToastStore(s => s.push);
}

// Memoized toast item to prevent unnecessary re-renders
const ToastItem = memo(({ toast }: { toast: Toast }) => (
  <div className="max-w-sm rounded-md bg-gray-900 text-white px-3 py-2 shadow-lg">
    {toast.message}
  </div>
));

ToastItem.displayName = 'ToastItem';

export function Toaster() {
  const toasts = useToastStore(s => s.toasts);
  
  // Only render if there are toasts
  if (toasts.length === 0) return null;
  
  return (
    <div className="fixed z-[100] top-3 right-3 space-y-2">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
