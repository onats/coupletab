"use client";
import { RotateCcw, Save, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { colorFor } from "@/lib/colors";
import type { TripAction } from "@/lib/trip-reducer";
import type { GroupPreset, TripState } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SavedGroupOption {
  id: string;
  name: string;
  units: GroupPreset[];
}

export function GroupBar({
  state,
  dispatch,
  canEdit,
  savedGroups,
  onSaveGroup,
}: {
  state: TripState;
  dispatch: (a: TripAction) => void;
  canEdit: boolean;
  savedGroups?: SavedGroupOption[];
  onSaveGroup?: () => void;
}) {
  const units = [...state.units].sort((a, b) => a.sort - b.sort);
  const hasAssignments = state.assignments.length > 0;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">1. Couples &amp; Singles</h2>
          <p className="text-sm text-slate-500">
            A whole couple counts as <b>1 share</b>. Tap a partner instead when only they had it.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {savedGroups && savedGroups.length > 0 && (
              <select
                aria-label="Load saved group"
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm"
                value=""
                onChange={(e) => {
                  const g = savedGroups.find((x) => x.id === e.target.value);
                  if (!g) return;
                  if (hasAssignments && !window.confirm("Replace the current group? Chip selections for removed people will be cleared.")) return;
                  dispatch({ type: "group/load", preset: g.units, replace: true });
                }}
              >
                <option value="">Load saved group…</option>
                {savedGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
            <Button size="sm" variant="outline" onClick={() => dispatch({ type: "unit/add", kind: "couple" })}>
              <Users className="h-4 w-4" /> Add couple
            </Button>
            <Button size="sm" variant="outline" onClick={() => dispatch({ type: "unit/add", kind: "single" })}>
              <UserPlus className="h-4 w-4" /> Add single
            </Button>
            {onSaveGroup && (
              <Button size="sm" variant="ghost" onClick={onSaveGroup} disabled={!units.length}>
                <Save className="h-4 w-4" /> Save group
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              disabled={!hasAssignments}
              onClick={() => window.confirm("Clear every chip selection on every receipt?") && dispatch({ type: "assign/reset" })}
            >
              <RotateCcw className="h-4 w-4" /> Reset selections
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {units.map((u) => {
          const c = colorFor(u.color);
          const members = state.members.filter((m) => m.unitId === u.id).sort((a, b) => a.sort - b.sort);
          return (
            <div key={u.id} className={cn("rounded-xl border border-l-4 border-slate-200 bg-white p-3", c.border)}>
              <div className="flex items-center gap-2">
                {canEdit ? (
                  <input
                    aria-label="Group name"
                    className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 font-semibold hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                    value={u.name}
                    onChange={(e) => dispatch({ type: "unit/update", id: u.id, patch: { name: e.target.value } })}
                  />
                ) : (
                  <span className="flex-1 px-1 font-semibold">{u.name}</span>
                )}
                {canEdit && (
                  <button
                    aria-label={`Remove ${u.name}`}
                    className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 hover:text-red-600"
                    onClick={() => window.confirm(`Remove ${u.name}? Their chip selections are cleared.`) && dispatch({ type: "unit/remove", id: u.id })}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {u.kind === "couple" ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {members.map((m) => (
                    <Input
                      key={m.id}
                      aria-label="Partner name"
                      value={m.name}
                      disabled={!canEdit}
                      onChange={(e) => dispatch({ type: "member/update", id: m.id, name: e.target.value })}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-2 px-1 text-sm text-slate-500">Single person (1 share)</p>
              )}
              {canEdit && (
                <Input
                  aria-label="PayID or BSB"
                  className="mt-2 h-8 text-xs"
                  placeholder="PayID / BSB + acc (optional, for settling up)"
                  value={u.payid ?? ""}
                  onChange={(e) => dispatch({ type: "unit/update", id: u.id, patch: { payid: e.target.value || null } })}
                />
              )}
            </div>
          );
        })}
        {units.length === 0 && <p className="text-sm text-slate-500">Add the couples and singles at the table to start assigning items.</p>}
      </div>
    </Card>
  );
}
