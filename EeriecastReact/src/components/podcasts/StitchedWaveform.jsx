import { useRef, useEffect, useCallback } from 'react';

// ── Constants ───────────────────────────────────────────────────────
const STITCH_SPACING = 9;       // px between each diagonal stitch mark
const TRACK_HEIGHT = 4;          // px height of the progress track
const STITCH_EXTENT = 3.5;       // how far stitch marks extend above/below track center (unplayed)
const STITCH_EXTENT_PLAYED = 5;  // taller stitches on played side — stitches ARE the progress
const COMPONENT_HEIGHT = 24;     // total component height in CSS px
const SHIMMER_RADIUS = 45;       // px radius around playhead where stitches brighten
const CLAW_EXTENT = 8;           // how far the claw-slash playhead extends above/below center
const CLAW_LEAN = 3;             // horizontal lean of the claw slash (px forward tilt)
const CLAW_WIDTH = 2.5;          // stroke width of the claw mark

const COLOR_PLAYED = 'rgba(255, 255, 255, 0.55)';
const COLOR_UNPLAYED = 'rgba(220, 38, 38, 0.35)';
const COLOR_STITCH_PLAYED = 'rgba(255, 255, 255, 0.55)';
const COLOR_STITCH_UNPLAYED = 'rgba(220, 38, 38, 0.22)';
const COLOR_CLAW = '#ffffff';
const COLOR_GLOW = 'rgba(220, 38, 38, 0.55)';

// ── Component ───────────────────────────────────────────────────────
export default function StitchedWaveform({
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  onSeek,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(null);

  // ── Draw ──────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Resize canvas if needed
    const cw = Math.round(w * dpr);
    const ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
    const playedX = progress * w;
    const centerY = h / 2;
    const trackTop = centerY - TRACK_HEIGHT / 2;
    const trackRadius = TRACK_HEIGHT / 2;

    // ── 1. Draw track (unplayed portion) ────────────────────────
    ctx.beginPath();
    ctx.roundRect(0, trackTop, w, TRACK_HEIGHT, trackRadius);
    ctx.fillStyle = COLOR_UNPLAYED;
    ctx.fill();

    // ── 2. Draw track (played portion) ──────────────────────────
    if (playedX > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, playedX, h);
      ctx.clip();
      ctx.beginPath();
      ctx.roundRect(0, trackTop, w, TRACK_HEIGHT, trackRadius);
      ctx.fillStyle = COLOR_PLAYED;
      ctx.fill();
      ctx.restore();
    }

    // ── 3. Draw stitch marks ────────────────────────────────────
    // Pulse timing for shimmer (smooth sine wave, ~1.5s cycle)
    const now = performance.now();
    if (!startTimeRef.current) startTimeRef.current = now;
    const elapsed = (now - startTimeRef.current) / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * Math.PI * 2 / 1.5);

    const stitchCount = Math.floor(w / STITCH_SPACING);
    for (let i = 1; i <= stitchCount; i++) {
      const x = i * STITCH_SPACING;
      const isOnPlayed = x <= playedX;

      // Determine stitch color — played stitches are brighter, shimmer near playhead
      let stitchColor;
      const extent = isOnPlayed ? STITCH_EXTENT_PLAYED : STITCH_EXTENT;
      const lineW = isOnPlayed ? 1.2 : 1;

      if (isPlaying) {
        const dist = Math.abs(x - playedX);
        if (dist < SHIMMER_RADIUS) {
          const proximity = 1 - dist / SHIMMER_RADIUS;
          const alpha = 0.35 + proximity * pulse * 0.50;
          stitchColor = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
        } else {
          stitchColor = isOnPlayed ? COLOR_STITCH_PLAYED : COLOR_STITCH_UNPLAYED;
        }
      } else {
        stitchColor = isOnPlayed ? COLOR_STITCH_PLAYED : COLOR_STITCH_UNPLAYED;
      }

      // Draw a diagonal slash (/) crossing the bar
      ctx.beginPath();
      ctx.moveTo(x - 1.5, centerY + extent);
      ctx.lineTo(x + 1.5, centerY - extent);
      ctx.strokeStyle = stitchColor;
      ctx.lineWidth = lineW;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // ── 4. Draw playhead claw slash ─────────────────────────────
    if (duration > 0) {
      const clawX = playedX;

      // The claw leans forward (right) — bottom-left to top-right
      const x0 = clawX - CLAW_LEAN * 0.4;  // bottom start (slightly behind)
      const y0 = centerY + CLAW_EXTENT;
      const x1 = clawX + CLAW_LEAN * 0.6;  // top end (leans forward)
      const y1 = centerY - CLAW_EXTENT;

      // Glow when playing (pulsing)
      if (isPlaying) {
        const glowSize = 6 + pulse * 12;
        ctx.save();
        ctx.shadowBlur = glowSize;
        ctx.shadowColor = COLOR_GLOW;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = COLOR_CLAW;
        ctx.lineWidth = CLAW_WIDTH;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // Solid claw slash (always)
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = COLOR_CLAW;
      ctx.lineWidth = CLAW_WIDTH;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }, [currentTime, duration, isPlaying]);

  // ── Animation loop ────────────────────────────────────────────────
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };
    if (isPlaying) {
      loop();
    } else {
      draw(); // static frame when paused
    }
    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, draw]);

  // Redraw on seek while paused
  useEffect(() => {
    if (!isPlaying) draw();
  }, [currentTime, isPlaying, draw]);

  // ── Click to seek ─────────────────────────────────────────────────
  const handleClick = useCallback((e) => {
    if (!onSeek || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(ratio, 1)) * duration);
  }, [onSeek, duration]);

  return (
    <div
      ref={containerRef}
      className="w-full cursor-pointer"
      style={{ height: COMPONENT_HEIGHT, position: 'relative' }}
      onClick={handleClick}
      role="slider"
      aria-label="Episode progress"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      tabIndex={0}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
      />
    </div>
  );
}
