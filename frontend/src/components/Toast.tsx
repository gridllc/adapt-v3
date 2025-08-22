import { create } from "zustand";
import React, { useEffect } from "react";

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

export function Toaster() {
  const toasts = useToastStore(s => s.toasts);
  return (
    <div className="fixed z-[100] top-3 right-3 space-y-2">
      {toasts.map(t => (
        <div key={t.id}
          className="max-w-sm rounded-md bg-gray-900 text-white px-3 py-2 shadow-lg">
          {t.message}
        </div>
      ))}
    </div>
  );
}
