import React from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Shared layout for long-form legal documents (Terms of Service, Privacy Policy).
 * Content is passed in as children and rendered inside a scrollable body with
 * consistent typography.
 */
export default function LegalDocumentModal({ open, onOpenChange, title, lastUpdated, children }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl w-[calc(100vw-2rem)] p-0 bg-[#0d0d12] border border-white/[0.08] text-zinc-100 overflow-hidden max-h-[85vh] flex flex-col rounded-2xl shadow-2xl"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent">
          <DialogTitle className="text-xl font-semibold tracking-tight text-white">
            {title}
          </DialogTitle>
          {lastUpdated && (
            <p className="text-xs text-zinc-500 mt-1">
              Last updated: {lastUpdated}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 legal-document-body">
          {children}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.06] bg-black/40 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Eeriecast, LLC</span>
          <a
            href="mailto:brenden@eeriecast.com"
            className="text-zinc-400 hover:text-red-400 transition-colors"
          >
            brenden@eeriecast.com
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

LegalDocumentModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  lastUpdated: PropTypes.string,
  children: PropTypes.node.isRequired,
};

/* ── Typography helpers for legal documents ──────────────────────── */

export const LegalSection = ({ number, title, children }) => (
  <section className="mb-7">
    <h2 className="text-[15px] font-semibold text-white mb-2.5 tracking-tight">
      {number && <span className="text-red-500 mr-2">{number}.</span>}
      {title}
    </h2>
    <div className="space-y-3 text-[13.5px] leading-relaxed text-zinc-300">
      {children}
    </div>
  </section>
);

LegalSection.propTypes = {
  number: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

export const LegalSubheading = ({ children }) => (
  <h3 className="text-sm font-semibold text-zinc-100 mt-4 mb-1.5">{children}</h3>
);

LegalSubheading.propTypes = {
  children: PropTypes.node.isRequired,
};

export const LegalList = ({ children }) => (
  <ul className="list-disc pl-5 space-y-1.5 marker:text-zinc-600">
    {children}
  </ul>
);

LegalList.propTypes = {
  children: PropTypes.node.isRequired,
};
