import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  HelpCircle,
  MessageSquare,
  ChevronDown,
  Send,
  User,
  Mail,
  FileText,
  CheckCircle2,
  Loader2,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const CONTACT_CATEGORIES = [
  'Podcast Issue',
  'Audiobook / E-Reader Issue',
  'Playback / Audio Problem',
  'Membership Issue',
  'Billing & Payments',
  'Report Ads in Member Episode',
  'Account & Login Help',
  'Feature Request',
  'Bug Report',
  'General Question',
  'Other',
];

/* ═══════════════════════════════════════════════════════════════════
   FAQ DATA
   ═══════════════════════════════════════════════════════════════════ */

const FAQ_ITEMS = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'What is Eeriecast?',
        a: 'Eeriecast is a horror and supernatural audio network featuring over 1,300 podcast episodes, original audiobooks, and exclusive members-only content. Think of it as your home for all things eerie — from creepypastas to true paranormal investigations.',
      },
      {
        q: 'Is Eeriecast free to use?',
        a: 'Yes! You can browse all shows, listen to non-exclusive episodes, follow shows, and build playlists on the free tier. Premium membership unlocks exclusive shows, full audiobook access, unlimited favorites, ad-free listening, and more.',
      },
      {
        q: 'How do I find new shows to listen to?',
        a: 'Head to the Podcasts tab to browse our full catalog, filter by category (paranormal, true crime, fiction, and more), or check the Trending section on the Discover page. The home screen also highlights featured and new content.',
      },
    ],
  },
  {
    category: 'Playback & Audio',
    questions: [
      {
        q: 'How do I add episodes to my queue?',
        a: 'Tap the three-dot menu (⋮) on any episode card and select "Add to Queue" or "Play Next." If nothing is currently playing, the episode will begin playback immediately.',
      },
      {
        q: 'Can I change the playback speed?',
        a: 'Yes — go to Settings → Playback and choose from 0.5x to 2x speed. Your preferred speed is remembered across sessions.',
      },
      {
        q: 'Why does the player stop after one episode?',
        a: 'Make sure "Auto-play Next Episode" is enabled in Settings → Playback. When turned on, the player will automatically continue to the next episode in your queue.',
      },
      {
        q: 'My audio won\'t play — what should I do?',
        a: 'First, check your internet connection. If streaming works elsewhere, try closing and reopening the app. Some exclusive episodes are only available to premium members — you\'ll see a lock icon on those.',
      },
    ],
  },
  {
    category: 'Library & Content',
    questions: [
      {
        q: 'How do I follow a show?',
        a: 'Open any show\'s page and tap the "Follow" button near the top. Followed shows appear in your Library under the "Following" tab.',
      },
      {
        q: 'What\'s the difference between Favorites and Following?',
        a: 'Following a show adds it to your library so you can quickly access new episodes. Favoriting is for individual episodes you love — think of it as bookmarking your best listens. Free accounts have a favorites limit; premium members get unlimited.',
      },
      {
        q: 'How does listening history work?',
        a: 'Eeriecast automatically tracks every episode you listen to. Visit Library → History to see your recent listens sorted by most recent. Your progress is saved so you can pick up right where you left off.',
      },
      {
        q: 'Can I create custom playlists?',
        a: 'Yes! Use the three-dot menu on any episode to add it to an existing playlist or create a new one. Free users can create up to 3 playlists; premium members get unlimited playlists.',
      },
    ],
  },
  {
    category: 'Audiobooks & E-Reader',
    questions: [
      {
        q: 'How do I read audiobooks in the app?',
        a: 'Go to the Books tab, select a book, and tap "Read Book" on any chapter. This opens our built-in e-reader with customizable fonts, text size, line spacing, and page-turn animations.',
      },
      {
        q: 'Can I listen to audiobooks instead of reading them?',
        a: 'Absolutely. Each chapter has a play button — tap it to listen to the professionally narrated audio version. You can switch between reading and listening at any time.',
      },
      {
        q: 'Are all audiobook chapters free?',
        a: 'Each book has a free sample chapter so you can try before you commit. Full access to every chapter requires a premium membership.',
      },
    ],
  },
  {
    category: 'Premium Membership',
    questions: [
      {
        q: 'What do I get with Premium?',
        a: 'Premium unlocks: all exclusive members-only shows, every audiobook chapter, unlimited playlists, unlimited favorites, ad-free listening, and access to the full 1,300+ episode catalog with no restrictions.',
      },
      {
        q: 'How do I upgrade to Premium?',
        a: 'Tap the "Go Premium" option in your profile menu, or visit the Premium page from Settings. You\'ll see our plans and can start a free trial from there.',
      },
      {
        q: 'Can I cancel my membership?',
        a: 'Yes, you can cancel anytime. Your premium access will continue until the end of your current billing period. No hidden fees or cancellation penalties.',
      },
    ],
  },
  {
    category: 'Account & Settings',
    questions: [
      {
        q: 'How do I change my audio quality settings?',
        a: 'Go to Settings → Audio Quality to choose between High (320kbps), Standard (128kbps), and Low (64kbps) streaming quality.',
      },
      {
        q: 'How do I clear my listening history?',
        a: 'Visit Settings → Data & Privacy and tap "Clear Listening History." This cannot be undone.',
      },
      {
        q: 'I forgot my password — how do I reset it?',
        a: 'On the login screen, tap "Forgot Password" and enter your email address. You\'ll receive a reset link within a few minutes. Check your spam folder if you don\'t see it.',
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════
   FAQ ACCORDION ITEM
   ═══════════════════════════════════════════════════════════════════ */

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/[0.05] last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-4 px-1 text-left group"
      >
        <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{question}</span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <p className="text-sm text-zinc-400 leading-relaxed pb-4 px-1">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Custom category dropdown ────────────────────────────────────── */

function CategoryDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
        <Tag className="w-3 h-3" /> Category
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between bg-black/40 border rounded-xl px-4 py-3 text-sm text-left transition-all ${
          open
            ? 'border-red-500/40 ring-1 ring-red-500/20'
            : 'border-white/[0.08] hover:border-white/[0.12]'
        }`}
      >
        <span className={value ? 'text-white' : 'text-zinc-600'}>{value || 'Select a category…'}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute z-50 left-0 right-0 mt-1.5 rounded-xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden py-1"
          >
            <div className="max-h-56 overflow-y-auto scrollbar-thin">
              {CONTACT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { onChange(cat); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    value === cat
                      ? 'text-red-400 bg-red-500/[0.08]'
                      : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CONTACT FORM
   ═══════════════════════════════════════════════════════════════════ */

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', category: '', subject: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const formRef = useRef(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const canSubmit = form.name.trim() && form.email.trim() && form.message.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus('sending');
    try {
      const res = await fetch('https://formspree.io/f/mnjbjdpr', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          category: form.category || 'Uncategorized',
          subject: form.subject || '(no subject)',
          message: form.message,
          _subject: `Eeriecast [${form.category || 'General'}]: ${form.subject || 'New Message'}`,
        }),
      });
      if (res.ok) {
        setStatus('sent');
        setForm({ name: '', email: '', category: '', subject: '', message: '' });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <AnimatePresence mode="wait">
    {status === 'sent' ? (
      <motion.div
        key="success"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-7 h-7 text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Message Sent</h3>
        <p className="text-sm text-zinc-400 max-w-xs mb-6">Thanks for reaching out. We'll get back to you as soon as possible.</p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          Send another message
        </button>
      </motion.div>
    ) : (
    <motion.form
      key="form"
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Name */}
      <div>
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
          <User className="w-3 h-3" /> Name
        </label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          autoComplete="name"
          placeholder="Your name"
          className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 transition-all"
        />
      </div>

      {/* Email */}
      <div>
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
          <Mail className="w-3 h-3" /> Email
        </label>
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
          placeholder="your@email.com"
          className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 transition-all"
        />
      </div>

      {/* Category */}
      <CategoryDropdown
        value={form.category}
        onChange={(val) => setForm({ ...form, category: val })}
      />

      {/* Subject */}
      <div>
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
          <FileText className="w-3 h-3" /> Subject
          <span className="text-zinc-700 font-normal normal-case tracking-normal">(optional)</span>
        </label>
        <input
          name="subject"
          value={form.subject}
          onChange={handleChange}
          placeholder="What's this about?"
          className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 transition-all"
        />
      </div>

      {/* Message */}
      <div>
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
          <MessageSquare className="w-3 h-3" /> Message
        </label>
        <textarea
          name="message"
          value={form.message}
          onChange={handleChange}
          rows={5}
          placeholder="Tell us what's on your mind..."
          className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 transition-all resize-none"
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={!canSubmit || status === 'sending'}
        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/20"
      >
        {status === 'sending' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send Message
          </>
        )}
      </Button>

      {status === 'error' && (
        <p className="text-xs text-red-400 text-center">Something went wrong. Please try again or email us directly.</p>
      )}

      <p className="text-[11px] text-zinc-600 text-center">
        We typically respond within 24–48 hours.
      </p>
    </motion.form>
    )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HELP SCREEN (full overlay)
   ═══════════════════════════════════════════════════════════════════ */

export default function Help() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('faq');
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => navigate(-1), 350);
  };

  const tabs = [
    { id: 'faq', label: 'FAQ', icon: HelpCircle },
    { id: 'contact', label: 'Contact', icon: MessageSquare },
  ];

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-[#08080e]"
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      />

      {/* Panel */}
      <motion.div
        className="relative h-full overflow-hidden"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: closing ? '100%' : 0, opacity: closing ? 0 : 1 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Background accent glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.05),_transparent_70%)] pointer-events-none" />

        {/* Scrollable content */}
        <div className="relative h-full overflow-y-auto bg-[#08080e]">
          <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-6 pb-24">

            {/* Top bar */}
            <motion.div
              className="flex items-center justify-between mb-8"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Help Center</h1>
                  <p className="text-xs text-zinc-600 mt-0.5">FAQs and support</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </motion.div>

            {/* Tab switcher */}
            <motion.div
              className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.35 }}
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/[0.07] text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </motion.div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              {activeTab === 'faq' && (
                <motion.div
                  key="faq"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {FAQ_ITEMS.map((section, sIdx) => (
                    <motion.div
                      key={section.category}
                      className="mb-8"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.28 + sIdx * 0.06, duration: 0.35 }}
                    >
                      <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-600 mb-3 px-1">
                        {section.category}
                      </h2>
                      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-sm overflow-hidden px-5">
                        {section.questions.map((item) => (
                          <FaqItem key={item.q} question={item.q} answer={item.a} />
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'contact' && (
                <motion.div
                  key="contact"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-sm overflow-hidden p-6">
                    <div className="mb-6">
                      <h2 className="text-lg font-semibold text-white mb-1">Get in Touch</h2>
                      <p className="text-sm text-zinc-500">Have a question, bug report, or just want to say hi? We'd love to hear from you.</p>
                    </div>
                    <ContactForm />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
