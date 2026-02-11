import React from "react";
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Settings,
  Lock,
  Minus,
  Plus,
  List,
  Bookmark,
  BookmarkPlus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FREE_READ_CHAPTER_LIMIT, canAccessChapter } from "@/lib/freeTier";

/* ═══════════════════════════════════════════════════════════════════
   E-Reader — immersive full-screen paginated reader
   Uses CSS multi-column layout to flow text into discrete pages,
   with the column-width set to exact measured pixels.
   ═══════════════════════════════════════════════════════════════════ */

const FONT_SIZE_MIN = 14;
const FONT_SIZE_MAX = 26;
const FONT_SIZE_STEP = 2;
const LINE_HEIGHT_OPTIONS = [
  { label: "Tight", value: 1.6 },
  { label: "Normal", value: 1.8 },
  { label: "Relaxed", value: 2.0 },
];
const FONT_OPTIONS = [
  { label: "Sans", value: "'DM Sans', system-ui, -apple-system, sans-serif" },
  { label: "Serif", value: "'Georgia', 'Times New Roman', serif" },
  { label: "Mono", value: "'DM Mono', 'Roboto Mono', 'Courier New', monospace" },
];
const COLUMN_GAP = 60;

/**
 * Render chapter text with:
 *  - `---` scene-break markers → elegant ornamental dividers
 *  - Paragraphs formatted like a professional novel (no gap, indent instead)
 */
function renderContent(text) {
  if (!text) return null;

  // Split on scene breaks first
  const scenes = text.split(/\n---\n/);

  return scenes.map((scene, si) => {
    // Split scene into paragraphs (double newline)
    const paragraphs = scene.split(/\n\n+/).filter(p => p.trim());

    return (
      <React.Fragment key={si}>
        {paragraphs.map((p, pi) => (
          <p key={pi} className={pi > 0 ? "ereader-para-indent" : "ereader-para-first"}>
            {p.trim()}
          </p>
        ))}
        {si < scenes.length - 1 && (
          <span className="ereader-scene-break block my-4 flex items-center justify-center gap-3" aria-hidden="true">
            <span className="block w-8 h-px bg-zinc-700" />
            <span className="block w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <span className="block w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <span className="block w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <span className="block w-8 h-px bg-zinc-700" />
          </span>
        )}
      </React.Fragment>
    );
  });
}

/* ── localStorage helpers ────────────────────────────────────────── */
function loadSettings(bookId) {
  try { const r = localStorage.getItem(`ereader-settings-${bookId}`); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveSettings(bookId, s) {
  try { localStorage.setItem(`ereader-settings-${bookId}`, JSON.stringify(s)); } catch { /* */ }
}
function loadProgress(bookId) {
  try { const r = localStorage.getItem(`ereader-progress-${bookId}`); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveProgress(bookId, p) {
  try { localStorage.setItem(`ereader-progress-${bookId}`, JSON.stringify(p)); } catch { /* */ }
}
function loadBookmarks(bookId) {
  try { const r = localStorage.getItem(`ereader-bookmarks-${bookId}`); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveBookmarks(bookId, b) {
  try { localStorage.setItem(`ereader-bookmarks-${bookId}`, JSON.stringify(b)); } catch { /* */ }
}

export default function EReader({ book, isPremium, onClose, onSubscribe }) {
  /* ─── State ──────────────────────────────────────────────── */
  const [chapterIdx, setChapterIdx] = useState(0);
  const saved = useMemo(() => loadSettings(book?.id), [book?.id]);
  const [fontSize, setFontSize] = useState(saved?.fontSize ?? 18);
  const [lineHeight, setLineHeight] = useState(saved?.lineHeight ?? 1.8);
  const [fontFamily, setFontFamily] = useState(saved?.fontFamily ?? FONT_OPTIONS[0].value);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [tocTab, setTocTab] = useState("contents"); // 'contents' | 'bookmarks'

  // Pagination state
  const [pageIndex, setPageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);

  // Bookmarks — up to 10 per book, each stores { chapter, page, label }
  const [bookmarks, setBookmarks] = useState(() => loadBookmarks(book?.id));

  const pagerRef = useRef(null);
  const columnsRef = useRef(null);
  const settingsRef = useRef(null);
  const tocRef = useRef(null);
  const tocBtnRef = useRef(null);
  const settingsBtnRef = useRef(null);
  const restoredRef = useRef(false); // prevent double-restore
  const readingOffsetRef = useRef(0);     // frozen fraction (0..1) of chapter progress
  const isSettingsChangeRef = useRef(false);
  const settingsTimerRef = useRef(null);

  // Chapter-crossing transition: fade+slide the reading area
  const [chapterFade, setChapterFade] = useState(null); // 'forward' | 'backward' | null
  const pendingChapterRef = useRef(null);
  const suppressColumnTransition = useRef(false); // kill column transition during invisible swap

  const chapter = book?.chapters?.[chapterIdx];
  const totalChapters = book?.chapters?.length || 0;

  /* ─── Measure container & compute page count ─────────────── */
  const measurePages = useCallback(() => {
    const wrapper = pagerRef.current;
    const el = columnsRef.current;
    if (!wrapper || !el) return;

    // Use getBoundingClientRect for sub-pixel precision.
    // clientWidth rounds to an integer, which causes cumulative drift
    // in the translateX offset — each page is off by ~0.5px, and by
    // page 15-17 the text visibly clips on the right edge.
    const w = wrapper.getBoundingClientRect().width;
    setContainerWidth(w);

    // Reset to natural (single-viewport) width so overflow:hidden
    // creates a scroll context and scrollWidth reports the true total.
    el.style.width = "";

    // Reading scrollWidth forces a synchronous reflow — the browser
    // computes column layout immediately based on the current inline
    // styles (fontSize, lineHeight, fontFamily, columnWidth).
    // No requestAnimationFrame needed; doing everything synchronously
    // ensures the width reset → measure → expand cycle all happens in
    // a single task, so the browser never paints the collapsed state.
    const sw = el.scrollWidth;
    const pages = Math.max(1, Math.round(sw / (w + COLUMN_GAP)));

    // Expand the container to fit ALL columns so overflow:hidden
    // no longer clips them. The parent (pagerRef) acts as the viewport.
    if (pages > 1 && w > 0) {
      const totalWidth = pages * w + (pages - 1) * COLUMN_GAP;
      el.style.width = `${totalWidth}px`;
    }

    setTotalPages(pages);

    // If a settings change is in progress, compute the correct page
    // synchronously so React can batch it with the totalPages update.
    if (isSettingsChangeRef.current) {
      const newPage = Math.round(readingOffsetRef.current * pages);
      setPageIndex(Math.max(0, Math.min(newPage, pages - 1)));
    }
  }, []);

  // Measure on mount, chapter/font changes, and resize.
  // useLayoutEffect runs BEFORE the browser paints, so the correct
  // page position is computed and committed in the same frame as the
  // font/layout change — the user never sees an intermediate state.
  useLayoutEffect(() => {
    measurePages();
    const onResize = () => measurePages();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measurePages, chapterIdx, fontSize, lineHeight, fontFamily]);

  // Re-measure after fonts load and after layout settles (defensive).
  // This stays as useEffect — it fires after paint, but since the
  // initial measurement above is accurate for settings changes,
  // these are mainly to handle font-loading edge cases on first open.
  useEffect(() => {
    const t1 = setTimeout(measurePages, 50);
    const t2 = setTimeout(measurePages, 200);
    const t3 = setTimeout(measurePages, 600);
    document.fonts?.ready?.then(() => setTimeout(measurePages, 50));
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [measurePages, chapterIdx, fontSize, lineHeight, fontFamily]);

  /* ─── Restore saved chapter + page on mount ──────────────── */
  useEffect(() => {
    if (!book?.id || restoredRef.current) return;
    const prog = loadProgress(book.id);
    if (prog && typeof prog.chapter === "number" && prog.chapter < totalChapters) {
      // Clamp to last accessible chapter if user is no longer premium
      const targetCh = canAccessChapter(prog.chapter, isPremium, FREE_READ_CHAPTER_LIMIT)
        ? prog.chapter
        : Math.max(0, FREE_READ_CHAPTER_LIMIT - 1);
      setChapterIdx(targetCh);
      if (targetCh === prog.chapter && typeof prog.page === "number" && prog.page > 0) {
        // Defer until pages are measured
        const t = setTimeout(() => setPageIndex(prog.page), 700);
        restoredRef.current = true;
        return () => clearTimeout(t);
      }
    }
    restoredRef.current = true;
  }, [book?.id, totalChapters, isPremium]);

  /* ─── Persist settings ───────────────────────────────────── */
  useEffect(() => {
    if (book?.id) saveSettings(book.id, { fontSize, lineHeight, fontFamily });
  }, [book?.id, fontSize, lineHeight, fontFamily]);

  /* ─── Persist progress ───────────────────────────────────── */
  useEffect(() => {
    if (book?.id) saveProgress(book.id, { chapter: chapterIdx, page: pageIndex });
  }, [book?.id, chapterIdx, pageIndex]);

  /* ─── Track reading position as a stable fraction ────────── */
  // Updated only during normal navigation (page turns, chapter jumps,
  // bookmarks). NOT updated after settings-triggered page changes,
  // so "font+ 3 times then font- 3 times" returns to the exact same page.
  useEffect(() => {
    if (!isSettingsChangeRef.current && totalPages > 0) {
      readingOffsetRef.current = pageIndex / totalPages;
    }
  }, [pageIndex, totalPages]);

  /* ─── Freeze reading position before a settings change ──── */
  const captureReadingPosition = useCallback(() => {
    // Only capture a fresh offset if we're NOT already in a settings-change
    // cycle. This prevents drift during rapid clicks (e.g., font+ five times).
    if (!isSettingsChangeRef.current && totalPages > 0) {
      readingOffsetRef.current = pageIndex / totalPages;
    }
    isSettingsChangeRef.current = true;
    suppressColumnTransition.current = true;
    clearTimeout(settingsTimerRef.current);
  }, [pageIndex, totalPages]);

  /* ─── Reset page when chapter changes ────────────────────── */
  // (unless we're doing "go to last page of prev chapter" via sentinel)
  const pendingLastPage = useRef(false);
  const pendingBookmarkFraction = useRef(null); // for cross-chapter bookmark navigation

  /* ─── Chapter-crossing transition logic ───────────────────── */
  // Smoothly fades/slides the reading area out, swaps chapter while invisible,
  // then fades/slides the new content in — avoids the column-sweep flicker.
  const changeChapter = useCallback((newIdx, goToLastPage, direction) => {
    if (chapterFade) return; // ignore while already transitioning
    pendingChapterRef.current = { idx: newIdx, lastPage: goToLastPage };
    setChapterFade(direction); // triggers fade-out
  }, [chapterFade]);

  useEffect(() => {
    if (!chapterFade || !pendingChapterRef.current) return;

    // After fade-out completes (~150ms), swap the chapter content
    const t = setTimeout(() => {
      const { idx, lastPage, targetPage, targetFraction } = pendingChapterRef.current;
      pendingChapterRef.current = null;

      // Suppress the column translateX transition during the invisible swap
      // so the column container jumps instantly to its new position.
      suppressColumnTransition.current = true;

      if (lastPage) pendingLastPage.current = true;
      if (targetFraction != null) pendingBookmarkFraction.current = targetFraction;
      setChapterIdx(idx);
      if (targetFraction != null) {
        // Fraction-based bookmark — page will be computed in totalPages effect
        // after measurePages runs for the new chapter.
      } else if (typeof targetPage === "number") {
        // Legacy bookmark (no fraction) — jump to raw page after measure
        setTimeout(() => setPageIndex(targetPage), 120);
      } else if (!lastPage) {
        setPageIndex(0);
      }

      // Wait for React render + measurePages + pendingLastPage to fully settle,
      // then re-enable column transitions and fade the new content in.
      // Using a short timeout instead of rAF chains for reliability across
      // React's async batching and measurePages' own rAF.
      setTimeout(() => {
        suppressColumnTransition.current = false;
        setChapterFade(null);
      }, 100);
    }, 150);

    return () => clearTimeout(t);
  }, [chapterFade]);

  /* ─── Close panels on click outside ─────────────────────── */
  const justClosedPanel = useRef(false);
  useEffect(() => {
    function handleClick(e) {
      let closed = false;
      // Exclude clicks on the toggle buttons themselves — let their onClick handle toggling
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target) && !settingsBtnRef.current?.contains(e.target)) { setShowSettings(false); closed = true; }
      if (showToc && tocRef.current && !tocRef.current.contains(e.target) && !tocBtnRef.current?.contains(e.target)) { setShowToc(false); closed = true; }
      if (closed) {
        // Prevent the click from also triggering a page turn
        justClosedPanel.current = true;
        setTimeout(() => { justClosedPanel.current = false; }, 50);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSettings, showToc]);

  /* ─── Lock body scroll ──────────────────────────────────── */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  /* ─── After re-measurement, restore or clamp page ─────────── */
  useEffect(() => {
    if (pendingLastPage.current && totalPages > 1) {
      setPageIndex(totalPages - 1);
      pendingLastPage.current = false;
    } else if (pendingBookmarkFraction.current != null && totalPages > 1) {
      // Cross-chapter bookmark navigation: compute the correct page from
      // the stored fraction now that the new chapter has been measured.
      const target = Math.round(pendingBookmarkFraction.current * (totalPages - 1));
      setPageIndex(Math.max(0, Math.min(target, totalPages - 1)));
      pendingBookmarkFraction.current = null;
    } else if (isSettingsChangeRef.current) {
      // Settings change: compute page from the frozen reading offset.
      // The offset was captured before the FIRST settings click and stays
      // frozen through rapid adjustments, so +N then -N = exact same page.
      const newPage = Math.round(readingOffsetRef.current * totalPages);
      setPageIndex(Math.max(0, Math.min(newPage, totalPages - 1)));
      // Keep the flag active through the measurement cycle (0/50/200/600ms),
      // then clear so normal navigation updates the offset again.
      clearTimeout(settingsTimerRef.current);
      settingsTimerRef.current = setTimeout(() => {
        isSettingsChangeRef.current = false;
        suppressColumnTransition.current = false;
      }, 800);
    } else {
      // Normal re-measurement (resize, chapter change): just clamp.
      setPageIndex(prev => Math.min(prev, Math.max(0, totalPages - 1)));
    }
  }, [totalPages]);

  /* ─── Touch swipe support ───────────────────────────────── */
  const touchStartX = useRef(null);
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current == null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextPage();
      else prevPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, totalPages, chapterIdx, totalChapters, isPremium, onSubscribe]);

  /* ─── Page navigation ────────────────────────────────────── */
  const nextPage = useCallback(() => {
    if (pageIndex < totalPages - 1) {
      setPageIndex(p => p + 1);
    } else if (chapterIdx < totalChapters - 1) {
      // Check if the NEXT chapter is within the free limit (or user is premium)
      if (canAccessChapter(chapterIdx + 1, isPremium, FREE_READ_CHAPTER_LIMIT)) {
        changeChapter(chapterIdx + 1, false, 'forward');
      } else {
        // Hit the paywall — trigger subscribe
        onSubscribe?.();
      }
    }
  }, [pageIndex, totalPages, chapterIdx, totalChapters, isPremium, changeChapter, onSubscribe]);

  const prevPage = useCallback(() => {
    if (pageIndex > 0) {
      setPageIndex(p => p - 1);
    } else if (chapterIdx > 0) {
      changeChapter(chapterIdx - 1, true, 'backward');
    }
  }, [pageIndex, chapterIdx, changeChapter]);

  /* ─── Keyboard navigation ───────────────────────────────── */
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); nextPage(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prevPage(); }
      else if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextPage, prevPage, onClose]);

  /* ─── Chapter navigation (from TOC) ─────────────────────── */
  const goChapter = (idx) => {
    if (idx < 0 || idx >= totalChapters) return;
    // Block navigation to locked chapters
    if (!canAccessChapter(idx, isPremium, FREE_READ_CHAPTER_LIMIT)) {
      onSubscribe?.();
      return;
    }
    setShowToc(false);
    if (idx === chapterIdx) return; // already on this chapter
    const direction = idx > chapterIdx ? 'forward' : 'backward';
    changeChapter(idx, false, direction);
  };

  /* ─── Bookmark management ─────────────────────────────────── */
  const addBookmark = useCallback(() => {
    if (bookmarks.length >= 10) return;
    const ch = book?.chapters?.[chapterIdx];
    const label = `Ch. ${ch?.number ?? chapterIdx + 1}, p. ${pageIndex + 1}`;
    // Store fractional progress (0–1) so bookmarks survive font/layout changes.
    // page 0 → 0, last page → 1, even distribution in between.
    const fraction = totalPages > 1 ? pageIndex / (totalPages - 1) : 0;
    const newBm = { chapter: chapterIdx, page: pageIndex, fraction, label };
    // Don't duplicate the exact same location
    const exists = bookmarks.some(b => b.chapter === chapterIdx && b.page === pageIndex);
    if (exists) return;
    const next = [...bookmarks, newBm];
    setBookmarks(next);
    saveBookmarks(book?.id, next);
  }, [bookmarks, chapterIdx, pageIndex, totalPages, book]);

  const removeBookmark = useCallback((idx) => {
    const next = bookmarks.filter((_, i) => i !== idx);
    setBookmarks(next);
    saveBookmarks(book?.id, next);
  }, [bookmarks, book]);

  const goBookmark = useCallback((bm) => {
    // Block navigation to locked chapters
    if (!canAccessChapter(bm.chapter, isPremium, FREE_READ_CHAPTER_LIMIT)) {
      onSubscribe?.();
      return;
    }
    setShowToc(false);
    if (bm.chapter === chapterIdx) {
      // Same chapter — compute page from fraction (handles settings changes).
      // Falls back to raw page number for legacy bookmarks without fraction.
      const targetPage = bm.fraction != null && totalPages > 1
        ? Math.round(bm.fraction * (totalPages - 1))
        : bm.page;
      setPageIndex(Math.max(0, Math.min(targetPage, totalPages - 1)));
    } else {
      // Different chapter — pass fraction so the correct page is computed
      // after the new chapter's layout is measured.
      const direction = bm.chapter > chapterIdx ? 'forward' : 'backward';
      pendingChapterRef.current = {
        idx: bm.chapter,
        lastPage: false,
        targetFraction: bm.fraction ?? null,
        targetPage: bm.fraction == null ? bm.page : undefined,
      };
      setChapterFade(direction);
    }
  }, [chapterIdx, totalPages, isPremium, onSubscribe]);

  /* ─── Compute column transform ───────────────────────────── */
  const clampedPage = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const translateX = containerWidth > 0 ? -(clampedPage * (containerWidth + COLUMN_GAP)) : 0;

  /* ─── Premium gating ─────────────────────────────────────── */
  // Free users can read the first FREE_READ_CHAPTER_LIMIT chapters fully.
  // Beyond that, show a locked overlay.
  const chapterAccessible = canAccessChapter(chapterIdx, isPremium, FREE_READ_CHAPTER_LIMIT);
  const isLocked = !isPremium;
  const showLockedOverlay = !chapterAccessible;

  /* ─── Overall reading progress ───────────────────────────── */
  const overallPct = useMemo(() => {
    if (totalChapters === 0) return 0;
    const cw = 100 / totalChapters;
    const pp = totalPages > 1 ? clampedPage / (totalPages - 1) : 1;
    return Math.round(chapterIdx * cw + pp * cw);
  }, [chapterIdx, clampedPage, totalPages, totalChapters]);

  // Broadcast e-reader open/close so the mini player can reposition
  useEffect(() => {
    document.documentElement.classList.add('ereader-active');
    return () => document.documentElement.classList.remove('ereader-active');
  }, []);

  if (!book) return null;

  return (
    <motion.div
      key="ereader-overlay"
      className="fixed inset-0 z-[9999] flex flex-col"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "tween", duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
    >
        {/* ─── Background ──────────────────────────────────────── */}
        <div className="absolute inset-0 bg-[#0a0a10] pointer-events-none" />
        <div className="ereader-vignette absolute inset-0 pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[60rem] h-[40rem] rounded-full blur-[180px] opacity-[0.03] bg-gradient-to-br from-red-900 via-purple-900 to-transparent pointer-events-none" />

        {/* ═══════════════ TOP BAR ═══════════════════════════════ */}
        <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.04] bg-[#0a0a10]/80 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </button>
            <button ref={tocBtnRef} type="button" onClick={() => { const next = !showToc; setShowToc(next); if (next) setTocTab("contents"); setShowSettings(false); }}
              className={cn("w-9 h-9 rounded-full flex items-center justify-center border transition-all", showToc ? "bg-white/[0.08] border-white/[0.12] text-white" : "bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:bg-white/[0.08] hover:text-white")}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 text-center min-w-0 px-3">
            <h1 className="text-sm font-display italic text-zinc-300 truncate">{book.title}</h1>
            <p className="text-[10px] text-zinc-600 font-medium tracking-wide uppercase">{book.author}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={addBookmark}
              disabled={bookmarks.length >= 10 || bookmarks.some(b => b.chapter === chapterIdx && b.page === pageIndex)}
              title={bookmarks.length >= 10 ? "Max 10 bookmarks" : bookmarks.some(b => b.chapter === chapterIdx && b.page === pageIndex) ? "Page bookmarked" : "Bookmark this page"}
              className={cn("w-9 h-9 rounded-full flex items-center justify-center border transition-all",
                bookmarks.some(b => b.chapter === chapterIdx && b.page === pageIndex)
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed")}>
              <BookmarkPlus className="w-4 h-4" />
            </button>
            <button ref={settingsBtnRef} type="button" onClick={() => { setShowSettings(!showSettings); setShowToc(false); }}
              className={cn("w-9 h-9 rounded-full flex items-center justify-center border transition-all", showSettings ? "bg-white/[0.08] border-white/[0.12] text-white" : "bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:bg-white/[0.08] hover:text-white")}>
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ═══════════════ SETTINGS PANEL ════════════════════════ */}
        <AnimatePresence>
          {showSettings && (
            <motion.div ref={settingsRef} key="settings"
              className="absolute top-[52px] right-4 sm:right-6 z-30 w-64 rounded-xl bg-[#141418] border border-white/[0.06] shadow-2xl shadow-black/60 p-4"
              initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} transition={{ duration: 0.2 }}>
              <div className="mb-4">
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-2 block">Font Size</label>
                <div className="flex items-center gap-3">
                  <button type="button" disabled={fontSize <= FONT_SIZE_MIN} onClick={() => { captureReadingPosition(); setFontSize(Math.max(FONT_SIZE_MIN, fontSize - FONT_SIZE_STEP)); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-center text-sm text-zinc-300 font-medium tabular-nums">{fontSize}px</span>
                  <button type="button" disabled={fontSize >= FONT_SIZE_MAX} onClick={() => { captureReadingPosition(); setFontSize(Math.min(FONT_SIZE_MAX, fontSize + FONT_SIZE_STEP)); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-2 block">Font</label>
                <div className="flex gap-1.5">
                  {FONT_OPTIONS.map((opt) => (
                    <button key={opt.label} type="button" onClick={() => { captureReadingPosition(); setFontFamily(opt.value); }}
                      className={cn("flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                        fontFamily === opt.value ? "bg-white/[0.08] border-white/[0.12] text-white" : "bg-white/[0.02] border-white/[0.04] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300")}
                      style={{ fontFamily: opt.value }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-2 block">Line Spacing</label>
                <div className="flex gap-1.5">
                  {LINE_HEIGHT_OPTIONS.map((opt) => (
                    <button key={opt.label} type="button" onClick={() => { captureReadingPosition(); setLineHeight(opt.value); }}
                      className={cn("flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                        lineHeight === opt.value ? "bg-white/[0.08] border-white/[0.12] text-white" : "bg-white/[0.02] border-white/[0.04] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300")}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════ TABLE OF CONTENTS / BOOKMARKS ═════════ */}
        <AnimatePresence>
          {showToc && (
            <motion.div ref={tocRef} key="toc"
              className="absolute top-[52px] left-4 sm:left-6 z-30 w-72 rounded-xl bg-[#141418] border border-white/[0.06] shadow-2xl shadow-black/60 overflow-hidden flex flex-col"
              style={{ maxHeight: "min(60vh, calc(100dvh - 140px))" }}
              initial={{ opacity: 0, x: -10, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -10, scale: 0.95 }} transition={{ duration: 0.2 }}>
              {/* ── Tab bar ── */}
              <div className="flex border-b border-white/[0.04] flex-shrink-0">
                <button type="button" onClick={() => setTocTab("contents")}
                  className={cn("flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all",
                    tocTab === "contents" ? "text-white border-b-2 border-red-500" : "text-zinc-500 hover:text-zinc-300")}>
                  Contents
                </button>
                <button type="button" onClick={() => setTocTab("bookmarks")}
                  className={cn("flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all relative",
                    tocTab === "bookmarks" ? "text-white border-b-2 border-amber-500" : "text-zinc-500 hover:text-zinc-300")}>
                  Bookmarks
                  {bookmarks.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                      {bookmarks.length}
                    </span>
                  )}
                </button>
              </div>

              {/* ── Contents list ── */}
              {tocTab === "contents" && (
                <div className="py-1 overflow-y-auto flex-1">
                  {book.chapters.map((ch, i) => {
                    const chLocked = isLocked && !canAccessChapter(i, isPremium, FREE_READ_CHAPTER_LIMIT);
                    return (
                      <button key={`ch-${i}`} type="button" onClick={() => goChapter(i)} disabled={chLocked}
                        className={cn("w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all",
                          i === chapterIdx ? "bg-white/[0.06] text-white" : chLocked ? "text-zinc-600 cursor-not-allowed" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200")}>
                        <span className="text-[11px] font-bold text-zinc-600 w-5 text-right tabular-nums">{ch.number}</span>
                        <span className="text-sm font-medium flex-1 truncate italic">{ch.title}</span>
                        {chLocked && <Lock className="w-3 h-3 text-zinc-700 flex-shrink-0" />}
                        {i === chapterIdx && <Bookmark className="w-3.5 h-3.5 text-red-500 fill-red-500 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Bookmarks list ── */}
              {tocTab === "bookmarks" && (
                <div className="py-1 overflow-y-auto flex-1">
                  {bookmarks.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <BookmarkPlus className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                      <p className="text-xs text-zinc-600">No bookmarks yet</p>
                      <p className="text-[10px] text-zinc-700 mt-1">Tap the bookmark button to save your place</p>
                    </div>
                  ) : (
                    bookmarks.map((bm, i) => (
                      <div key={`bm-${i}`} className="flex items-center gap-1 pr-2">
                        <button type="button" onClick={() => goBookmark(bm)}
                          className="flex-1 text-left px-4 py-2.5 flex items-center gap-3 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 transition-all">
                          <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                          <span className="text-sm font-medium flex-1 truncate">{bm.label}</span>
                        </button>
                        <button type="button" onClick={() => removeBookmark(i)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                          title="Remove bookmark">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════ READING AREA ══════════════════════════ */}
        <div
          className="relative z-10 flex-1 flex flex-col overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Invisible tap zones for page turn */}
          <button type="button" aria-label="Previous page" onClick={() => { if (!justClosedPanel.current) prevPage(); }}
            className="absolute left-0 top-0 bottom-0 w-[12%] z-20 cursor-w-resize opacity-0 hover:opacity-100 transition-opacity">
            <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-white/[0.02] to-transparent flex items-center pl-3">
              <ChevronLeft className="w-5 h-5 text-zinc-600" />
            </div>
          </button>
          <button type="button" aria-label="Next page" onClick={() => { if (!justClosedPanel.current) nextPage(); }}
            className="absolute right-0 top-0 bottom-0 w-[12%] z-20 cursor-e-resize opacity-0 hover:opacity-100 transition-opacity">
            <div className="absolute inset-y-0 right-0 w-full bg-gradient-to-l from-white/[0.02] to-transparent flex items-center justify-end pr-3">
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </div>
          </button>

          {showLockedOverlay ? (
            /* ─── Locked chapter overlay ─── */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-400/[0.08] flex items-center justify-center mb-5">
                <Lock className="w-7 h-7 text-amber-400/80" />
              </div>
              <h3 className="text-xl font-display italic text-zinc-200 mb-2">Members-Only Content</h3>
              <p className="text-sm text-zinc-500 max-w-sm mb-6 leading-relaxed">Chapter {FREE_READ_CHAPTER_LIMIT + 1} and beyond are available exclusively to Eeriecast members.</p>
              <button type="button" onClick={onSubscribe} className="px-7 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]">
                Become a Member
              </button>
            </div>
          ) : (
            /* ═══ Full paginated reading ═══ */
            <div
              className="flex-1 flex flex-col overflow-hidden px-6 sm:px-10 lg:px-16 py-6 sm:py-10"
              style={{
                opacity: chapterFade ? 0 : 1,
                transform: chapterFade === 'forward'
                  ? 'translateY(4%)'
                  : chapterFade === 'backward'
                    ? 'translateY(-4%)'
                    : 'translateY(0)',
                transition: 'opacity 0.15s ease, transform 0.15s ease',
              }}
            >
              <div ref={pagerRef} className="flex-1 max-w-[680px] w-full mx-auto overflow-hidden">
                <div
                  ref={columnsRef}
                  className="ereader-columns"
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight,
                    fontFamily,
                    columnWidth: containerWidth > 0 ? `${containerWidth}px` : undefined,
                    columnGap: `${COLUMN_GAP}px`,
                    transform: `translateX(${translateX}px)`,
                    transition: suppressColumnTransition.current
                      ? "none"
                      : "transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)",
                  }}
                >
                  {/* Chapter heading — flows naturally into column layout */}
                  {chapterIdx === 0 && book.epigraph && (
                    <div className="ereader-no-break mb-8 border-l-2 border-white/[0.06] pl-5">
                      <p className="text-sm italic text-zinc-500 leading-relaxed mb-2">&ldquo;{book.epigraph.text}&rdquo;</p>
                      <p className="text-xs text-zinc-600">&mdash;{book.epigraph.attribution}</p>
                    </div>
                  )}

                  <div className="ereader-no-break mb-8 text-center pt-[20vh]">
                    <h2 className="text-2xl sm:text-3xl font-display italic text-zinc-200">{chapter?.title}</h2>
                    <div className="w-16 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mx-auto mt-4" />
                  </div>

                  <div className="ereader-body text-zinc-400">
                    {renderContent(chapter?.content)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════ BOTTOM BAR ═══════════════════════════ */}
        <div className="relative z-10 flex-shrink-0 border-t border-white/[0.04] bg-[#0a0a10]/80 backdrop-blur-md">
          <div className="h-[2px] bg-white/[0.04] relative">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-600 to-red-500 transition-all duration-500 ease-out" style={{ width: `${overallPct}%` }} />
          </div>
          <div className="flex items-center justify-between px-4 sm:px-6 py-2.5">
            <button type="button" onClick={prevPage} disabled={chapterIdx === 0 && pageIndex === 0}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            <div className="text-center">
              <p className="text-[11px] text-zinc-500 font-medium tabular-nums">
                Page {clampedPage + 1} of {totalPages}
                <span className="text-zinc-700 mx-2">&middot;</span>
                Ch. {chapter?.number}
                <span className="text-zinc-700 mx-2">&middot;</span>
                {overallPct}%
              </p>
            </div>
            <button type="button" onClick={nextPage}
              disabled={chapterIdx >= totalChapters - 1 && clampedPage >= totalPages - 1}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
    </motion.div>
  );
}
