"use client";
import { Workspace } from "@/components/workspace/workspace";
import { useLocalTripStore } from "@/lib/use-trip-store";

export default function LocalTripPage() {
  const store = useLocalTripStore();
  return (
    <Workspace
      store={store}
      role="local"
      scanHint="Demo mode: receipts and splits are stored only in this browser."
      topSlot={
        store.state && store.state.receipts.length > 0 ? (
          <div className="flex justify-end">
            <button
              className="text-xs text-slate-500 hover:text-red-600"
              onClick={() => {
                if (!window.confirm("Start over? This clears every receipt and person in this browser.")) return;
                localStorage.removeItem("coupletab:local-trip:v1");
                window.location.reload();
              }}
            >
              Start a new tab
            </button>
          </div>
        ) : null
      }
    />
  );
}
