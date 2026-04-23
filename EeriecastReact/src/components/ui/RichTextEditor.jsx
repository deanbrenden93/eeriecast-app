import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Undo2,
  Redo2,
  Eraser,
} from 'lucide-react';

/**
 * RichTextEditor
 * ----------------------------------------------------------------------
 * Light-weight contentEditable rich text field with a minimal toolbar,
 * keyboard shortcuts, paste sanitization, and a live word counter.
 *
 * Intentionally stays free of external editor dependencies (Tiptap /
 * Slate / Lexical) — the surface area we need is small enough that
 * `document.execCommand` is still the simplest integration, and the
 * component stays tree-shakable with no bundle-size penalty.
 *
 * Props
 *   - value / onChange:   Controlled HTML string. onChange is called with
 *                         (htmlString, wordCount) on every edit.
 *   - placeholder:        Ghost text shown when the editor is empty.
 *   - minWords:           Soft requirement surfaced in the word counter
 *                         (the component does not block editing; the
 *                         parent form is responsible for enforcing it).
 *   - ariaLabel:          Accessibility label for screen readers.
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder = '',
  minWords = 0,
  ariaLabel,
  id,
}) {
  const editorRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  // Force-rerenders whenever the caret state changes so the toolbar's
  // active state (bold / italic / etc.) can reflect the current selection.
  const [, setToolbarTick] = useState(0);
  const pokeToolbar = useCallback(() => setToolbarTick((n) => n + 1), []);

  // Sync external value into the DOM only when it actually differs and
  // the editor isn't currently focused (so we don't kick the caret while
  // the user is typing). Useful when the parent resets the form.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const next = value ?? '';
    if (el.innerHTML !== next) {
      el.innerHTML = next;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    onChange?.(html, countWords(html));
    pokeToolbar();
  }, [onChange, pokeToolbar]);

  const exec = useCallback(
    (cmd, arg) => {
      editorRef.current?.focus();
      // document.execCommand is deprecated but remains universally
      // supported and is still the simplest integration for a small
      // custom editor. Using innerHTML post-call for change detection.
      document.execCommand(cmd, false, arg);
      handleInput();
    },
    [handleInput],
  );

  const handlePaste = useCallback((e) => {
    // Strip remote formatting (Google Docs, Word, web pages) on paste so
    // the field stays clean and our word count stays accurate.
    e.preventDefault();
    const text =
      e.clipboardData?.getData('text/plain') ??
      window.clipboardData?.getData('Text') ??
      '';
    document.execCommand('insertText', false, text);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      // Standard Windows/Linux + macOS keyboard shortcuts. Browsers
      // mostly handle these natively when execCommand is available, but
      // wiring them here guarantees our onChange fires immediately.
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'b') { e.preventDefault(); exec('bold'); }
      else if (key === 'i') { e.preventDefault(); exec('italic'); }
      else if (key === 'u') { e.preventDefault(); exec('underline'); }
    },
    [exec],
  );

  const wordCount = useMemo(() => countWords(value || ''), [value]);
  const isEmpty = wordCount === 0 && !stripTags(value || '').length;
  const meetsMin = minWords === 0 ? true : wordCount >= minWords;

  // Active-state helpers for the toolbar. `queryCommandState` returns
  // true while the caret sits inside a bold/italic/etc. block.
  const isActive = (cmd) => {
    if (!editorRef.current || document.activeElement !== editorRef.current) {
      return false;
    }
    try { return document.queryCommandState(cmd); } catch { return false; }
  };

  return (
    <div
      className={`rounded-xl border bg-black/40 transition-all ${
        isFocused
          ? 'border-red-500/40 ring-1 ring-red-500/20'
          : 'border-white/[0.08] hover:border-white/[0.12]'
      }`}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 border-b border-white/[0.05] px-2 py-1.5 bg-white/[0.02] rounded-t-xl"
        onMouseDown={(e) => e.preventDefault()}
      >
        <ToolbarButton title="Bold (Ctrl/⌘+B)" onClick={() => exec('bold')} icon={Bold} active={isActive('bold')} />
        <ToolbarButton title="Italic (Ctrl/⌘+I)" onClick={() => exec('italic')} icon={Italic} active={isActive('italic')} />
        <ToolbarButton title="Underline (Ctrl/⌘+U)" onClick={() => exec('underline')} icon={Underline} active={isActive('underline')} />
        <ToolbarSeparator />
        <ToolbarButton title="Heading" onClick={() => exec('formatBlock', 'h3')} icon={Heading2} />
        <ToolbarButton title="Quote" onClick={() => exec('formatBlock', 'blockquote')} icon={Quote} />
        <ToolbarButton title="Bulleted list" onClick={() => exec('insertUnorderedList')} icon={List} active={isActive('insertUnorderedList')} />
        <ToolbarButton title="Numbered list" onClick={() => exec('insertOrderedList')} icon={ListOrdered} active={isActive('insertOrderedList')} />
        <ToolbarSeparator />
        <ToolbarButton title="Undo (Ctrl/⌘+Z)" onClick={() => exec('undo')} icon={Undo2} />
        <ToolbarButton title="Redo (Ctrl/⌘+Shift+Z)" onClick={() => exec('redo')} icon={Redo2} />
        <ToolbarButton title="Clear formatting" onClick={() => exec('removeFormat')} icon={Eraser} />
      </div>

      {/* Editor */}
      <div className="relative">
        <div
          id={id}
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          onInput={handleInput}
          onFocus={() => { setIsFocused(true); pokeToolbar(); }}
          onBlur={() => { setIsFocused(false); pokeToolbar(); }}
          onKeyDown={handleKeyDown}
          onKeyUp={pokeToolbar}
          onMouseUp={pokeToolbar}
          onPaste={handlePaste}
          suppressContentEditableWarning
          className="rich-editor min-h-[220px] max-h-[520px] overflow-y-auto px-4 py-3 text-sm text-white leading-relaxed focus:outline-none
            [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white [&_h3]:my-3
            [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-red-500/40 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-zinc-300
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2
            [&_li]:my-1
            [&_p]:my-1
            [&_strong]:text-white
            [&_em]:text-zinc-200"
        />
        {isEmpty && !isFocused && placeholder && (
          <div className="absolute top-3 left-4 text-sm text-zinc-600 pointer-events-none select-none">
            {placeholder}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/[0.05] px-3 py-2 text-[11px]">
        <span className="text-zinc-600">
          {minWords > 0
            ? `Minimum ${minWords.toLocaleString()} word${minWords === 1 ? '' : 's'}`
            : ' '}
        </span>
        <span
          className={
            minWords === 0
              ? 'text-zinc-500'
              : meetsMin
                ? 'text-emerald-400'
                : 'text-amber-400'
          }
        >
          {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
          {minWords > 0 && !meetsMin && (
            <span className="text-zinc-600"> / {minWords.toLocaleString()}</span>
          )}
        </span>
      </div>
    </div>
  );
}

RichTextEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  minWords: PropTypes.number,
  ariaLabel: PropTypes.string,
  id: PropTypes.string,
};

function ToolbarButton({ title, onClick, icon: Icon, active }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={!!active}
      // Preserve the current selection when the user clicks a toolbar
      // button; without this, mousedown on the button blurs the editor
      // and execCommand has nothing to act on.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? 'text-red-400 bg-red-500/[0.08]'
          : 'text-zinc-500 hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

ToolbarButton.propTypes = {
  title: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  icon: PropTypes.elementType.isRequired,
  active: PropTypes.bool,
};

function ToolbarSeparator() {
  return <span className="mx-1 w-px h-4 bg-white/[0.08]" aria-hidden="true" />;
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

export function stripTags(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || '').replace(/\u00a0/g, ' ');
}

export function countWords(html) {
  const text = stripTags(html).replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(' ').length;
}
