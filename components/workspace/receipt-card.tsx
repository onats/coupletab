"use client";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Image as ImageIcon, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { colorFor } from "@/lib/colors";
import { money, round2 } from "@/lib/money";
import type { ReceiptSummary } from "@/lib/split";
import type { TripAction } from "@/lib/trip-reducer";
import type { Assignment, LineItem, Member, Receipt, Unit } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOC_LABEL: Record<Receipt["docType"], string> = {
  itemised_receipt: "Receipt",
  guest_bill: "Guest bill",
  tax_invoice: "Tax invoice",
  payment_slip: "Card slip",
  other: "Document",
};

function formatWhen(s: string | null) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const hasTime = /T\d{2}:\d{2}/.test(s);
  return d.toLocaleString("en-AU", hasTime ? { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" });
}

export function ReceiptCard({
  receipt,
  items,
  units,
  members,
  assignments,
  summary,
  dispatch,
  canEdit,
  onViewPhoto,
}: {
  receipt: Receipt;
  items: LineItem[];
  units: Unit[];
  members: Member[];
  assignments: Assignment[];
  summary: ReceiptSummary | undefined;
  dispatch: (a: TripAction) => void;
  canEdit: boolean;
  onViewPhoto?: (path: string) => void;
}) {
  const [open, setOpen] = useState(!receipt.isDuplicate);
  const [newItem, setNewItem] = useState<{ label: string; price: string } | null>(null);
  const ratePct = round2(receipt.surchargeRate * 100);
  const byItem = new Map<string, Assignment[]>();
  for (const a of assignments) byItem.set(a.lineItemId, [...(byItem.get(a.lineItemId) ?? []), a]);
  const unassignedItems = items.filter((i) => !(byItem.get(i.id)?.length));
  const when = formatWhen(receipt.dateTime);

  const meta = [
    DOC_LABEL[receipt.docType],
    receipt.receiptNumber && `#${receipt.receiptNumber}${receipt.referenceNumbers.length ? ` / #${receipt.referenceNumbers.join(" / #")}` : ""}`,
    when,
    receipt.surchargeLabel,
    summary && `Subtotal ${money(summary.itemsSubtotal)} → Total ${money(summary.total)}`,
  ].filter(Boolean);

  return (
    <Card className={cn("overflow-hidden", receipt.isDuplicate && "opacity-80")}>
      <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex items-start gap-2">
          <button aria-label={open ? "Collapse" : "Expand"} className="mt-1 text-slate-500" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
          <div className="min-w-0 flex-1">
            {canEdit ? (
              <input
                aria-label="Venue name"
                className="w-full rounded bg-transparent px-1 text-lg font-semibold hover:bg-white focus:bg-white focus:outline-none"
                value={receipt.venueName}
                onChange={(e) => dispatch({ type: "receipt/update", id: receipt.id, patch: { venueName: e.target.value } })}
              />
            ) : (
              <h3 className="px-1 text-lg font-semibold">{receipt.venueName}</h3>
            )}
            <p className="px-1 text-sm text-slate-500">{meta.join(" • ")}</p>
          </div>
          <div className="text-right">
            <div className="tabular text-lg font-bold">{money(summary?.total ?? 0)}</div>
            {summary && summary.unassignedCount > 0 && <div className="text-xs text-amber-700">{summary.unassignedCount} unassigned</div>}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
          <SurchargeBadge rate={ratePct} canEdit={canEdit} onChange={(pct) => dispatch({ type: "receipt/update", id: receipt.id, patch: { surchargeRate: Math.max(0, Math.min(pct, 100)) / 100 } })} />
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-slate-500">Paid by</span>
            <select
              className={cn("h-8 rounded-lg border bg-white px-2 text-sm", !receipt.paidByUnitId && !receipt.isDuplicate ? "border-amber-400" : "border-slate-300")}
              value={receipt.paidByUnitId ?? ""}
              disabled={!canEdit}
              onChange={(e) => dispatch({ type: "receipt/update", id: receipt.id, patch: { paidByUnitId: e.target.value || null } })}
            >
              <option value="">Who paid?</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          {receipt.storagePath && onViewPhoto && (
            <Button size="sm" variant="ghost" onClick={() => onViewPhoto(receipt.storagePath!)}>
              <ImageIcon className="h-4 w-4" /> Photo
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-slate-500 hover:text-red-600"
              onClick={() => window.confirm(`Delete ${receipt.venueName} and its items?`) && dispatch({ type: "receipt/remove", id: receipt.id })}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>

        {receipt.isDuplicate && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <span className="flex-1">
              Looks like a duplicate ({receipt.duplicateReason ?? "same bill"}). It&apos;s left out of the totals.
            </span>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => dispatch({ type: "receipt/update", id: receipt.id, patch: { isDuplicate: false, duplicateOfId: null, duplicateReason: null } })}>
                It&apos;s not a duplicate
              </Button>
            )}
          </div>
        )}
        {!receipt.isDuplicate && summary?.totalMismatch != null && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Items + surcharge come to {money(summary.total)} but the receipt says {money(receipt.grandTotal ?? 0)} ({summary.totalMismatch > 0 ? "+" : ""}
              {money(summary.totalMismatch)}). Check for a missed item or a wrong price.
            </span>
          </div>
        )}
      </div>

      {open && (
        <div>
          {canEdit && unassignedItems.length > 1 && units.length > 0 && (
            <div className="flex justify-end border-b border-slate-100 px-4 py-2">
              <Button size="sm" variant="ghost" onClick={() => unassignedItems.forEach((i) => dispatch({ type: "assign/all", lineItemId: i.id }))}>
                <Wand2 className="h-4 w-4" /> Split all {unassignedItems.length} unassigned items evenly
              </Button>
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                units={units}
                members={members}
                assigned={byItem.get(item.id) ?? []}
                dispatch={dispatch}
                canEdit={canEdit}
                disabled={receipt.isDuplicate}
              />
            ))}
            {items.length === 0 && <li className="p-4 text-sm text-slate-500">No items yet.</li>}
          </ul>
          {canEdit && (
            <div className="border-t border-slate-100 p-3">
              {newItem ? (
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const price = Number(newItem.price);
                    if (!newItem.label.trim() || !Number.isFinite(price)) return;
                    dispatch({ type: "item/add", receiptId: receipt.id, label: newItem.label.trim(), price: round2(price) });
                    setNewItem({ label: "", price: "" });
                  }}
                >
                  <Input autoFocus className="flex-1" placeholder="Item" value={newItem.label} onChange={(e) => setNewItem({ ...newItem, label: e.target.value })} />
                  <Input className="w-28" inputMode="decimal" placeholder="0.00" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} />
                  <Button type="submit" size="md">
                    Add
                  </Button>
                  <Button size="md" variant="ghost" onClick={() => setNewItem(null)}>
                    Done
                  </Button>
                </form>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setNewItem({ label: "", price: "" })}>
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function SurchargeBadge({ rate, canEdit, onChange }: { rate: number; canEdit: boolean; onChange: (pct: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(rate));
  const cls = rate > 0 ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-600";
  if (editing)
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(val);
          if (Number.isFinite(n)) onChange(n);
          setEditing(false);
        }}
      >
        <Input autoFocus className="h-8 w-20" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} />
        <span className="text-sm">%</span>
        <Button type="submit" size="icon" variant="outline" aria-label="Save surcharge">
          <Check className="h-4 w-4" />
        </Button>
      </form>
    );
  return (
    <Badge className={cn(cls, "py-1 text-sm", canEdit && "cursor-pointer hover:brightness-95")} onClick={() => canEdit && (setVal(String(rate)), setEditing(true))}>
      {rate > 0 ? `+${rate}% surcharge` : "0% surcharge"}
      {canEdit && <Pencil className="h-3 w-3 opacity-60" />}
    </Badge>
  );
}

const ItemRow = memo(function ItemRow({
  item,
  units,
  members,
  assigned,
  dispatch,
  canEdit,
  disabled,
}: {
  item: LineItem;
  units: Unit[];
  members: Member[];
  assigned: Assignment[];
  dispatch: (a: TripAction) => void;
  canEdit: boolean;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [price, setPrice] = useState(item.price.toFixed(2));
  const isOn = (t: "unit" | "member", id: string) => assigned.some((a) => a.targetType === t && a.targetId === id);
  const allOn = units.length > 0 && units.every((u) => isOn("unit", u.id)) && assigned.length === units.length;
  const shares = assigned.length;
  const toggle = (targetType: "unit" | "member", targetId: string) => dispatch({ type: "assign/toggle", lineItemId: item.id, targetType, targetId });

  return (
    <li className={cn("px-4 py-3 sm:px-5", shares === 0 && !disabled && "bg-amber-50/40")}>
      <div className="flex items-start justify-between gap-3">
        {editing ? (
          <form
            className="flex flex-1 flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const p = Number(price);
              if (!label.trim() || !Number.isFinite(p)) return;
              dispatch({ type: "item/update", id: item.id, patch: { label: label.trim(), price: round2(p) } });
              setEditing(false);
            }}
          >
            <Input autoFocus className="flex-1" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input className="w-24" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            <Button type="submit" size="md">
              Save
            </Button>
            <Button size="md" variant="ghost" className="text-red-600" onClick={() => dispatch({ type: "item/remove", id: item.id })}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-medium">{item.label}</span>
            {item.sourceLabel && <span className="text-xs text-slate-400">({item.sourceLabel})</span>}
            {shares === 0 && !disabled && <Badge className="border-amber-200 bg-amber-100 text-amber-800">Unassigned</Badge>}
            {shares > 1 && <Badge className="border-slate-200 bg-slate-100 text-slate-600">÷ {shares}</Badge>}
            {canEdit && (
              <button
                aria-label="Edit item"
                className="text-slate-400 hover:text-slate-700"
                onClick={() => {
                  setLabel(item.label);
                  setPrice(item.price.toFixed(2));
                  setEditing(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        {!editing && <span className={cn("tabular shrink-0 font-semibold", item.price < 0 && "text-emerald-700")}>{money(item.price)}</span>}
      </div>

      {!disabled && (
        <div className="mt-2 flex flex-wrap gap-2">
          {units.map((u) => {
            const c = colorFor(u.color);
            const ms = members.filter((m) => m.unitId === u.id).sort((a, b) => a.sort - b.sort);
            const wholeOn = isOn("unit", u.id);
            return (
              <div key={u.id} className="flex overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
                <Chip on={wholeOn} cls={c.chip} onClick={() => toggle("unit", u.id)}>
                  {u.kind === "couple" ? `${u.name} (Whole)` : u.name}
                </Chip>
                {u.kind === "couple" &&
                  ms.map((m) => (
                    <Chip key={m.id} on={isOn("member", m.id)} cls={c.chip} onClick={() => toggle("member", m.id)} divider>
                      {m.name}
                    </Chip>
                  ))}
              </div>
            );
          })}
          {units.length > 1 && (
            <button
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                allOn ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
              )}
              aria-pressed={allOn}
              onClick={() => dispatch({ type: "assign/all", lineItemId: item.id })}
            >
              All units
            </button>
          )}
        </div>
      )}
    </li>
  );
});

function Chip({ on, cls, onClick, children, divider }: { on: boolean; cls: string; onClick: () => void; children: React.ReactNode; divider?: boolean }) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-9 px-3 py-1.5 font-medium transition-colors select-none",
        divider && "border-l border-slate-200",
        on ? cls : "text-slate-700 hover:bg-slate-50 active:bg-slate-100",
      )}
    >
      {children}
    </button>
  );
}
