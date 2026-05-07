import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";

// ── ScrollingTitle ─────────────────────────────────────────────────
//
// Marquee for the hero episode title on the full-screen player.
// Reserved for that single surface only: every other place in the app
// (episode tables, home rows, the mini player, the queue, search,
// history, favorites, profile, etc.) now renders titles as static
// two-line clamped text with ellipsis. The reasoning is that motion
// across many simultaneous cards/rows turned out to be visually
// distracting; on the player screen there is exactly one title at a
// time and a long episode name still benefits from being fully
// readable, so the ping-pong scroll is kept there.
//
// Behavior matches the player verbatim:
//   • detect overflow with `scrollWidth > clientWidth + 2`
//   • when overflowing, apply `animate-marquee` (defined in
//     `src/index.css`) which performs the 12s pause → forward →
//     pause → reverse → pause cycle
//   • inject the measured container width as `--marquee-container`
//     so the keyframe lands the right edge of the text on the right
//     edge of the container exactly
//
// Improvements over the inlined player helpers:
//   • re-measures on container resize via `ResizeObserver` (the
//     originals only re-checked on `text` change + a one-shot
//     500 ms timeout, so titles went stale on rotate / resize)
//   • respects `prefers-reduced-motion` — falls back to a static
//     truncated line when the user has motion disabled
//   • renders a native `title` attribute as a fallback tooltip so
//     desktop users can still hover for the full text
//   • polymorphic via `as` so consumers keep their semantic tag
//     (h1, h3, span, p, div, …) and class names

const VOID_TAGS = new Set(["br", "hr", "img", "input"]);

export default function ScrollingTitle({
  text,
  as: Tag = "span",
  className = "",
  suffix = null,
  title,
  onClick,
}) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [needsScroll, setNeedsScroll] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // Honor prefers-reduced-motion — never auto-scroll for users who
  // have disabled motion at the OS level.
  const reducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    if (VOID_TAGS.has(Tag)) return undefined;

    const measure = () => {
      const c = containerRef.current;
      const t = textRef.current;
      if (!c || !t) return;
      const cw = c.clientWidth;
      // 2px tolerance avoids flapping on sub-pixel rounding.
      const overflow = t.scrollWidth > cw + 2;
      setContainerWidth(cw);
      setNeedsScroll(overflow && !reducedMotion.current);
    };

    measure();
    // Re-measure after layout settles (web-fonts, lazy images, etc.)
    const tid = setTimeout(measure, 500);

    let ro;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(containerRef.current);
      if (textRef.current) ro.observe(textRef.current);
    }

    return () => {
      clearTimeout(tid);
      if (ro) ro.disconnect();
    };
  }, [text, suffix, Tag]);

  const innerClassName = [
    "whitespace-nowrap",
    needsScroll ? "animate-marquee inline-block" : "block truncate",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    // Wrapper is a `<span>` (forced to `block`) rather than a `<div>` so
    // this primitive is also valid HTML when nested inside phrasing-only
    // parents like `<button>` or `<a>`. `min-w-0` is critical here:
    // without it, a flex parent can't shrink the wrapper below the
    // intrinsic width of the (whitespace-nowrap) text inside, which
    // both breaks truncation when the title fits and starves the
    // marquee of a measurable container width when it doesn't.
    <span
      ref={containerRef}
      className="block relative w-full min-w-0 overflow-hidden"
      title={title || (typeof text === "string" ? text : undefined)}
    >
      <Tag
        ref={textRef}
        className={innerClassName}
        style={
          needsScroll ? { "--marquee-container": `${containerWidth}px` } : undefined
        }
        onClick={onClick}
      >
        {text}
        {suffix}
      </Tag>
    </span>
  );
}

ScrollingTitle.propTypes = {
  text: PropTypes.node.isRequired,
  as: PropTypes.string,
  className: PropTypes.string,
  suffix: PropTypes.node,
  title: PropTypes.string,
  onClick: PropTypes.func,
};
