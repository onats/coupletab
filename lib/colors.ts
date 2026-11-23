/** Full literal class strings so Tailwind can see them. */
export const UNIT_COLORS = {
  blue: { border: "border-l-blue-600", chip: "bg-blue-600 text-white border-blue-600", soft: "bg-blue-50 text-blue-800 border-blue-200", dot: "bg-blue-600" },
  green: { border: "border-l-emerald-600", chip: "bg-emerald-600 text-white border-emerald-600", soft: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-600" },
  orange: { border: "border-l-orange-600", chip: "bg-orange-600 text-white border-orange-600", soft: "bg-orange-50 text-orange-800 border-orange-200", dot: "bg-orange-600" },
  purple: { border: "border-l-violet-600", chip: "bg-violet-600 text-white border-violet-600", soft: "bg-violet-50 text-violet-800 border-violet-200", dot: "bg-violet-600" },
  pink: { border: "border-l-pink-600", chip: "bg-pink-600 text-white border-pink-600", soft: "bg-pink-50 text-pink-800 border-pink-200", dot: "bg-pink-600" },
  teal: { border: "border-l-teal-600", chip: "bg-teal-600 text-white border-teal-600", soft: "bg-teal-50 text-teal-800 border-teal-200", dot: "bg-teal-600" },
  amber: { border: "border-l-amber-500", chip: "bg-amber-500 text-white border-amber-500", soft: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  slate: { border: "border-l-slate-600", chip: "bg-slate-700 text-white border-slate-700", soft: "bg-slate-100 text-slate-800 border-slate-200", dot: "bg-slate-600" },
} as const;

export type UnitColor = keyof typeof UNIT_COLORS;
export const COLOR_ORDER: UnitColor[] = ["blue", "green", "orange", "purple", "pink", "teal", "amber", "slate"];

export const colorFor = (c: string) => UNIT_COLORS[(c as UnitColor) in UNIT_COLORS ? (c as UnitColor) : "slate"];
export const nextColor = (used: string[]) =>
  COLOR_ORDER.find((c) => !used.includes(c)) ?? COLOR_ORDER[used.length % COLOR_ORDER.length];
