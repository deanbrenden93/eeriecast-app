import React from "react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Settings,
  Lock,
  List,
  Bookmark,
  BookmarkPlus,
  Trash2,
  ImageIcon,
  Music,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FREE_READ_CHAPTER_LIMIT, canAccessChapter } from "@/lib/freeTier";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { Podcast } from "@/api/entities";

/* ═══════════════════════════════════════════════════════════════════
   Comic Reader — immersive full-screen image-based reader
   Mirrors the EReader chrome (top bar, bottom bar, TOC, bookmarks,
   progress) but displays one comic page image at a time instead of
   CSS multi-column text.
   ═══════════════════════════════════════════════════════════════════ */

const FIT_MODE_OPTIONS = [
  { label: "Width", value: "width" },
  { label: "Height", value: "height" },
  { label: "Full", value: "contain" },
];

const DIRECTION_OPTIONS = [
  { label: "LTR", value: "ltr" },
  { label: "RTL", value: "rtl" },
];

/* ── localStorage helpers ────────────────────────────────────────── */
function loadSettings(comicId) {
  try { const r = localStorage.getItem(`comic-settings-${comicId}`); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveSettings(comicId, s) {
  try { localStorage.setItem(`comic-settings-${comicId}`, JSON.stringify(s)); } catch { /* */ }
}
function loadProgress(comicId) {
  try { const r = localStorage.getItem(`comic-progress-${comicId}`); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveProgress(comicId, p) {
  try { localStorage.setItem(`comic-progress-${comicId}`, JSON.stringify(p)); } catch { /* */ }
}
function loadBookmarks(comicId) {
  try { const r = localStorage.getItem(`comic-bookmarks-${comicId}`); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveBookmarks(comicId, b) {
  try { localStorage.setItem(`comic-bookmarks-${comicId}`, JSON.stringify(b)); } catch { /* */ }
}
function loadOstPreference(comicId) {
  try {
    const asked = localStorage.getItem(`comic-ost-asked-${comicId}`);
    const enabled = localStorage.getItem(`comic-ost-enabled-${comicId}`);
    return { asked: asked === "true", enabled: enabled === "true" };
  } catch { return { asked: false, enabled: false }; }
}
function saveOstPreference(comicId, asked, enabled) {
  try {
    localStorage.setItem(`comic-ost-asked-${comicId}`, String(asked));
    localStorage.setItem(`comic-ost-enabled-${comicId}`, String(enabled));
  } catch { /* */ }
}

export default function ComicReader({ comic, isPremium, onClose, onSubscribe }) {
  /* ─── State ──────────────────────────────────────────────── */
  const [chapterIdx, setChapterIdx] = useState(0);
  const saved = useMemo(() => loadSettings(comic?.id), [comic?.id]);
  const [fitMode, setFitMode] = useState(saved?.fitMode ?? "contain");
  const [readingDirection, setReadingDirection] = useState(
    saved?.readingDirection ?? comic?.readingDirection ?? "ltr"
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [tocTab, setTocTab] = useState("contents");

  // Pagination — page count is simply the number of images in the chapter
  const [pageIndex, setPageIndex] = useState(0);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState(() => loadBookmarks(comic?.id));

  const settingsRef = useRef(null);
  const tocRef = useRef(null);
  const tocBtnRef = useRef(null);
  const settingsBtnRef = useRef(null);
  const restoredRef = useRef(false);

  // Page flip direction for transition animation ("forward" | "backward" | null)
  const flipDirectionRef = useRef(null);

  // Image loading state for current page
  const [imgStatus, setImgStatus] = useState("loading");
  const [retryCount, setRetryCount] = useState(0);

  // Chapter-crossing transition
  const [chapterFade, setChapterFade] = useState(null);
  const pendingChapterRef = useRef(null);
  const pendingLastPage = useRef(false);

  const chapter = comic?.chapters?.[chapterIdx];
  const totalChapters = comic?.chapters?.length || 0;
  const totalPages = chapter?.pages?.length || 0;
  const clampedPage = Math.max(0, Math.min(pageIndex, Math.max(0, totalPages - 1)));

  // Determine effective "next" and "prev" based on reading direction
  const isRTL = readingDirection === "rtl";

  /* ─── Soundtrack (OST) ──────────────────────────────────── */
  const { loadAndPlay } = useAudioPlayerContext();
  const hasSoundtrack = !!comic?.soundtrackPodcastId;
  const [soundtrackPodcast, setSoundtrackPodcast] = useState(null);
  const [soundtrackEpisodes, setSoundtrackEpisodes] = useState([]);
  const ostPref = useMemo(() => loadOstPreference(comic?.id), [comic?.id]);
  const [ostEnabled, setOstEnabled] = useState(ostPref.enabled);
  const [ostAsked, setOstAsked] = useState(ostPref.asked);
  const [showOstPrompt, setShowOstPrompt] = useState(false);
  const ostChapterRef = useRef(-1);

  // Fetch soundtrack podcast + episodes once on mount
  useEffect(() => {
    if (!hasSoundtrack) return;
    let canceled = false;
    (async () => {
      try {
        const pod = await Podcast.get(comic.soundtrackPodcastId);
        if (canceled) return;
        setSoundtrackPodcast(pod);
        const eps = Array.isArray(pod?.episodes)
          ? pod.episodes
          : pod?.episodes?.results || [];
        const sorted = [...eps].sort((a, b) => {
          const da = new Date(a.created_date || a.published_at || a.release_date || 0).getTime();
          const db = new Date(b.created_date || b.published_at || b.release_date || 0).getTime();
          return da - db;
        });
        setSoundtrackEpisodes(sorted);
        // Show prompt if user hasn't been asked yet
        if (!ostPref.asked) setShowOstPrompt(true);
      } catch { /* soundtrack fetch failed — silent, non-critical */ }
    })();
    return () => { canceled = true; };
  }, [hasSoundtrack, comic?.soundtrackPodcastId, ostPref.asked]);

  // OST prompt handlers
  const handleOstAccept = useCallback(() => {
    setOstEnabled(true);
    setOstAsked(true);
    setShowOstPrompt(false);
    saveOstPreference(comic?.id, true, true);
  }, [comic?.id]);

  const handleOstDismiss = useCallback(() => {
    setOstEnabled(false);
    setOstAsked(true);
    setShowOstPrompt(false);
    saveOstPreference(comic?.id, true, false);
  }, [comic?.id]);

  // Autoplay soundtrack on chapter change
  useEffect(() => {
    if (!ostEnabled || !soundtrackEpisodes.length || !soundtrackPodcast) return;
    if (ostChapterRef.current === chapterIdx) return;
    ostChapterRef.current = chapterIdx;
    const ep = soundtrackEpisodes[chapterIdx];
    if (!ep) return;
    loadAndPlay({ podcast: soundtrackPodcast, episode: ep, resume: { progress: 0 } });
  }, [chapterIdx, ostEnabled, soundtrackEpisodes, soundtrackPodcast, loadAndPlay]);

  // When user toggles OST on in settings, immediately play current chapter's track
  const handleOstToggle = useCallback(() => {
    const next = !ostEnabled;
    setOstEnabled(next);
    saveOstPreference(comic?.id, true, next);
    if (!ostAsked) setOstAsked(true);
    if (next && soundtrackEpisodes[chapterIdx] && soundtrackPodcast) {
      ostChapterRef.current = chapterIdx;
      loadAndPlay({ podcast: soundtrackPodcast, episode: soundtrackEpisodes[chapterIdx], resume: { progress: 0 } });
    }
  }, [ostEnabled, comic?.id, ostAsked, chapterIdx, soundtrackEpisodes, soundtrackPodcast, loadAndPlay]);

  /* ─── Restore saved progress on mount ────────────────────── */
  useEffect(() => {
    if (!comic?.id || restoredRef.current) return;
    const prog = loadProgress(comic.id);
    if (prog && typeof prog.chapter === "number" && prog.chapter < totalChapters) {
      const targetCh = canAccessChapter(prog.chapter, isPremium, FREE_READ_CHAPTER_LIMIT)
        ? prog.chapter
        : Math.max(0, FREE_READ_CHAPTER_LIMIT - 1);
      setChapterIdx(targetCh);
      if (targetCh === prog.chapter && typeof prog.page === "number" && prog.page > 0) {
        setPageIndex(prog.page);
      }
    }
    restoredRef.current = true;
  }, [comic?.id, totalChapters, isPremium]);

  /* ─── Persist settings ───────────────────────────────────── */
  useEffect(() => {
    if (comic?.id) saveSettings(comic.id, { fitMode, readingDirection });
  }, [comic?.id, fitMode, readingDirection]);

  /* ─── Persist progress ───────────────────────────────────── */
  useEffect(() => {
    if (comic?.id) saveProgress(comic.id, { chapter: chapterIdx, page: pageIndex });
  }, [comic?.id, chapterIdx, pageIndex]);

  /* ─── Reset image status when page/chapter changes ──────── */
  const pageSrc = chapter?.pages?.[clampedPage] || null;
  useEffect(() => {
    setImgStatus(pageSrc ? "loading" : "loaded");
    setRetryCount(0);
  }, [pageSrc]);

  /* ─── Preload adjacent pages ──────────────────────────────── */
  useEffect(() => {
    if (!chapter?.pages?.length) return;
    const toPreload = [];
    for (let i = 1; i <= 2; i++) {
      if (clampedPage + i < totalPages) toPreload.push(chapter.pages[clampedPage + i]);
    }
    if (clampedPage > 0) toPreload.push(chapter.pages[clampedPage - 1]);
    if (clampedPage >= totalPages - 3 && chapterIdx < totalChapters - 1) {
      const nextCh = comic.chapters[chapterIdx + 1];
      if (nextCh?.pages?.[0]) toPreload.push(nextCh.pages[0]);
    }
    toPreload.forEach((src) => { const img = new Image(); img.src = src; });
  }, [clampedPage, chapterIdx, chapter, totalPages, totalChapters, comic]);

  /* ─── Chapter-crossing transition ────────────────────────── */
  const changeChapter = useCallback((newIdx, goToLastPage, direction) => {
    if (chapterFade) return;
    pendingChapterRef.current = { idx: newIdx, lastPage: goToLastPage };
    setChapterFade(direction);
  }, [chapterFade]);

  useEffect(() => {
    if (!chapterFade || !pendingChapterRef.current) return;
    const t = setTimeout(() => {
      const { idx, lastPage, targetPage } = pendingChapterRef.current;
      pendingChapterRef.current = null;

      if (lastPage) pendingLastPage.current = true;
      setChapterIdx(idx);
      if (typeof targetPage === "number") {
        setPageIndex(targetPage);
      } else if (!lastPage) {
        setPageIndex(0);
      }

      setTimeout(() => setChapterFade(null), 80);
    }, 150);
    return () => clearTimeout(t);
  }, [chapterFade]);

  // Handle pendingLastPage after chapter change
  useEffect(() => {
    if (pendingLastPage.current && totalPages > 0) {
      setPageIndex(totalPages - 1);
      pendingLastPage.current = false;
    } else {
      setPageIndex((prev) => Math.min(prev, Math.max(0, totalPages - 1)));
    }
  }, [totalPages]);

  /* ─── Close panels on outside click ──────────────────────── */
  const justClosedPanel = useRef(false);
  useEffect(() => {
    function handleClick(e) {
      let closed = false;
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target) && !settingsBtnRef.current?.contains(e.target)) { setShowSettings(false); closed = true; }
      if (showToc && tocRef.current && !tocRef.current.contains(e.target) && !tocBtnRef.current?.contains(e.target)) { setShowToc(false); closed = true; }
      if (closed) {
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
      if (isRTL) {
        if (diff > 0) prevPage();
        else nextPage();
      } else {
        if (diff > 0) nextPage();
        else prevPage();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, totalPages, chapterIdx, totalChapters, isPremium, onSubscribe, isRTL]);

  /* ─── Page navigation ────────────────────────────────────── */
  const nextPage = useCallback(() => {
    flipDirectionRef.current = "forward";
    if (pageIndex < totalPages - 1) {
      setPageIndex((p) => p + 1);
    } else if (chapterIdx < totalChapters - 1) {
      if (canAccessChapter(chapterIdx + 1, isPremium, FREE_READ_CHAPTER_LIMIT)) {
        changeChapter(chapterIdx + 1, false, "forward");
      } else {
        onSubscribe?.();
      }
    }
  }, [pageIndex, totalPages, chapterIdx, totalChapters, isPremium, changeChapter, onSubscribe]);

  const prevPage = useCallback(() => {
    flipDirectionRef.current = "backward";
    if (pageIndex > 0) {
      setPageIndex((p) => p - 1);
    } else if (chapterIdx > 0) {
      changeChapter(chapterIdx - 1, true, "backward");
    }
  }, [pageIndex, chapterIdx, changeChapter]);

  /* ─── Keyboard navigation ───────────────────────────────── */
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        isRTL ? prevPage() : nextPage();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        isRTL ? nextPage() : prevPage();
      } else if (e.key === "Escape") {
        onClose?.();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextPage, prevPage, onClose, isRTL]);

  /* ─── Chapter navigation (from TOC) ─────────────────────── */
  const goChapter = (idx) => {
    if (idx < 0 || idx >= totalChapters) return;
    if (!canAccessChapter(idx, isPremium, FREE_READ_CHAPTER_LIMIT)) {
      onSubscribe?.();
      return;
    }
    setShowToc(false);
    if (idx === chapterIdx) return;
    const direction = idx > chapterIdx ? "forward" : "backward";
    changeChapter(idx, false, direction);
  };

  /* ─── Bookmark management ─────────────────────────────────── */
  const addBookmark = useCallback(() => {
    if (bookmarks.length >= 10) return;
    const ch = comic?.chapters?.[chapterIdx];
    const label = `Ch. ${ch?.number ?? chapterIdx + 1}, p. ${clampedPage + 1}`;
    const exists = bookmarks.some((b) => b.chapter === chapterIdx && b.page === clampedPage);
    if (exists) return;
    const next = [...bookmarks, { chapter: chapterIdx, page: clampedPage, label }];
    setBookmarks(next);
    saveBookmarks(comic?.id, next);
  }, [bookmarks, chapterIdx, clampedPage, comic]);

  const removeBookmark = useCallback(
    (idx) => {
      const next = bookmarks.filter((_, i) => i !== idx);
      setBookmarks(next);
      saveBookmarks(comic?.id, next);
    },
    [bookmarks, comic]
  );

  const goBookmark = useCallback(
    (bm) => {
      if (!canAccessChapter(bm.chapter, isPremium, FREE_READ_CHAPTER_LIMIT)) {
        onSubscribe?.();
        return;
      }
      setShowToc(false);
      if (bm.chapter === chapterIdx) {
        setPageIndex(bm.page);
      } else {
        const direction = bm.chapter > chapterIdx ? "forward" : "backward";
        pendingChapterRef.current = {
          idx: bm.chapter,
          lastPage: false,
          targetPage: bm.page,
        };
        setChapterFade(direction);
      }
    },
    [chapterIdx, isPremium, onSubscribe]
  );

  /* ─── Premium gating ─────────────────────────────────────── */
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

  // Broadcast overlay open for mini player repositioning
  useEffect(() => {
    document.documentElement.classList.add("ereader-active");
    return () => document.documentElement.classList.remove("ereader-active");
  }, []);

  /* ─── Fit mode image class ──────────────────────────────── */
  const imgFitClass =
    fitMode === "width"
      ? "comic-page-img comic-fit-width"
      : fitMode === "height"
        ? "comic-page-img comic-fit-height"
        : "comic-page-img comic-fit-contain";

  if (!comic) return null;

  return (
    <motion.div
      key="comicreader-overlay"
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
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            ref={tocBtnRef}
            type="button"
            onClick={() => {
              const next = !showToc;
              setShowToc(next);
              if (next) setTocTab("contents");
              setShowSettings(false);
            }}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center border transition-all",
              showToc
                ? "bg-white/[0.08] border-white/[0.12] text-white"
                : "bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 text-center min-w-0 px-3">
          <h1 className="text-sm font-display italic text-zinc-300 truncate">
            {comic.title}
          </h1>
          <p className="text-[10px] text-zinc-600 font-medium tracking-wide uppercase">
            {comic.subtitle || comic.author}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addBookmark}
            disabled={
              totalPages === 0 ||
              bookmarks.length >= 10 ||
              bookmarks.some(
                (b) => b.chapter === chapterIdx && b.page === clampedPage
              )
            }
            title={
              bookmarks.length >= 10
                ? "Max 10 bookmarks"
                : bookmarks.some(
                      (b) =>
                        b.chapter === chapterIdx && b.page === clampedPage
                    )
                  ? "Page bookmarked"
                  : "Bookmark this page"
            }
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center border transition-all",
              bookmarks.some(
                (b) => b.chapter === chapterIdx && b.page === clampedPage
              )
                ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            )}
          >
            <BookmarkPlus className="w-4 h-4" />
          </button>
          <button
            ref={settingsBtnRef}
            type="button"
            onClick={() => {
              setShowSettings(!showSettings);
              setShowToc(false);
            }}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center border transition-all",
              showSettings
                ? "bg-white/[0.08] border-white/[0.12] text-white"
                : "bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
            )}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ═══════════════ SETTINGS PANEL ════════════════════════ */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            ref={settingsRef}
            key="comic-settings"
            className="absolute top-[52px] right-4 sm:right-6 z-30 w-64 rounded-xl bg-[#141418] border border-white/[0.06] shadow-2xl shadow-black/60 p-4"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-4">
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-2 block">
                Fit Mode
              </label>
              <div className="flex gap-1.5">
                {FIT_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFitMode(opt.value)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                      fitMode === opt.value
                        ? "bg-white/[0.08] border-white/[0.12] text-white"
                        : "bg-white/[0.02] border-white/[0.04] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={hasSoundtrack ? "mb-4" : ""}>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-2 block">
                Reading Direction
              </label>
              <div className="flex gap-1.5">
                {DIRECTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setReadingDirection(opt.value)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                      readingDirection === opt.value
                        ? "bg-white/[0.08] border-white/[0.12] text-white"
                        : "bg-white/[0.02] border-white/[0.04] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {hasSoundtrack && (
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-2 block">
                  Autoplay Comic OST
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleOstToggle}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all flex items-center justify-center gap-1.5",
                      ostEnabled
                        ? "bg-white/[0.08] border-white/[0.12] text-white"
                        : "bg-white/[0.02] border-white/[0.04] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
                    )}
                  >
                    <Music className="w-3 h-3" />
                    {ostEnabled ? "On" : "Off"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ OST PROMPT BAR ══════════════════════════ */}
      <AnimatePresence>
        {showOstPrompt && (
          <motion.div
            key="ost-prompt"
            className="relative z-20 flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-[#141418]/95 backdrop-blur-md border-b border-white/[0.04]"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Music className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-zinc-300 truncate">
                This comic has a soundtrack. Enable autoplay?
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleOstAccept}
                className="px-3.5 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold transition-colors"
              >
                Enable
              </button>
              <button
                type="button"
                onClick={handleOstDismiss}
                className="px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400 hover:text-zinc-200 text-[11px] font-medium border border-white/[0.06] transition-all"
              >
                No thanks
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ TABLE OF CONTENTS / BOOKMARKS ═════════ */}
      <AnimatePresence>
        {showToc && (
          <motion.div
            ref={tocRef}
            key="comic-toc"
            className="absolute top-[52px] left-4 sm:left-6 z-30 w-72 rounded-xl bg-[#141418] border border-white/[0.06] shadow-2xl shadow-black/60 overflow-hidden flex flex-col"
            style={{ maxHeight: "min(60vh, calc(100dvh - 140px))" }}
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Tab bar */}
            <div className="flex border-b border-white/[0.04] flex-shrink-0">
              <button
                type="button"
                onClick={() => setTocTab("contents")}
                className={cn(
                  "flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all",
                  tocTab === "contents"
                    ? "text-white border-b-2 border-red-500"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Contents
              </button>
              <button
                type="button"
                onClick={() => setTocTab("bookmarks")}
                className={cn(
                  "flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all relative",
                  tocTab === "bookmarks"
                    ? "text-white border-b-2 border-amber-500"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Bookmarks
                {bookmarks.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                    {bookmarks.length}
                  </span>
                )}
              </button>
            </div>

            {/* Contents list */}
            {tocTab === "contents" && (
              <div className="py-1 overflow-y-auto flex-1">
                {comic.chapters.map((ch, i) => {
                  const chLocked =
                    isLocked &&
                    !canAccessChapter(i, isPremium, FREE_READ_CHAPTER_LIMIT);
                  return (
                    <button
                      key={`ch-${i}`}
                      type="button"
                      onClick={() => goChapter(i)}
                      disabled={chLocked}
                      className={cn(
                        "w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all",
                        i === chapterIdx
                          ? "bg-white/[0.06] text-white"
                          : chLocked
                            ? "text-zinc-600 cursor-not-allowed"
                            : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                      )}
                    >
                      <span className="text-[11px] font-bold text-zinc-600 w-5 text-right tabular-nums">
                        {ch.number}
                      </span>
                      <span className="text-sm font-medium flex-1 truncate italic">
                        {ch.title}
                      </span>
                      {ch.pages?.length > 0 && (
                        <span className="text-[10px] text-zinc-600 tabular-nums flex-shrink-0">
                          {ch.pages.length}p
                        </span>
                      )}
                      {chLocked && (
                        <Lock className="w-3 h-3 text-zinc-700 flex-shrink-0" />
                      )}
                      {i === chapterIdx && (
                        <Bookmark className="w-3.5 h-3.5 text-red-500 fill-red-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bookmarks list */}
            {tocTab === "bookmarks" && (
              <div className="py-1 overflow-y-auto flex-1">
                {bookmarks.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <BookmarkPlus className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-600">No bookmarks yet</p>
                    <p className="text-[10px] text-zinc-700 mt-1">
                      Tap the bookmark button to save your place
                    </p>
                  </div>
                ) : (
                  bookmarks.map((bm, i) => (
                    <div key={`bm-${i}`} className="flex items-center gap-1 pr-2">
                      <button
                        type="button"
                        onClick={() => goBookmark(bm)}
                        className="flex-1 text-left px-4 py-2.5 flex items-center gap-3 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 transition-all"
                      >
                        <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                        <span className="text-sm font-medium flex-1 truncate">
                          {bm.label}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBookmark(i)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                        title="Remove bookmark"
                      >
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
        {/* Invisible tap zones — direction-aware */}
        <button
          type="button"
          aria-label={isRTL ? "Next page" : "Previous page"}
          onClick={() => {
            if (!justClosedPanel.current) isRTL ? nextPage() : prevPage();
          }}
          className="absolute left-0 top-0 bottom-0 w-[12%] z-20 cursor-w-resize opacity-0 hover:opacity-100 transition-opacity"
        >
          <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-white/[0.02] to-transparent flex items-center pl-3">
            <ChevronLeft className="w-5 h-5 text-zinc-600" />
          </div>
        </button>
        <button
          type="button"
          aria-label={isRTL ? "Previous page" : "Next page"}
          onClick={() => {
            if (!justClosedPanel.current) isRTL ? prevPage() : nextPage();
          }}
          className="absolute right-0 top-0 bottom-0 w-[12%] z-20 cursor-e-resize opacity-0 hover:opacity-100 transition-opacity"
        >
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
            <h3 className="text-xl font-display italic text-zinc-200 mb-2">
              Members-Only Content
            </h3>
            <p className="text-sm text-zinc-500 max-w-sm mb-6 leading-relaxed">
              Chapter {FREE_READ_CHAPTER_LIMIT + 1} and beyond are available
              exclusively to Eeriecast members.
            </p>
            <button
              type="button"
              onClick={onSubscribe}
              className="px-7 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              Become a Member
            </button>
          </div>
        ) : totalPages === 0 ? (
          /* ─── No pages placeholder ─── */
          <div
            className="flex-1 flex flex-col items-center justify-center text-center px-6"
            style={{
              opacity: chapterFade ? 0 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
              <ImageIcon className="w-9 h-9 text-zinc-700" />
            </div>
            <h3 className="text-lg font-display italic text-zinc-300 mb-2">
              No Pages Available Yet
            </h3>
            <p className="text-sm text-zinc-600 max-w-xs leading-relaxed">
              This chapter&rsquo;s artwork is still being crafted. Check back
              soon for the full experience.
            </p>
          </div>
        ) : (
          /* ═══ Comic page display ═══ */
          <div
            className="flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-4 relative"
            style={{
              opacity: chapterFade ? 0 : 1,
              transform:
                chapterFade === "forward"
                  ? "translateX(-4%)"
                  : chapterFade === "backward"
                    ? "translateX(4%)"
                    : "translateX(0)",
              transition: "opacity 0.15s ease, transform 0.15s ease",
            }}
          >
            {/* Loading skeleton — visible until image loads */}
            {imgStatus === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center z-[1]">
                <div className="comic-page-skeleton aspect-[2/3] rounded-lg flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
                </div>
              </div>
            )}

            {/* Error state */}
            {imgStatus === "error" && (
              <div className="absolute inset-0 flex items-center justify-center z-[1]">
                <div className="flex flex-col items-center gap-4 text-center px-6">
                  <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-sm text-zinc-400">Failed to load page</p>
                  <button
                    type="button"
                    onClick={() => { setRetryCount((c) => c + 1); setImgStatus("loading"); }}
                    className="px-5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition-all"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Page image with slide+fade transition */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.img
                key={`${chapterIdx}-${clampedPage}-${retryCount}`}
                src={pageSrc + (retryCount ? `?_r=${retryCount}` : "")}
                alt={`Page ${clampedPage + 1}`}
                className={imgFitClass}
                draggable={false}
                style={{ touchAction: "pinch-zoom" }}
                onLoad={() => setImgStatus("loaded")}
                onError={() => setImgStatus("error")}
                initial={{
                  opacity: 0,
                  x: flipDirectionRef.current === "forward" ? "3%" : flipDirectionRef.current === "backward" ? "-3%" : 0,
                }}
                animate={{
                  opacity: imgStatus === "error" ? 0 : 1,
                  x: 0,
                }}
                exit={{
                  opacity: 0,
                  x: flipDirectionRef.current === "forward" ? "-3%" : flipDirectionRef.current === "backward" ? "3%" : 0,
                }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ═══════════════ BOTTOM BAR ═══════════════════════════ */}
      <div className="relative z-10 flex-shrink-0 border-t border-white/[0.04] bg-[#0a0a10]/80 backdrop-blur-md">
        <div className="h-[2px] bg-white/[0.04] relative">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-600 to-red-500 transition-all duration-500 ease-out"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5">
          <button
            type="button"
            onClick={isRTL ? nextPage : prevPage}
            disabled={
              isRTL
                ? chapterIdx >= totalChapters - 1 && clampedPage >= totalPages - 1
                : chapterIdx === 0 && pageIndex === 0
            }
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Previous</span>
          </button>
          <div className="text-center">
            <p className="text-[11px] text-zinc-500 font-medium tabular-nums">
              {totalPages > 0 ? (
                <>
                  Page {clampedPage + 1} of {totalPages}
                  <span className="text-zinc-700 mx-2">&middot;</span>
                </>
              ) : null}
              Ch. {chapter?.number ?? chapterIdx + 1}
              <span className="text-zinc-700 mx-2">&middot;</span>
              {overallPct}%
            </p>
          </div>
          <button
            type="button"
            onClick={isRTL ? prevPage : nextPage}
            disabled={
              isRTL
                ? chapterIdx === 0 && pageIndex === 0
                : chapterIdx >= totalChapters - 1 && clampedPage >= totalPages - 1
            }
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
