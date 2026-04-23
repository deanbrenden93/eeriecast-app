import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown } from 'lucide-react';

/*
 * DateOfBirthPicker
 *
 * A separated Month / Day / Year control that avoids the native
 * <input type="date"> widget — which older users tend to find confusing
 * because of its heavy scroll-wheel / compact popover UI.
 *
 * - Month: custom dropdown with month names (Jan–Dec), styled to match Year
 * - Day:   custom dropdown clamped to the valid number of days for the
 *          currently selected month/year (handles leap years too)
 * - Year:  custom combobox — users can either click and pick from the
 *          dropdown OR start typing and the list auto-filters / auto-scrolls
 *          to the nearest matching year. Range is (currentYear - 120)
 *          through currentYear, newest first so mobile users don't have
 *          to scroll 120 items to reach a reasonable decade.
 *
 * Emits ISO (YYYY-MM-DD) via `onChange` when all three parts form a real
 * calendar date, otherwise emits `null`. The caller is responsible for any
 * higher-level age validation (e.g. minimum age checks).
 */

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

function daysInMonth(month, year) {
  if (!month) return 31;
  if (!year) {
    // Without a year, assume 29 for Feb so the user isn't blocked from
    // picking the 29th of a future-year; we'll re-validate once the year
    // fills in.
    if (month === 2) return 29;
  }
  return new Date(year || 2000, month, 0).getDate();
}

function toIso(y, m, d) {
  if (!y || !m || !d) return null;
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function parseIso(iso) {
  if (!iso || typeof iso !== 'string') return { year: '', month: '', day: '' };
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return { year: '', month: '', day: '' };
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

// Shared Tailwind classes for all three controls so they line up and share
// the same dark-mode combobox look. Exported-in-scope so the `StyledSelect`
// helper below can reuse it verbatim.
const CONTROL_CLASS =
  'h-11 w-full bg-white/[0.03] border border-white/[0.08] text-white ' +
  'rounded-lg px-3 text-sm transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/40 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

/*
 * StyledSelect
 *
 * Small internal helper — a button-triggered dropdown with the exact same
 * panel styling as the Year combobox. Keeps Month and Day visually
 * consistent with Year, which the native <select> popovers can't match
 * because browsers render them with OS chrome.
 */
function StyledSelect({
  ariaLabel,
  placeholder,
  value,
  options, // [{ value, label }]
  onChange,
  disabled = false,
  required = false,
  listId,
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const buttonRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  );

  // Seed the active row to the current selection whenever we open, so
  // arrow-key navigation starts from a sensible place.
  useEffect(() => {
    if (!open) return;
    const idx = value
      ? options.findIndex((o) => o.value === value)
      : 0;
    setActiveIdx(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!open || activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx, open]);

  const commit = (v) => {
    onChange(v);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIdx((idx) => Math.min((idx < 0 ? -1 : idx) + 1, options.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIdx((idx) => Math.max((idx < 0 ? options.length : idx) - 1, 0));
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (activeIdx >= 0 && options[activeIdx]) {
        commit(options[activeIdx].value);
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-required={required}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        className={`${CONTROL_CLASS} pr-9 flex items-center justify-between text-left`}
      >
        <span className={selectedOption ? 'text-white' : 'text-zinc-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && options.length > 0 && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 left-0 right-0 max-h-56 overflow-y-auto rounded-lg border border-white/[0.08] bg-[#11101a] shadow-2xl py-1 focus:outline-none"
        >
          {options.map((opt, idx) => {
            const selected = value === opt.value;
            const active = idx === activeIdx;
            return (
              <li
                key={opt.value}
                data-idx={idx}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(opt.value);
                }}
                className={`px-3 py-1.5 text-sm cursor-pointer select-none ${
                  active
                    ? 'bg-red-600/20 text-white'
                    : selected
                      ? 'text-red-300'
                      : 'text-zinc-300 hover:text-white'
                }`}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

StyledSelect.propTypes = {
  ariaLabel: PropTypes.string.isRequired,
  placeholder: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  listId: PropTypes.string,
};

export default function DateOfBirthPicker({
  value,
  onChange,
  maxYearsBack = 120,
  disabled = false,
  id,
  required = false,
  className = '',
}) {
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - maxYearsBack;

  const parsed = useMemo(() => parseIso(value), [value]);
  const [month, setMonth] = useState(parsed.month || '');
  const [day, setDay] = useState(parsed.day || '');
  const [year, setYear] = useState(parsed.year || '');
  const [yearInput, setYearInput] = useState(parsed.year ? String(parsed.year) : '');

  // Keep internal state synced when the caller changes `value` externally
  // (e.g. form reset after successful submit).
  useEffect(() => {
    const next = parseIso(value);
    setMonth(next.month || '');
    setDay(next.day || '');
    setYear(next.year || '');
    setYearInput(next.year ? String(next.year) : '');
  }, [value]);

  // When month or year changes, clamp day down if it's now invalid
  // (e.g. switching from Jan to Feb while day is 31).
  useEffect(() => {
    if (!day) return;
    const cap = daysInMonth(Number(month) || null, Number(year) || null);
    if (Number(day) > cap) {
      setDay(cap);
    }
  }, [month, year, day]);

  // Notify parent whenever we have a complete, real date.
  const prevIsoRef = useRef(null);
  useEffect(() => {
    const y = Number(year) || null;
    const m = Number(month) || null;
    const d = Number(day) || null;
    let iso = null;
    if (y && m && d) {
      // Validate the date actually exists (e.g. not Feb 30)
      const test = new Date(y, m - 1, d);
      if (
        test.getFullYear() === y &&
        test.getMonth() === m - 1 &&
        test.getDate() === d
      ) {
        iso = toIso(y, m, d);
      }
    }
    if (prevIsoRef.current !== iso) {
      prevIsoRef.current = iso;
      onChange?.(iso);
    }
  }, [year, month, day, onChange]);

  const monthOptions = useMemo(
    () => MONTHS.map((m) => ({ value: m.value, label: m.label })),
    []
  );

  const dayOptions = useMemo(() => {
    const cap = daysInMonth(Number(month) || null, Number(year) || null);
    return Array.from({ length: cap }, (_, i) => ({
      value: i + 1,
      label: String(i + 1),
    }));
  }, [month, year]);

  // Newest first so the typical case (adults born in the last 70 years)
  // is near the top of the dropdown.
  const yearOptions = useMemo(() => {
    const list = [];
    for (let y = currentYear; y >= minYear; y--) list.push(y);
    return list;
  }, [currentYear, minYear]);

  // ── Year combobox internals ─────────────────────────────────────────
  const [yearOpen, setYearOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const yearInputRef = useRef(null);
  const yearListRef = useRef(null);
  const yearContainerRef = useRef(null);

  // Filter the dropdown by what the user has typed so far (startsWith
  // match, then fall back to substring). If input is empty show all years.
  const filteredYears = useMemo(() => {
    const q = yearInput.trim();
    if (!q) return yearOptions;
    const starts = yearOptions.filter((y) => String(y).startsWith(q));
    if (starts.length > 0) return starts;
    return yearOptions.filter((y) => String(y).includes(q));
  }, [yearInput, yearOptions]);

  // Whenever the filter changes, reset the active index to the nearest
  // match (first item) so Enter picks something sensible.
  useEffect(() => {
    if (!yearOpen) return;
    setActiveIdx(filteredYears.length > 0 ? 0 : -1);
  }, [filteredYears, yearOpen]);

  // Close on outside click
  useEffect(() => {
    if (!yearOpen) return undefined;
    const handler = (e) => {
      if (yearContainerRef.current && !yearContainerRef.current.contains(e.target)) {
        setYearOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [yearOpen]);

  // Keep the active row scrolled into view
  useEffect(() => {
    if (!yearOpen || activeIdx < 0 || !yearListRef.current) return;
    const el = yearListRef.current.querySelector(`[data-idx="${activeIdx}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx, yearOpen]);

  const commitYear = useCallback((y) => {
    if (!y || y < minYear || y > currentYear) {
      // Invalid → leave the raw input but don't commit to the upstream
      // value. Clearing `year` flips the picker into "incomplete" state.
      setYear('');
      return;
    }
    setYear(y);
    setYearInput(String(y));
    setYearOpen(false);
  }, [minYear, currentYear]);

  const handleYearKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!yearOpen) setYearOpen(true);
      setActiveIdx((idx) => Math.min((idx < 0 ? -1 : idx) + 1, filteredYears.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!yearOpen) setYearOpen(true);
      setActiveIdx((idx) => Math.max((idx < 0 ? filteredYears.length : idx) - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      if (yearOpen && activeIdx >= 0 && filteredYears[activeIdx] != null) {
        e.preventDefault();
        commitYear(filteredYears[activeIdx]);
      }
      return;
    }
    if (e.key === 'Escape') {
      setYearOpen(false);
      return;
    }
    if (e.key === 'Tab') {
      // On Tab, commit whatever the typed input matches most closely.
      const typed = Number(yearInput);
      if (Number.isFinite(typed) && typed >= minYear && typed <= currentYear) {
        commitYear(typed);
      } else if (filteredYears.length > 0) {
        // Fall back to first filtered match
        commitYear(filteredYears[0]);
      }
      setYearOpen(false);
    }
  };

  return (
    <div
      id={id}
      className={`grid grid-cols-[1.2fr,0.8fr,1fr] gap-2 ${className}`}
      aria-disabled={disabled}
    >
      {/* Month — styled dropdown matching the Year combobox */}
      <StyledSelect
        ariaLabel="Month of birth"
        placeholder="Month"
        value={month || ''}
        options={monthOptions}
        onChange={(v) => setMonth(v ? Number(v) : '')}
        disabled={disabled}
        required={required}
        listId={id ? `${id}-month-listbox` : undefined}
      />

      {/* Day — styled dropdown matching the Year combobox */}
      <StyledSelect
        ariaLabel="Day of birth"
        placeholder="Day"
        value={day || ''}
        options={dayOptions}
        onChange={(v) => setDay(v ? Number(v) : '')}
        disabled={disabled}
        required={required}
        listId={id ? `${id}-day-listbox` : undefined}
      />

      {/* Year combobox (type OR click) */}
      <div ref={yearContainerRef} className="relative">
        <input
          ref={yearInputRef}
          type="text"
          inputMode="numeric"
          autoComplete="bday-year"
          aria-label="Year of birth"
          aria-expanded={yearOpen}
          aria-controls={id ? `${id}-year-listbox` : undefined}
          role="combobox"
          placeholder="Year"
          required={required}
          disabled={disabled}
          value={yearInput}
          onFocus={() => setYearOpen(true)}
          onClick={() => setYearOpen(true)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
            setYearInput(raw);
            setYearOpen(true);
            // Clear committed year until the input forms a valid year
            const n = Number(raw);
            if (Number.isFinite(n) && raw.length === 4 && n >= minYear && n <= currentYear) {
              setYear(n);
            } else if (year) {
              setYear('');
            }
          }}
          onKeyDown={handleYearKeyDown}
          onBlur={() => {
            // Commit if the typed value is a valid year; otherwise clear.
            const n = Number(yearInput);
            if (Number.isFinite(n) && yearInput.length === 4 && n >= minYear && n <= currentYear) {
              setYear(n);
            } else if (yearInput.length === 0) {
              setYear('');
            } else {
              // Partial / invalid year typed — snap back to last committed
              setYearInput(year ? String(year) : '');
            }
          }}
          className={`${CONTROL_CLASS} pr-9`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={yearOpen ? 'Close year list' : 'Open year list'}
          disabled={disabled}
          onMouseDown={(e) => {
            // Prevent input blur on mousedown so the click reliably toggles
            e.preventDefault();
            if (disabled) return;
            setYearOpen((v) => !v);
            yearInputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${yearOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {yearOpen && filteredYears.length > 0 && (
          <ul
            ref={yearListRef}
            id={id ? `${id}-year-listbox` : undefined}
            role="listbox"
            className="absolute z-50 mt-1 left-0 right-0 max-h-56 overflow-y-auto rounded-lg border border-white/[0.08] bg-[#11101a] shadow-2xl py-1 focus:outline-none"
          >
            {filteredYears.map((y, idx) => {
              const selected = year === y;
              const active = idx === activeIdx;
              return (
                <li
                  key={y}
                  data-idx={idx}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseDown={(e) => {
                    // Avoid the input blur handler before our click fires.
                    e.preventDefault();
                    commitYear(y);
                  }}
                  className={`px-3 py-1.5 text-sm cursor-pointer select-none ${
                    active
                      ? 'bg-red-600/20 text-white'
                      : selected
                        ? 'text-red-300'
                        : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  {y}
                </li>
              );
            })}
          </ul>
        )}

        {yearOpen && filteredYears.length === 0 && (
          <div className="absolute z-50 mt-1 left-0 right-0 rounded-lg border border-white/[0.08] bg-[#11101a] shadow-2xl px-3 py-2 text-xs text-zinc-500">
            No matching year in range {minYear}–{currentYear}
          </div>
        )}
      </div>
    </div>
  );
}

DateOfBirthPicker.propTypes = {
  value: PropTypes.string, // ISO YYYY-MM-DD or null
  onChange: PropTypes.func.isRequired,
  maxYearsBack: PropTypes.number,
  disabled: PropTypes.bool,
  id: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
};
