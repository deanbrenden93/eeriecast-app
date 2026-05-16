import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
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
  Search,
  Feather,
  Radio,
  DollarSign,
  Check,
  Trophy,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import { useSafeBack } from '@/hooks/use-safe-back';
import RichTextEditor, { countWords, stripTags } from '@/components/ui/RichTextEditor';

// Listener story submissions go to the first slot so it's the most
// prominent option in the dropdown — it's the reason most people are
// opening this form from the marketing CTAs on eligible show pages.
export const STORY_SUBMISSION_CATEGORY = 'Submit a Story';
export const STORY_SUBMISSION_SHOWS = [
  'Unexplained Encounters',
  'Tales from the Break Room',
  'Alone in the Woods',
];
const STORY_MIN_WORDS = 500;

// Writing-contest entries. Sits right under the regular story
// submission slot so it has equal prominence in the dropdown while a
// contest window is active. Hide by flipping ``CONTEST_ACTIVE`` to
// false (the constant gates both the dropdown entry and the /contest
// landing page) once the submission window closes — no other code
// changes required to retire the contest.
export const CONTEST_SUBMISSION_CATEGORY = 'Submit to Contest';
export const CONTEST_ACTIVE = true;
export const CONTEST_HEADING = 'Participate in the May Delete After Reading Contest';
// Short lead-in shown in the page header above the form. The full
// guidelines, prize breakdown, and rules live in the in-form details
// panel so entrants see them right next to the fields they fill out.
export const CONTEST_SUBTITLE =
  "We're accepting entries through the end of May 2026 for stories to be produced as episodes of Delete After Reading, our members-only show on Eerie.fm. We're looking for the best new creepypasta out there — the kind that hearkens back to the golden days of internet horror.";
const CONTEST_MIN_WORDS = 2000;

// Inspirations cited in the announcement. Listed inline so it's easy
// to swap out next time we run a themed contest.
const CONTEST_INSPIRATIONS = ['Slenderman', 'The Rake', 'Candle Cove', '1999'];

// Three-tier prize table. Order matters — rendered top-to-bottom in
// the in-form details panel.
const CONTEST_PRIZES = [
  { place: '1st', amount: '$1,000', perk: 'one year of Eerie.fm Premium Membership' },
  { place: '2nd', amount: '$300', perk: 'one month of Eerie.fm Premium Membership' },
  { place: '3rd', amount: '$300', perk: 'one month of Eerie.fm Premium Membership' },
];

// Rules surfaced next to the entry fields. Kept as plain strings so a
// future contest can swap them out without touching the layout.
const CONTEST_RULES = [
  'Stories must be original, unpublished, and written in first-person or found-evidence format.',
  `Entries must be at least ${CONTEST_MIN_WORDS.toLocaleString()} words.`,
  'No AI-written stories — entries will be checked for AI tells and disqualified if found.',
  'Judging is based on atmosphere, originality, voice, and how well the story captures the classic creepypasta feeling.',
  'Only winning stories will be produced as episodes of Delete After Reading. We may contact non-winners separately about producing their story later; your story will not be used in any form unless you win and accept the prize, or you separately agree.',
  'A free or Premium Eerie.fm account is required to participate. No purchase necessary.',
];

// Per-show pay-rate notices — only shown for shows that actually pay
// listener submissions. Rendered inline beneath the show dropdown so
// contributors see it before they write.
const STORY_SHOW_NOTICES = {
  'Tales from the Break Room':
    "We currently pay, only through PayPal, $0.05 per word for accepted and narrated Tales from the Break Room submissions.",
};

// Rights-grant that every story submission must acknowledge before it
// can be sent. Stored verbatim on the submission payload so there's a
// record of exactly what the contributor agreed to.
const RIGHTS_AGREEMENT_TEXT =
  "By submitting, I grant Eeriecast full, perpetual, irrevocable media rights to produce, adapt, edit, narrate, publish, and distribute this story in any format and on any platform, with or without attribution. I retain full ownership of my story and may continue to share, adapt, sell, or otherwise use it however I choose.";

// Contest-specific variant. Names the intended destination show so the
// contributor knows exactly where a winning entry would be produced.
const CONTEST_RIGHTS_AGREEMENT_TEXT =
  "By submitting, I grant Eeriecast full, perpetual, irrevocable media rights to produce, adapt, edit, narrate, publish, and distribute this story — including as an episode of the members-only show Delete After Reading — in any format and on any platform, with or without attribution. I retain full ownership of my story and may continue to share, adapt, sell, or otherwise use it however I choose.";

const CONTACT_CATEGORIES = [
  STORY_SUBMISSION_CATEGORY,
  ...(CONTEST_ACTIVE ? [CONTEST_SUBMISSION_CATEGORY] : []),
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

/* ─── Generic labelled dropdown ──────────────────────────────────────
   Used for both the "Category" picker and the "Submit to Which Show?"
   picker that appears when the story submission category is selected.
   Kept local to this file because it's tightly coupled to the form's
   visual language (red focus ring, black/40 fill) and has no other
   consumers yet. */

LabelledDropdown.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  placeholder: PropTypes.string,
};

function LabelledDropdown({ value, onChange, options, label, icon: Icon, placeholder }) {
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
        {Icon && <Icon className="w-3 h-3" />} {label}
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
        <span className={value ? 'text-white' : 'text-zinc-600'}>{value || placeholder}</span>
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
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    value === opt
                      ? 'text-red-400 bg-red-500/[0.08]'
                      : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {opt}
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

const EMPTY_FORM = {
  name: '',
  email: '',
  category: '',
  show: '',
  subject: '',
  penName: '',
  // PayPal address contributors are paid to. Only surfaced for shows
  // that actually pay (see STORY_SHOW_NOTICES) — required when visible,
  // otherwise ignored entirely.
  paypalEmail: '',
  storyHtml: '',
  message: '',
  // Required acknowledgment that accompanies every Submit-a-Story
  // submission. Stored on the payload so we keep a record of consent.
  rightsAcknowledged: false,
};

ContactForm.propTypes = {
  initialCategory: PropTypes.string,
  initialShow: PropTypes.string,
};

function ContactForm({ initialCategory = '', initialShow = '' }) {
  const { user, isAuthenticated } = useUser();
  const { openAuth } = useAuthModal();

  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    email: user?.email || '',
    category: initialCategory || '',
    show: initialShow || '',
  }));
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const formRef = useRef(null);

  // Keep the email in sync when the auth state settles after the form
  // first mounts (e.g. the user-me response arrives slightly later). We
  // only overwrite the field while it's untouched to avoid stomping on
  // a value the user typed manually while unauthenticated.
  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;
    setForm((prev) => (prev.email ? prev : { ...prev, email: user.email }));
  }, [isAuthenticated, user?.email]);

  // Honor prefill params from the show pages: set the category/show
  // once when the page opens. Subsequent user edits aren't overwritten.
  useEffect(() => {
    if (!initialCategory && !initialShow) return;
    setForm((prev) => ({
      ...prev,
      category: prev.category || initialCategory || '',
      show: prev.show || initialShow || '',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isStory = form.category === STORY_SUBMISSION_CATEGORY;
  const isContest = form.category === CONTEST_SUBMISSION_CATEGORY;
  // Either of the long-form branches uses the rich text editor and the
  // word-count gate, so we can share the count + several render paths.
  const isLongForm = isStory || isContest;
  const minWords = isContest ? CONTEST_MIN_WORDS : STORY_MIN_WORDS;
  const storyWordCount = useMemo(
    () => (isLongForm ? countWords(form.storyHtml) : 0),
    [isLongForm, form.storyHtml],
  );

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Contest entries require an authenticated account so we can follow
  // up with winners. When an unauthenticated user selects the contest
  // category — whether from the dropdown or via the /contest deep-link
  // — pop the auth modal immediately. If they dismiss it they can
  // still see and fill out the form; the submit handler re-prompts.
  useEffect(() => {
    if (isContest && !isAuthenticated) {
      openAuth(
        'login',
        null,
        'Sign in or create a free account to enter the contest. We need an account on file to contact winners and award prizes.',
      );
    }
    // ``openAuth`` identity changes whenever the modal opens, so depending
    // on it would re-fire this effect every time the modal toggles. The
    // intent here is "fire when the user enters/exits the contest path or
    // when their auth state changes," which the two listed deps capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isContest, isAuthenticated]);

  // Loose email sanity-check (the server / PayPal will do the real
  // validation). Just ensures we didn't get a blank string or a value
  // missing the @ sign, which is by far the most common typo.
  const looksLikeEmail = (v) =>
    typeof v === 'string' && /\S+@\S+\.\S+/.test(v.trim());

  // Derived validation. Story + contest submissions have stricter
  // rules; other categories keep the original "name + email + message"
  // minimum.
  const validation = useMemo(() => {
    if (isContest) {
      // Contest is account-gated, so authentication is part of the
      // validation surface: the submit button stays disabled until
      // the user has signed in. Story submissions historically allow
      // anonymous submission with a typed email, so they don't carry
      // this guard.
      return {
        auth: isAuthenticated,
        name: !!form.name.trim(),
        email: !!form.email.trim(),
        category: !!form.category,
        storyTitle: !!form.subject.trim(),
        penName: !!form.penName.trim(),
        paypal: looksLikeEmail(form.paypalEmail),
        storyText: storyWordCount >= CONTEST_MIN_WORDS,
        rights: form.rightsAcknowledged === true,
      };
    }
    if (isStory) {
      const showPays = !!STORY_SHOW_NOTICES[form.show];
      return {
        name: !!form.name.trim(),
        email: !!form.email.trim(),
        category: !!form.category,
        show: !!form.show && STORY_SUBMISSION_SHOWS.includes(form.show),
        storyTitle: !!form.subject.trim(),
        penName: !!form.penName.trim(),
        paypal: showPays ? looksLikeEmail(form.paypalEmail) : true,
        storyText: storyWordCount >= STORY_MIN_WORDS,
        rights: form.rightsAcknowledged === true,
      };
    }
    return {
      name: !!form.name.trim(),
      email: !!form.email.trim(),
      category: !!form.category,
      message: !!form.message.trim(),
    };
  }, [isStory, isContest, isAuthenticated, form, storyWordCount]);

  const canSubmit = Object.values(validation).every(Boolean);

  const resetAfterSuccess = () => {
    setForm({
      ...EMPTY_FORM,
      // Keep the email populated on a fresh "send another" if we're logged in.
      email: user?.email || '',
    });
    setAttemptedSubmit(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    // Contest entries require an account; if the user dismissed the
    // auth modal earlier, surface it again on submit instead of
    // silently doing nothing.
    if (isContest && !isAuthenticated) {
      openAuth(
        'login',
        null,
        'Sign in or create a free account to enter the contest.',
      );
      return;
    }
    if (!canSubmit) return;
    setStatus('sending');
    try {
      const basePayload = {
        name: form.name,
        email: form.email,
        category: form.category || 'Uncategorized',
      };
      let payload;
      if (isContest) {
        const storyPlain = stripTags(form.storyHtml).trim();
        payload = {
          ...basePayload,
          contest: 'May 2026 Delete After Reading',
          // Echo the user id so the inbox entry can be cross-referenced
          // with the account if we need to follow up about prizes.
          user_id: user?.id || '',
          username: user?.username || '',
          story_title: form.subject,
          pen_name: form.penName,
          story_text_html: form.storyHtml,
          story_text: storyPlain,
          word_count: storyWordCount,
          paypal_email: form.paypalEmail.trim(),
          rights_acknowledged: form.rightsAcknowledged === true ? 'yes' : 'no',
          rights_agreement: CONTEST_RIGHTS_AGREEMENT_TEXT,
          _subject: `Eeriecast [Contest Entry — Delete After Reading]: ${form.subject}`,
        };
      } else if (isStory) {
        const storyPlain = stripTags(form.storyHtml).trim();
        const showPays = !!STORY_SHOW_NOTICES[form.show];
        payload = {
          ...basePayload,
          show: form.show,
          story_title: form.subject,
          pen_name: form.penName,
          story_text_html: form.storyHtml,
          story_text: storyPlain,
          word_count: storyWordCount,
          // Only attach the PayPal email for paid shows; keeps the
          // inbox entry clean for unpaid submissions.
          ...(showPays ? { paypal_email: form.paypalEmail.trim() } : {}),
          rights_acknowledged: form.rightsAcknowledged === true ? 'yes' : 'no',
          rights_agreement: RIGHTS_AGREEMENT_TEXT,
          _subject: `Eeriecast [Story Submission — ${form.show}]: ${form.subject}`,
        };
      } else {
        payload = {
          ...basePayload,
          subject: form.subject || '(no subject)',
          message: form.message,
          _subject: `Eeriecast [${form.category || 'General'}]: ${form.subject || 'New Message'}`,
        };
      }

      const res = await fetch('https://formspree.io/f/mnjbjdpr', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus('sent');
        resetAfterSuccess();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  // Visual error hint helper — only surfaces after the user has tried
  // submitting at least once, so the form doesn't scream red on load.
  const errorRing = (ok) =>
    attemptedSubmit && !ok
      ? 'border-red-500/50 ring-1 ring-red-500/25'
      : 'border-white/[0.08] hover:border-white/[0.12] focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20';

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
          <h3 className="text-lg font-semibold text-white mb-2">
            {isContest ? 'Contest Entry Received' : isStory ? 'Story Submitted' : 'Message Sent'}
          </h3>
          <p className="text-sm text-zinc-400 max-w-xs mb-6">
            {isContest
              ? "Thanks for entering. We'll review every entry after submissions close at the end of May 2026 and reach out to the three winners directly."
              : isStory
                ? 'Thanks for sharing your story. Our team will review it and reach out if it\'s a fit for the show.'
                : "Thanks for reaching out. We'll get back to you as soon as possible."}
          </p>
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
          noValidate
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
              className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-all ${errorRing(validation.name)}`}
            />
          </div>

          {/* Email — auto-filled from the logged-in user's account */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
              <Mail className="w-3 h-3" /> Email
              {isAuthenticated && user?.email && (
                <span className="text-zinc-700 font-normal normal-case tracking-normal">(from your account)</span>
              )}
            </label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              placeholder="your@email.com"
              className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-all ${errorRing(validation.email)}`}
            />
          </div>

          {/* Category */}
          <LabelledDropdown
            value={form.category}
            onChange={(val) => setForm({ ...form, category: val })}
            options={CONTACT_CATEGORIES}
            label="Category"
            icon={Tag}
            placeholder="Select a category…"
          />

          {/* Submit-a-Story branch ----------------------------------- */}
          {isStory && (
            <>
              <LabelledDropdown
                value={form.show}
                onChange={(val) => setForm({ ...form, show: val })}
                options={STORY_SUBMISSION_SHOWS}
                label="Submit to Which Show?"
                icon={Radio}
                placeholder="Pick a show…"
              />

              {/* Show-specific pay-rate notice. Only rendered when the
                  selected show has an entry in STORY_SHOW_NOTICES so
                  other shows don't accidentally inherit Tales-from-
                  the-Break-Room's terms. */}
              {STORY_SHOW_NOTICES[form.show] && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                  className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3"
                  role="note"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-emerald-100">
                    {STORY_SHOW_NOTICES[form.show]}
                  </p>
                </motion.div>
              )}

              {/* PayPal email — only collected for shows that pay. We
                  key off STORY_SHOW_NOTICES so adding a new paying show
                  later (and its rate notice) automatically brings this
                  field along with it. */}
              {STORY_SHOW_NOTICES[form.show] && (
                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
                    <DollarSign className="w-3 h-3" /> PayPal Email
                    <span className="text-zinc-700 font-normal normal-case tracking-normal">
                      (where payment would be sent)
                    </span>
                  </label>
                  <input
                    name="paypalEmail"
                    type="email"
                    value={form.paypalEmail}
                    onChange={handleChange}
                    autoComplete="email"
                    placeholder="paypal@example.com"
                    className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-all ${errorRing(validation.paypal)}`}
                  />
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
                  <FileText className="w-3 h-3" /> Story Title
                </label>
                <input
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  placeholder="Give your story a name"
                  className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-all ${errorRing(validation.storyTitle)}`}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
                  <Feather className="w-3 h-3" /> Pen Name
                </label>
                <input
                  name="penName"
                  value={form.penName}
                  onChange={handleChange}
                  placeholder="The name you'd like us to read on-air"
                  className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-all ${errorRing(validation.penName)}`}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
                  <MessageSquare className="w-3 h-3" /> Story Text
                </label>
                <RichTextEditor
                  value={form.storyHtml}
                  onChange={(html) => setForm((prev) => ({ ...prev, storyHtml: html }))}
                  placeholder="Tell the tale exactly how you'd want it narrated…"
                  minWords={STORY_MIN_WORDS}
                  ariaLabel="Story text"
                  id="story-text-editor"
                />
                {attemptedSubmit && !validation.storyText && (
                  <p className="mt-2 text-[11px] text-red-400">
                    Stories need at least {STORY_MIN_WORDS.toLocaleString()} words before they can be submitted.
                  </p>
                )}
              </div>

              {/* Rights-grant acknowledgment. Required before every
                  story submission so we have a consent record. */}
              <label
                className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition-colors ${
                  form.rightsAcknowledged
                    ? 'border-red-500/30 bg-red-500/[0.06]'
                    : attemptedSubmit && !validation.rights
                      ? 'border-red-500/50 bg-red-500/[0.04] ring-1 ring-red-500/20'
                      : 'border-white/[0.08] bg-black/40 hover:border-white/[0.12]'
                }`}
              >
                <input
                  type="checkbox"
                  name="rightsAcknowledged"
                  checked={form.rightsAcknowledged}
                  onChange={(e) => setForm((prev) => ({ ...prev, rightsAcknowledged: e.target.checked }))}
                  className="sr-only peer"
                  aria-describedby="rights-agreement-text"
                />
                <span
                  aria-hidden="true"
                  className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                    form.rightsAcknowledged
                      ? 'border-red-500/70 bg-red-600/90 text-white'
                      : 'border-white/[0.15] bg-black/50 text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3" strokeWidth={3} />
                </span>
                <span id="rights-agreement-text" className="text-[12px] leading-relaxed text-zinc-300">
                  {RIGHTS_AGREEMENT_TEXT}
                </span>
              </label>
              {attemptedSubmit && !validation.rights && (
                <p className="-mt-2 text-[11px] text-red-400">
                  Please acknowledge the submission terms to continue.
                </p>
              )}
            </>
          )}

          {/* Submit-to-Contest branch --------------------------------- */}
          {isContest && (
            <>
              {/* Full contest details. Sits at the top of the contest
                  branch so the prize table, theme guidance, and rules
                  are visible right next to the fields the entrant is
                  about to fill out. Long but worth the screen-space:
                  these are the questions writers will scroll back up
                  to re-check while drafting their story. */}
              <motion.section
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/[0.08] to-amber-500/[0.02] overflow-hidden"
                aria-labelledby="contest-details-heading"
              >
                {/* Header strip */}
                <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-amber-500/15">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/80">
                      Contest Details
                    </p>
                    <h3 id="contest-details-heading" className="text-[15px] font-semibold text-amber-50 mt-0.5">
                      May Delete After Reading Contest
                    </h3>
                  </div>
                </div>

                {/* Theme + inspirations */}
                <div className="px-5 pt-4 pb-2 text-[12.5px] leading-relaxed text-amber-100/90">
                  <p>
                    We&apos;re looking for the best new creepypasta out there — the kind that
                    hearkens back to the golden days of internet horror. Think{' '}
                    {CONTEST_INSPIRATIONS.map((name, i) => (
                      <span key={name}>
                        <em className="not-italic text-amber-50 font-medium">{name}</em>
                        {i < CONTEST_INSPIRATIONS.length - 2
                          ? ', '
                          : i === CONTEST_INSPIRATIONS.length - 2
                            ? ', or '
                            : '.'}
                      </span>
                    ))}{' '}
                    Our judges will select three winners based on atmosphere, originality,
                    voice, and how well the story captures that classic creepypasta feeling.
                  </p>
                </div>

                {/* Prize ladder */}
                <div className="px-5 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/70 mb-2">
                    Prizes
                  </p>
                  <ul className="space-y-1.5">
                    {CONTEST_PRIZES.map((p, i) => (
                      <li
                        key={p.place}
                        className="flex items-center gap-3 rounded-lg bg-black/30 border border-amber-500/15 px-3 py-2.5"
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold tracking-wide flex-shrink-0 ${
                            i === 0
                              ? 'bg-amber-400/25 border border-amber-300/50 text-amber-100'
                              : 'bg-amber-500/10 border border-amber-500/25 text-amber-200/90'
                          }`}
                        >
                          {p.place.replace(/[a-z]/g, '')}
                        </span>
                        <span className="text-[12.5px] leading-snug text-amber-50">
                          <span className="font-semibold">{p.place} place</span>
                          <span className="text-amber-100/80"> — {p.amount} plus {p.perk}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Rules */}
                <div className="px-5 pt-4 pb-5 mt-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/70 mb-2">
                    Rules
                  </p>
                  <ul className="space-y-2">
                    {CONTEST_RULES.map((rule) => (
                      <li key={rule} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-amber-100/90">
                        <Check className="w-3.5 h-3.5 mt-0.5 text-amber-300 flex-shrink-0" strokeWidth={3} />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Deadline footer */}
                <div className="px-5 py-3 border-t border-amber-500/15 bg-black/20 text-[11.5px] text-amber-200/80 text-center">
                  Submissions close at the end of May 2026.
                </div>
              </motion.section>

              {/* Not-signed-in nudge. Lives inside the form so it's
                  obvious why the submit button is disabled. */}
              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={() =>
                    openAuth(
                      'login',
                      null,
                      'Sign in or create a free account to enter the contest.',
                    )
                  }
                  className="w-full flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.06] hover:bg-red-500/[0.1] px-4 py-3 text-left transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                    <LogIn className="w-3.5 h-3.5 text-red-300" />
                  </div>
                  <div className="text-[12.5px] leading-relaxed text-red-100">
                    <p className="font-semibold text-red-50">Sign in to enter</p>
                    <p className="text-red-200/80">
                      Contest entries require an Eeriecast account so we can contact winners.
                    </p>
                  </div>
                </button>
              )}

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
                  <DollarSign className="w-3 h-3" /> PayPal Email
                  <span className="text-zinc-700 font-normal normal-case tracking-normal">
                    (where prize money would be sent)
                  </span>
                </label>
                <input
                  name="paypalEmail"
                  type="email"
                  value={form.paypalEmail}
                  onChange={handleChange}
                  autoComplete="email"
                  placeholder="paypal@example.com"
                  className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-all ${errorRing(validation.paypal)}`}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
                  <FileText className="w-3 h-3" /> Story Title
                </label>
                <input
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  placeholder="Give your story a name"
                  className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-all ${errorRing(validation.storyTitle)}`}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
                  <Feather className="w-3 h-3" /> Pen Name
                </label>
                <input
                  name="penName"
                  value={form.penName}
                  onChange={handleChange}
                  placeholder="The name you'd like us to read on-air"
                  className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-all ${errorRing(validation.penName)}`}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
                  <MessageSquare className="w-3 h-3" /> Story Text
                </label>
                <RichTextEditor
                  value={form.storyHtml}
                  onChange={(html) => setForm((prev) => ({ ...prev, storyHtml: html }))}
                  placeholder="Tell the tale exactly how you'd want it narrated…"
                  minWords={CONTEST_MIN_WORDS}
                  ariaLabel="Contest entry text"
                  id="contest-text-editor"
                />
                {attemptedSubmit && !validation.storyText && (
                  <p className="mt-2 text-[11px] text-red-400">
                    Contest entries need at least {CONTEST_MIN_WORDS.toLocaleString()} words before they can be submitted.
                  </p>
                )}
              </div>

              <label
                className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition-colors ${
                  form.rightsAcknowledged
                    ? 'border-red-500/30 bg-red-500/[0.06]'
                    : attemptedSubmit && !validation.rights
                      ? 'border-red-500/50 bg-red-500/[0.04] ring-1 ring-red-500/20'
                      : 'border-white/[0.08] bg-black/40 hover:border-white/[0.12]'
                }`}
              >
                <input
                  type="checkbox"
                  name="rightsAcknowledged"
                  checked={form.rightsAcknowledged}
                  onChange={(e) => setForm((prev) => ({ ...prev, rightsAcknowledged: e.target.checked }))}
                  className="sr-only peer"
                  aria-describedby="contest-rights-agreement-text"
                />
                <span
                  aria-hidden="true"
                  className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                    form.rightsAcknowledged
                      ? 'border-red-500/70 bg-red-600/90 text-white'
                      : 'border-white/[0.15] bg-black/50 text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3" strokeWidth={3} />
                </span>
                <span id="contest-rights-agreement-text" className="text-[12px] leading-relaxed text-zinc-300">
                  {CONTEST_RIGHTS_AGREEMENT_TEXT}
                </span>
              </label>
              {attemptedSubmit && !validation.rights && (
                <p className="-mt-2 text-[11px] text-red-400">
                  Please acknowledge the submission terms to continue.
                </p>
              )}
            </>
          )}

          {/* Standard (non-story, non-contest) branch ----------------- */}
          {!isStory && !isContest && (
            <>
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
                  className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-all resize-none ${errorRing(validation.message)}`}
                />
              </div>
            </>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={status === 'sending'}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/20"
          >
            {status === 'sending' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                {isContest ? <Trophy className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {isContest
                  ? (isAuthenticated ? 'Submit Contest Entry' : 'Sign In to Submit')
                  : isStory
                    ? 'Submit Story'
                    : 'Send Message'}
              </>
            )}
          </Button>

          {status === 'error' && (
            <p className="text-xs text-red-400 text-center">Something went wrong. Please try again or email us directly.</p>
          )}

          <p className="text-[11px] text-zinc-600 text-center">
            {isContest
              ? "Contest entries are reviewed after submissions close at the end of May 2026. Winners will be notified by email."
              : isStory
                ? 'Story submissions are reviewed on a rolling basis. We\'ll reach out if it\'s selected.'
                : 'We typically respond within 24–48 hours.'}
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
  const safeGoBack = useSafeBack();
  const location = useLocation();

  // Deep-link support: the "Submit a Story" buttons on eligible show
  // pages open this screen with the Contact tab active and the form
  // pre-filled via ?tab=contact&category=…&show=… so the listener
  // lands exactly where they need to be.
  const { initialTab, initialCategory, initialShow } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') === 'contact' ? 'contact' : 'faq';
    const category = params.get('category') || '';
    const rawShow = params.get('show') || '';
    // Only honor the show param when it maps to one of the allowed
    // story shows; anything else is silently dropped so we never set an
    // unrecognized value into the dropdown.
    const show = STORY_SUBMISSION_SHOWS.includes(rawShow) ? rawShow : '';
    return { initialTab: tab, initialCategory: category, initialShow: show };
  }, [location.search]);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [closing, setClosing] = useState(false);
  const [faqQuery, setFaqQuery] = useState('');

  const handleClose = () => {
    setClosing(true);
    // Delay matches the slide-out animation; `useSafeBack` then either
    // pops the in-app history entry or redirects to the Podcasts home
    // when this screen was reached via a direct / deep link, so the
    // X button never bounces the user off-site.
    setTimeout(safeGoBack, 350);
  };

  const tabs = [
    { id: 'faq', label: 'FAQ', icon: HelpCircle },
    { id: 'contact', label: 'Contact', icon: MessageSquare },
  ];

  // Client-side filter: match question or answer, collapse empty categories.
  const filteredFaq = (() => {
    const q = faqQuery.trim().toLowerCase();
    if (!q) return FAQ_ITEMS;
    return FAQ_ITEMS
      .map((section) => ({
        ...section,
        questions: section.questions.filter(({ q: qn, a: an }) =>
          qn.toLowerCase().includes(q) || an.toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.questions.length > 0);
  })();
  const totalMatches = filteredFaq.reduce((n, s) => n + s.questions.length, 0);

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
        <div className="relative h-full overflow-y-auto bg-[#08080e] scrollbar-none">
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
                  {/* Search */}
                  <div className="relative mb-6">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                    <input
                      type="search"
                      value={faqQuery}
                      onChange={(e) => setFaqQuery(e.target.value)}
                      placeholder="Search FAQs…"
                      className="w-full pl-10 pr-9 py-3 rounded-xl bg-black/40 border border-white/[0.08] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 transition-all"
                    />
                    {faqQuery && (
                      <button
                        type="button"
                        onClick={() => setFaqQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {faqQuery && (
                    <p className="text-xs text-zinc-500 mb-4 px-1">
                      {totalMatches === 0
                        ? 'No results match your search.'
                        : `${totalMatches} match${totalMatches === 1 ? '' : 'es'} for "${faqQuery}"`}
                    </p>
                  )}

                  {filteredFaq.map((section, sIdx) => (
                    <motion.div
                      key={section.category}
                      className="mb-8"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: faqQuery ? 0 : 0.28 + sIdx * 0.06, duration: 0.35 }}
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
                      <h2 className="text-lg font-semibold text-white mb-1">
                        {initialCategory === CONTEST_SUBMISSION_CATEGORY
                          ? CONTEST_HEADING
                          : initialCategory === STORY_SUBMISSION_CATEGORY
                            ? 'Submit Your Story'
                            : 'Get in Touch'}
                      </h2>
                      <p className="text-sm text-zinc-500">
                        {initialCategory === CONTEST_SUBMISSION_CATEGORY
                          ? CONTEST_SUBTITLE
                          : initialCategory === STORY_SUBMISSION_CATEGORY
                            ? "Share an original story with one of our narrators. Selected submissions may be read on the show."
                            : "Have a question, bug report, or even have a story you want to submit? We'd love to hear from you."}
                      </p>
                    </div>
                    <ContactForm
                      initialCategory={initialCategory}
                      initialShow={initialShow}
                    />
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
