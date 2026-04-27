import PropTypes from "prop-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Shared filter / sort primitives ────────────────────────────────
//
// The Podcasts (Discover) screen had the right look for these
// affordances all along — small pill-shaped triggers, low-saturation
// fills, hairline borders, and a uniform 32px height that lines up
// with the surrounding chips and counters. The Library tabs
// (Following / Favorites / History) had drifted to a heavier
// `bg-gray-800 border-gray-700` style that felt like a different
// design system. These primitives lift the Discover styling into one
// place so every browsing surface in the app picks up the same look
// for free.
//
// Discover still owns its in-page wrappers (it composes additional
// layout concerns like the access-pill row), so it consumes
// `FilterDropdown` / `FilterPill` directly from here for the trigger
// class only — the markup tree there is unchanged.

const SELECT_TRIGGER_CLASS =
  "h-8 w-auto min-w-[7rem] gap-1.5 rounded-full border-white/[0.06] bg-white/[0.03] px-3.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.06] hover:border-white/[0.1] hover:text-white focus:ring-0 focus:ring-offset-0 transition-all duration-300 data-[placeholder]:text-zinc-500 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-zinc-500";

const SELECT_CONTENT_CLASS =
  "border-white/[0.08] bg-[#18181f] shadow-xl shadow-black/40 rounded-lg";

const SELECT_ITEM_CLASS =
  "text-xs text-zinc-400 focus:bg-white/[0.06] focus:text-white rounded-md cursor-pointer";

export const filterTriggerClass = SELECT_TRIGGER_CLASS;
export const filterContentClass = SELECT_CONTENT_CLASS;
export const filterItemClass = SELECT_ITEM_CLASS;

/**
 * Pill-shaped Select used for filter / sort dropdowns app-wide.
 *
 * Pass either a flat `options` array of `{ value, label }` or compose
 * the children manually for advanced cases (option groups, dividers,
 * etc.). When `options` is supplied we render them in order.
 */
export function FilterDropdown({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  minWidthClass,
}) {
  const triggerClass = `${SELECT_TRIGGER_CLASS} ${minWidthClass || ""} ${className}`.trim();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={triggerClass}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={SELECT_CONTENT_CLASS}>
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className={SELECT_ITEM_CLASS}
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

FilterDropdown.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
    }),
  ).isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  minWidthClass: PropTypes.string,
};

/**
 * Tiny segmented pill — used for binary or 3-way filter rows like
 * "All / Free / Members". Single-purpose so consumers compose them
 * inline next to FilterDropdowns.
 */
export function FilterPill({ label, active, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3.5 rounded-full text-xs font-medium transition-all duration-300 border ${
        active
          ? "bg-white/[0.08] border-white/[0.12] text-white"
          : "bg-white/[0.02] border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] hover:border-white/[0.08]"
      } ${className}`}
    >
      {label}
    </button>
  );
}

FilterPill.propTypes = {
  label: PropTypes.node.isRequired,
  active: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  className: PropTypes.string,
};
