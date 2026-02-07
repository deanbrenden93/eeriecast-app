import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
const FREE_PREVIEW_WORDS = 300;
const COLUMN_GAP = 60;

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

export default function EReader({ book, isPremium, onClose, onSubscribe }) {
  /* ─── State ──────────────────────────────────────────────── */
  const [chapterIdx, setChapterIdx] = useState(0);
  const saved = useMemo(() => loadSettings(book?.id), [book?.id]);
  const [fontSize, setFontSize] = useState(saved?.fontSize ?? 18);
  const [lineHeight, setLineHeight] = useState(saved?.lineHeight ?? 1.8);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);

  // Pagination state
  const [pageIndex, setPageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);

  const pagerRef = useRef(null);
  const columnsRef = useRef(null);
  const settingsRef = useRef(null);
  const tocRef = useRef(null);
  const restoredRef = useRef(false); // prevent double-restore

  const chapter = book?.chapters?.[chapterIdx];
  const totalChapters = book?.chapters?.length || 0;

  /* ─── Measure container & compute page count ─────────────── */
  const measurePages = useCallback(() => {
    const wrapper = pagerRef.current;
    const el = columnsRef.current;
    if (!wrapper || !el) return;

    const w = wrapper.clientWidth;
    setContainerWidth(w);

    // Reset to natural (single-viewport) width so overflow:hidden
    // creates a scroll context and scrollWidth reports the true total.
    el.style.width = "";

    // After setting column-width, we need to wait a frame for layout
    requestAnimationFrame(() => {
      const sw = el.scrollWidth;
      const pages = Math.max(1, Math.round(sw / (w + COLUMN_GAP)));
      setTotalPages(pages);

      // Expand the container to fit ALL columns so overflow:hidden
      // no longer clips them. The parent (pagerRef) acts as the viewport.
      if (pages > 1 && w > 0) {
        el.style.width = `${sw}px`;
      }
    });
  }, []);

  // Measure on mount, chapter/font changes, and resize
  useEffect(() => {
    measurePages();
    const onResize = () => measurePages();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measurePages, chapterIdx, fontSize, lineHeight]);

  // Re-measure after fonts load and after layout settles
  useEffect(() => {
    const t1 = setTimeout(measurePages, 50);
    const t2 = setTimeout(measurePages, 200);
    const t3 = setTimeout(measurePages, 600);
    document.fonts?.ready?.then(() => setTimeout(measurePages, 50));
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [measurePages, chapterIdx, fontSize, lineHeight]);

  /* ─── Restore saved chapter + page on mount ──────────────── */
  useEffect(() => {
    if (!book?.id || restoredRef.current) return;
    const prog = loadProgress(book.id);
    if (prog && typeof prog.chapter === "number" && prog.chapter < totalChapters) {
      setChapterIdx(prog.chapter);
      if (typeof prog.page === "number" && prog.page > 0) {
        // Defer until pages are measured
        const t = setTimeout(() => setPageIndex(prog.page), 700);
        restoredRef.current = true;
        return () => clearTimeout(t);
      }
    }
    restoredRef.current = true;
  }, [book?.id, totalChapters]);

  /* ─── Persist settings ───────────────────────────────────── */
  useEffect(() => {
    if (book?.id) saveSettings(book.id, { fontSize, lineHeight });
  }, [book?.id, fontSize, lineHeight]);

  /* ─── Persist progress ───────────────────────────────────── */
  useEffect(() => {
    if (book?.id) saveProgress(book.id, { chapter: chapterIdx, page: pageIndex });
  }, [book?.id, chapterIdx, pageIndex]);

  /* ─── Reset page when font/line-height changes ──────────── */
  useEffect(() => {
    setPageIndex(0);
  }, [fontSize, lineHeight]);

  /* ─── Reset page when chapter changes ────────────────────── */
  // (unless we're doing "go to last page of prev chapter" via sentinel)
  const pendingLastPage = useRef(false);

  /* ─── Close panels on click outside ─────────────────────── */
  useEffect(() => {
    function handleClick(e) {
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false);
      if (showToc && tocRef.current && !tocRef.current.contains(e.target)) setShowToc(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSettings, showToc]);

  /* ─── Lock body scroll ──────────────────────────────────── */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  /* ─── If pendingLastPage, jump to last page after measuring ─ */
  useEffect(() => {
    if (pendingLastPage.current && totalPages > 1) {
      setPageIndex(totalPages - 1);
      pendingLastPage.current = false;
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
  }, [pageIndex, totalPages, chapterIdx, totalChapters, isPremium]);

  /* ─── Page navigation ────────────────────────────────────── */
  const nextPage = useCallback(() => {
    if (pageIndex < totalPages - 1) {
      setPageIndex(p => p + 1);
    } else if (chapterIdx < totalChapters - 1 && isPremium) {
      setChapterIdx(c => c + 1);
      setPageIndex(0);
    }
  }, [pageIndex, totalPages, chapterIdx, totalChapters, isPremium]);

  const prevPage = useCallback(() => {
    if (pageIndex > 0) {
      setPageIndex(p => p - 1);
    } else if (chapterIdx > 0) {
      pendingLastPage.current = true;
      setChapterIdx(c => c - 1);
    }
  }, [pageIndex, chapterIdx]);

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
    setChapterIdx(idx);
    setPageIndex(0);
    setShowToc(false);
  };

  /* ─── Compute column transform ───────────────────────────── */
  const clampedPage = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const translateX = containerWidth > 0 ? -(clampedPage * (containerWidth + COLUMN_GAP)) : 0;

  /* ─── Premium gating ─────────────────────────────────────── */
  const freePreviewText = useMemo(() => {
    if (isPremium || !chapter?.content) return null;
    if (chapterIdx > 0) return "";
    return chapter.content.split(/\s+/).slice(0, FREE_PREVIEW_WORDS).join(" ");
  }, [isPremium, chapter, chapterIdx]);

  const isLocked = !isPremium;
  const showLockedOverlay = isLocked && chapterIdx > 0;
  const showFadeGate = isLocked && chapterIdx === 0;

  /* ─── Overall reading progress ───────────────────────────── */
  const overallPct = useMemo(() => {
    if (totalChapters === 0) return 0;
    const cw = 100 / totalChapters;
    const pp = totalPages > 1 ? clampedPage / (totalPages - 1) : 1;
    return Math.round(chapterIdx * cw + pp * cw);
  }, [chapterIdx, clampedPage, totalPages, totalChapters]);

  if (!book) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="ereader-overlay"
        className="fixed inset-0 z-[9999] flex flex-col"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {/* ─── Background ──────────────────────────────────────── */}
        <div className="absolute inset-0 bg-[#0a0a10]" />
        <div className="ereader-vignette absolute inset-0 pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[60rem] h-[40rem] rounded-full blur-[180px] opacity-[0.03] bg-gradient-to-br from-red-900 via-purple-900 to-transparent pointer-events-none" />

        {/* ═══════════════ TOP BAR ═══════════════════════════════ */}
        <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.04] bg-[#0a0a10]/80 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { setShowToc(!showToc); setShowSettings(false); }}
              className={cn("w-9 h-9 rounded-full flex items-center justify-center border transition-all", showToc ? "bg-white/[0.08] border-white/[0.12] text-white" : "bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:bg-white/[0.08] hover:text-white")}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 text-center min-w-0 px-3">
            <h1 className="text-sm font-display italic text-zinc-300 truncate">{book.title}</h1>
            <p className="text-[10px] text-zinc-600 font-medium tracking-wide uppercase">{book.author}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setShowSettings(!showSettings); setShowToc(false); }}
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
                  <button type="button" disabled={fontSize <= FONT_SIZE_MIN} onClick={() => setFontSize(Math.max(FONT_SIZE_MIN, fontSize - FONT_SIZE_STEP))}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="flex-1 text-center text-sm text-zinc-300 font-medium tabular-nums">{fontSize}px</span>
                  <button type="button" disabled={fontSize >= FONT_SIZE_MAX} onClick={() => setFontSize(Math.min(FONT_SIZE_MAX, fontSize + FONT_SIZE_STEP))}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-2 block">Line Spacing</label>
                <div className="flex gap-1.5">
                  {LINE_HEIGHT_OPTIONS.map((opt) => (
                    <button key={opt.label} type="button" onClick={() => setLineHeight(opt.value)}
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

        {/* ═══════════════ TABLE OF CONTENTS ═════════════════════ */}
        <AnimatePresence>
          {showToc && (
            <motion.div ref={tocRef} key="toc"
              className="absolute top-[52px] left-4 sm:left-6 z-30 w-72 rounded-xl bg-[#141418] border border-white/[0.06] shadow-2xl shadow-black/60 overflow-hidden"
              initial={{ opacity: 0, x: -10, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -10, scale: 0.95 }} transition={{ duration: 0.2 }}>
              <div className="px-4 py-3 border-b border-white/[0.04]">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Contents</h3>
              </div>
              <div className="py-1">
                {book.chapters.map((ch, i) => (
                  <button key={i} type="button" onClick={() => goChapter(i)} disabled={isLocked && i > 0}
                    className={cn("w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all",
                      i === chapterIdx ? "bg-white/[0.06] text-white" : isLocked && i > 0 ? "text-zinc-600 cursor-not-allowed" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200")}>
                    <span className="text-[11px] font-bold text-zinc-600 w-5 text-right tabular-nums">{ch.number}</span>
                    <span className="text-sm font-medium flex-1 truncate italic">{ch.title}</span>
                    {isLocked && i > 0 && <Lock className="w-3 h-3 text-zinc-700 flex-shrink-0" />}
                    {i === chapterIdx && <Bookmark className="w-3.5 h-3.5 text-red-500 fill-red-500 flex-shrink-0" />}
                  </button>
                ))}
              </div>
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
          <button type="button" aria-label="Previous page" onClick={prevPage}
            className="absolute left-0 top-0 bottom-0 w-[12%] z-20 cursor-w-resize opacity-0 hover:opacity-100 transition-opacity">
            <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-white/[0.02] to-transparent flex items-center pl-3">
              <ChevronLeft className="w-5 h-5 text-zinc-600" />
            </div>
          </button>
          <button type="button" aria-label="Next page" onClick={nextPage}
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
              <p className="text-sm text-zinc-500 max-w-sm mb-6 leading-relaxed">Chapters 2 and beyond are available exclusively to Eeriecast members.</p>
              <button type="button" onClick={onSubscribe} className="px-7 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]">
                Become a Member
              </button>
            </div>
          ) : showFadeGate ? (
            /* ─── Free preview with fade gate ─── */
            <div className="flex-1 flex flex-col relative overflow-hidden">
              <div className="flex-1 overflow-hidden px-6 sm:px-10 lg:px-16 py-8 sm:py-12">
                <div className="max-w-[680px] mx-auto">
                  {chapterIdx === 0 && book.epigraph && (
                    <div className="mb-8 border-l-2 border-white/[0.06] pl-5">
                      <p className="text-sm italic text-zinc-500 leading-relaxed mb-2">&ldquo;{book.epigraph.text}&rdquo;</p>
                      <p className="text-xs text-zinc-600">&mdash;{book.epigraph.attribution}</p>
                    </div>
                  )}
                  <div className="mb-8 text-center">
                    <span className="text-[11px] text-zinc-600 uppercase tracking-[0.2em] font-semibold">Chapter {chapter?.number}</span>
                    <h2 className="text-2xl sm:text-3xl font-display italic text-zinc-200 mt-2">{chapter?.title}</h2>
                    <div className="w-16 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mx-auto mt-4" />
                  </div>
                  <div className="ereader-body text-zinc-400 whitespace-pre-line" style={{ fontSize: `${fontSize}px`, lineHeight }}>{freePreviewText}</div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-60 bg-gradient-to-t from-[#0a0a10] via-[#0a0a10]/95 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-6">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-400/[0.08] flex items-center justify-center mb-4"><Lock className="w-6 h-6 text-amber-400/80" /></div>
                <h3 className="text-lg font-display italic text-zinc-200 mb-1.5">Continue Reading</h3>
                <p className="text-xs text-zinc-500 max-w-xs text-center mb-5">Become an Eeriecast member to read the full story</p>
                <button type="button" onClick={onSubscribe} className="px-7 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]">Become a Member</button>
              </div>
            </div>
          ) : (
            /* ═══ Full paginated reading ═══ */
            <div className="flex-1 flex flex-col overflow-hidden px-6 sm:px-10 lg:px-16 py-6 sm:py-10">
              <div ref={pagerRef} className="flex-1 max-w-[680px] w-full mx-auto overflow-hidden">
                <div
                  ref={columnsRef}
                  className="ereader-columns"
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight,
                    columnWidth: containerWidth > 0 ? `${containerWidth}px` : undefined,
                    columnGap: `${COLUMN_GAP}px`,
                    transform: `translateX(${translateX}px)`,
                  }}
                >
                  {/* Chapter heading — flows naturally into column layout */}
                  {chapterIdx === 0 && book.epigraph && (
                    <div className="ereader-no-break mb-8 border-l-2 border-white/[0.06] pl-5">
                      <p className="text-sm italic text-zinc-500 leading-relaxed mb-2">&ldquo;{book.epigraph.text}&rdquo;</p>
                      <p className="text-xs text-zinc-600">&mdash;{book.epigraph.attribution}</p>
                    </div>
                  )}

                  <div className="ereader-no-break mb-8 text-center">
                    <span className="text-[11px] text-zinc-600 uppercase tracking-[0.2em] font-semibold">Chapter {chapter?.number}</span>
                    <h2 className="text-2xl sm:text-3xl font-display italic text-zinc-200 mt-2">{chapter?.title}</h2>
                    <div className="w-16 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mx-auto mt-4" />
                  </div>

                  <div className="ereader-body text-zinc-400 whitespace-pre-line">
                    {chapter?.content}
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
              disabled={(chapterIdx >= totalChapters - 1 && clampedPage >= totalPages - 1) || (isLocked && clampedPage >= totalPages - 1)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
