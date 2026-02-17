'use client';

import {
  EMAILJS_BUG_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY,
  EMAILJS_SERVICE_ID,
} from '@/lib/emailjsConfig';
import emailjs from 'emailjs-com';
import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { GAME_CARDS } from '../config/games';
import {
  parseGameDeckBugContext,
  serializeGameDeckBugContext,
  type GameDeckBugContext,
} from '../utils/gameDeckBugContext';

const MAX_SCREENSHOTS = 3;
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

type BugFormState = {
  playerName: string;
  email: string;
  game: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reportType: 'bug' | 'visual' | 'performance' | 'controls' | 'other';
  frequency: 'always' | 'often' | 'sometimes' | 'rare';
  platform: 'desktop' | 'mobile' | 'tablet' | 'other';
  browser: string;
  summary: string;
  steps: string;
  expected: string;
  actual: string;
  sessionId: string;
  _honeypot: string;
};

type Feedback = {
  type: 'idle' | 'success' | 'error';
  message: string;
};

const DEFAULT_FORM_STATE: BugFormState = {
  playerName: '',
  email: '',
  game: '',
  severity: 'medium',
  reportType: 'bug',
  frequency: 'often',
  platform: 'desktop',
  browser: '',
  summary: '',
  steps: '',
  expected: '',
  actual: '',
  sessionId: '',
  _honeypot: '',
};

const headingFont = '"Press Start 2P", "Courier New", monospace';

const formatLabel = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export default function BugReportPage() {
  const [gameParam, setGameParam] = useState<string | null>(null);
  const [deckContext, setDeckContext] = useState<GameDeckBugContext | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<BugFormState>(DEFAULT_FORM_STATE);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({
    type: 'idle',
    message: '',
  });
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  const selectedGameOption = useMemo(
    () => GAME_CARDS.find((game) => game.id === gameParam),
    [gameParam]
  );
  const activeGameOption = useMemo(
    () => GAME_CARDS.find((game) => game.id === formData.game),
    [formData.game]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search);
    const game = search.get('game');
    const parsedDeckContext = parseGameDeckBugContext(search.get('deckContext'));
    const preferredGame = parsedDeckContext?.gameId ?? game;

    setGameParam(preferredGame);

    if (parsedDeckContext) {
      setDeckContext(parsedDeckContext);

      const stateLabel = parsedDeckContext.paused
        ? 'paused'
        : parsedDeckContext.hasStarted
          ? 'live'
          : 'ready';
      const sessionSeed = [
        parsedDeckContext.sessionTag,
        `score=${parsedDeckContext.score}`,
        parsedDeckContext.mode ? `mode=${formatLabel(parsedDeckContext.mode)}` : '',
        parsedDeckContext.health !== undefined
          ? `health=${parsedDeckContext.health}%`
          : '',
        `state=${stateLabel}`,
      ]
        .filter(Boolean)
        .join(' | ');
      const autoSteps = [
        'Auto-captured by Game Deck context:',
        `- Tag: ${parsedDeckContext.contextTag}`,
        `- Route: ${parsedDeckContext.route}`,
        `- Captured: ${parsedDeckContext.capturedAt}`,
        '',
        'Reproduction details:',
      ].join('\n');

      setFormData((prev) => ({
        ...prev,
        game: parsedDeckContext.gameId,
        sessionId: prev.sessionId || sessionSeed,
        summary:
          prev.summary ||
          `${parsedDeckContext.contextTag} Issue in ${parsedDeckContext.gameTitle}`,
        steps: prev.steps || autoSteps,
      }));
    }
  }, []);

  useEffect(() => {
    if (selectedGameOption?.id) {
      setFormData((prev) => ({ ...prev, game: selectedGameOption.id }));
    }
  }, [selectedGameOption]);

  useEffect(
    () => () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    },
    [previewUrls]
  );

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setFormData((prev) =>
      prev.browser ? prev : { ...prev, browser: navigator.userAgent }
    );
  }, []);

  const screenshotNames = screenshots.map((file) => file.name).join(', ');
  const serializedDeckContext = useMemo(
    () => (deckContext ? serializeGameDeckBugContext(deckContext) : ''),
    [deckContext]
  );
  const deckStateLabel = deckContext
    ? deckContext.paused
      ? 'paused'
      : deckContext.hasStarted
        ? 'live'
        : 'ready'
    : '';
  const compiledMessage = [
    `Summary: ${formData.summary || 'N/A'}`,
    `Type: ${formatLabel(formData.reportType)}`,
    `Severity: ${formatLabel(formData.severity)}`,
    `Frequency: ${formatLabel(formData.frequency)}`,
    `Game: ${formData.game || 'N/A'}`,
    `Platform: ${formatLabel(formData.platform)}`,
    `Browser / Device: ${formData.browser || 'N/A'}`,
    `Session / Level Context: ${formData.sessionId || 'N/A'}`,
    `Arcade Deck Tag: ${deckContext?.contextTag || 'N/A'}`,
    `Arcade Deck Snapshot: ${
      deckContext
        ? `score=${deckContext.score}; mode=${deckContext.mode || 'N/A'}; health=${deckContext.health ?? 'N/A'}; state=${deckStateLabel}; session=${deckContext.sessionTag}; route=${deckContext.route}; captured=${deckContext.capturedAt}`
        : 'N/A'
    }`,
    '',
    'Steps to Reproduce:',
    formData.steps || 'N/A',
    '',
    `Expected Result: ${formData.expected || 'N/A'}`,
    `Actual Result: ${formData.actual || 'N/A'}`,
    `Screenshot Files: ${screenshotNames || 'None attached'}`,
  ].join('\n');

  const setField = <K extends keyof BugFormState>(
    field: K,
    value: BugFormState[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!formData.playerName.trim()) {
      nextErrors.playerName = 'Player name is required.';
    }
    if (!formData.email.trim()) {
      nextErrors.email = 'Contact email is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      nextErrors.email = 'Use a valid email address.';
    }
    if (!formData.game.trim()) {
      nextErrors.game = 'Please select the game where this happened.';
    }
    if (!formData.summary.trim()) {
      nextErrors.summary = 'Add a short summary of the issue.';
    }
    if (!formData.steps.trim()) {
      nextErrors.steps = 'Reproduction steps are required.';
    }
    if (!formData.actual.trim()) {
      nextErrors.actual = 'Please describe the actual result.';
    }
    if (formData._honeypot.trim()) {
      nextErrors.form = 'Bot submission blocked.';
    }
    if (lastSentAt && Date.now() - lastSentAt < 30_000) {
      nextErrors.form = 'Please wait before sending another report.';
    }

    return nextErrors;
  };

  const updateScreenshots = (files: FileList | null) => {
    const nextFiles = Array.from(files ?? []);
    const nextErrors: Record<string, string> = {};

    if (nextFiles.length > MAX_SCREENSHOTS) {
      nextErrors.screenshots = `Upload up to ${MAX_SCREENSHOTS} screenshots.`;
    }

    if (nextFiles.some((file) => !file.type.startsWith('image/'))) {
      nextErrors.screenshots = 'Only image files are allowed.';
    }

    if (nextFiles.some((file) => file.size > MAX_FILE_SIZE_BYTES)) {
      nextErrors.screenshots =
        'Each screenshot must be 8MB or smaller for reliable delivery.';
    }

    setErrors((prev) => ({ ...prev, ...nextErrors, form: prev.form ?? '' }));

    if (Object.keys(nextErrors).length > 0) {
      setScreenshots([]);
      setPreviewUrls((prev) => {
        prev.forEach((url) => URL.revokeObjectURL(url));
        return [];
      });
      return;
    }

    setScreenshots(nextFiles);
    setErrors((prev) => {
      const { screenshots: _unused, ...rest } = prev;
      return rest;
    });
    setPreviewUrls((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return nextFiles.map((file) => URL.createObjectURL(file));
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (!formRef.current) return;

    setSending(true);
    setFeedback({ type: 'idle', message: '' });

    try {
      await emailjs.sendForm(
        EMAILJS_SERVICE_ID,
        EMAILJS_BUG_TEMPLATE_ID,
        formRef.current,
        EMAILJS_PUBLIC_KEY
      );

      setFeedback({
        type: 'success',
        message:
          'Bug report submitted. Thanks for helping improve the arcade experience.',
      });
      setLastSentAt(Date.now());

      const preservedGame = formData.game;
      setFormData({
        ...DEFAULT_FORM_STATE,
        game: preservedGame,
      });
      setScreenshots([]);
      setPreviewUrls((prev) => {
        prev.forEach((url) => URL.revokeObjectURL(url));
        return [];
      });
      setErrors({});

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error(error);
      setFeedback({
        type: 'error',
        message:
          'Submission failed. Please try again or email details directly to kferacho64@gmail.com.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="absolute inset-0 z-20 overflow-y-auto">
      <div className="relative min-h-full bg-[radial-gradient(circle_at_20%_20%,rgba(88,224,255,0.28),transparent_42%),radial-gradient(circle_at_80%_10%,rgba(255,165,92,0.22),transparent_45%),linear-gradient(160deg,#090b16,#12172b_48%,#0f1121)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:22px_22px]" />

        <div className="relative mx-auto w-full max-w-6xl">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-100/20 bg-slate-950/70 px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-md sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="relative h-9 w-9 overflow-hidden rounded-lg border border-cyan-100/30 bg-cyan-200/10 p-1.5">
                  <Image
                    src="/symbol.png"
                    alt=""
                    fill
                    aria-hidden
                    className="object-contain"
                    sizes="36px"
                  />
                </span>
                <div className="relative h-6 w-[132px]">
                  <Image
                    src="/logo-white.png"
                    alt="Racho Arcade"
                    fill
                    className="object-contain"
                    sizes="132px"
                  />
                  <Image
                    src="/logo.png"
                    alt=""
                    fill
                    aria-hidden
                    className="object-contain opacity-50 mix-blend-screen"
                    sizes="132px"
                  />
                </div>
              </div>
              <p
                className="mt-2 text-[10px] uppercase tracking-[0.34em] text-cyan-200/70"
                style={{ fontFamily: headingFont }}
              >
                Universal Game Deck
              </p>
              <h1
                className="mt-2 text-lg text-cyan-50 sm:text-2xl"
                style={{ fontFamily: headingFont, lineHeight: 1.4 }}
              >
                BUG REPORT HUB
              </h1>
            </div>

            <Link
              href={activeGameOption ? `/fun/${activeGameOption.id}` : '/fun'}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-100/40 bg-cyan-300/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100 transition hover:-translate-y-0.5 hover:bg-cyan-300/25"
              style={{ fontFamily: headingFont }}
            >
              Return to Arcade
              <span aria-hidden>↩</span>
            </Link>
          </header>

          <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
            <aside className="rounded-3xl border border-fuchsia-100/20 bg-slate-900/80 p-5 shadow-[0_30px_70px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-6">
              <h2
                className="text-sm text-fuchsia-100 sm:text-base"
                style={{ fontFamily: headingFont, lineHeight: 1.5 }}
              >
                REPORTING GUIDE
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/70">
                Send clear reproduction steps and attach screenshots whenever
                possible. Reports from this page are routed through the same
                EmailJS pipeline used by the main contact form.
              </p>

              <div className="mt-5 grid gap-3">
                {[
                  'State the exact game and mode.',
                  'Explain the expected result versus actual behavior.',
                  'Attach screenshots of the bug state.',
                  'Include session/level context if available.',
                ].map((line) => (
                  <div
                    key={line}
                    className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs tracking-wide text-white/75"
                  >
                    {line}
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-cyan-200/20 bg-cyan-400/10 px-4 py-3 text-xs text-cyan-100/90">
                <p className="font-semibold uppercase tracking-[0.18em]">
                  Selected Game
                </p>
                <p className="mt-2 text-sm text-white/90">
                  {activeGameOption?.title ||
                    (formData.game ? formatLabel(formData.game) : 'None')}
                </p>
              </div>

              {deckContext && (
                <div className="mt-4 rounded-xl border border-fuchsia-200/20 bg-fuchsia-400/10 px-4 py-3 text-xs text-fuchsia-100/90">
                  <p className="font-semibold uppercase tracking-[0.18em]">
                    Auto-tagged Context
                  </p>
                  <p className="mt-2 break-all font-mono text-[11px] text-fuchsia-50/90">
                    {deckContext.contextTag}
                  </p>
                  <p className="mt-1 text-white/80">
                    Score {deckContext.score}
                    {deckContext.mode ? ` • ${formatLabel(deckContext.mode)}` : ''}
                  </p>
                </div>
              )}
            </aside>

            <section className="rounded-3xl border border-cyan-100/25 bg-slate-950/82 p-5 shadow-[0_30px_70px_rgba(0,0,0,0.55)] backdrop-blur-md sm:p-6">
              <form
                ref={formRef}
                onSubmit={handleSubmit}
                className="space-y-4"
                noValidate
                encType="multipart/form-data"
              >
                <input
                  type="text"
                  name="_honeypot"
                  value={formData._honeypot}
                  onChange={(e) => setField('_honeypot', e.target.value)}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                />

                <input type="hidden" name="from_name" value={formData.playerName} />
                <input type="hidden" name="to_name" value="RachoDevs" />
                <input type="hidden" name="email" value={formData.email} />
                <input type="hidden" name="service" value="Game Bug Report" />
                <input type="hidden" name="website" value={formData.game} />
                <input type="hidden" name="severity" value={formData.severity} />
                <input type="hidden" name="report_type" value={formData.reportType} />
                <input type="hidden" name="frequency" value={formData.frequency} />
                <input type="hidden" name="platform" value={formData.platform} />
                <input type="hidden" name="browser" value={formData.browser} />
                <input type="hidden" name="session_id" value={formData.sessionId} />
                <input
                  type="hidden"
                  name="deck_context_tag"
                  value={deckContext?.contextTag ?? ''}
                />
                <input
                  type="hidden"
                  name="deck_context_payload"
                  value={serializedDeckContext}
                />
                <input type="hidden" name="screenshot_names" value={screenshotNames} />
                <input
                  type="hidden"
                  name="screenshot_count"
                  value={String(screenshots.length)}
                />
                <textarea name="message" value={compiledMessage} readOnly hidden />

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Player Name"
                    error={errors.playerName}
                    input={
                      <input
                        name="player_name"
                        value={formData.playerName}
                        onChange={(e) => setField('playerName', e.target.value)}
                        placeholder="RachoPlayer77"
                        className={inputBase(errors.playerName)}
                      />
                    }
                  />
                  <Field
                    label="Contact Email"
                    error={errors.email}
                    input={
                      <input
                        name="contact_email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setField('email', e.target.value)}
                        placeholder="player@email.com"
                        className={inputBase(errors.email)}
                      />
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Game"
                    error={errors.game}
                    input={
                      <select
                        name="game"
                        value={formData.game}
                        onChange={(e) => setField('game', e.target.value)}
                        className={inputBase(errors.game)}
                      >
                        <option value="">Select game</option>
                        {GAME_CARDS.map((game) => (
                          <option key={game.id} value={game.id}>
                            {game.title}
                          </option>
                        ))}
                      </select>
                    }
                  />
                  <Field
                    label="Severity"
                    input={
                      <select
                        name="severity_pick"
                        value={formData.severity}
                        onChange={(e) =>
                          setField('severity', e.target.value as BugFormState['severity'])
                        }
                        className={inputBase()}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field
                    label="Type"
                    input={
                      <select
                        name="type_pick"
                        value={formData.reportType}
                        onChange={(e) =>
                          setField(
                            'reportType',
                            e.target.value as BugFormState['reportType']
                          )
                        }
                        className={inputBase()}
                      >
                        <option value="bug">Bug</option>
                        <option value="visual">Visual Glitch</option>
                        <option value="performance">Performance</option>
                        <option value="controls">Controls</option>
                        <option value="other">Other</option>
                      </select>
                    }
                  />
                  <Field
                    label="Frequency"
                    input={
                      <select
                        name="frequency_pick"
                        value={formData.frequency}
                        onChange={(e) =>
                          setField(
                            'frequency',
                            e.target.value as BugFormState['frequency']
                          )
                        }
                        className={inputBase()}
                      >
                        <option value="always">Always</option>
                        <option value="often">Often</option>
                        <option value="sometimes">Sometimes</option>
                        <option value="rare">Rare</option>
                      </select>
                    }
                  />
                  <Field
                    label="Platform"
                    input={
                      <select
                        name="platform_pick"
                        value={formData.platform}
                        onChange={(e) =>
                          setField(
                            'platform',
                            e.target.value as BugFormState['platform']
                          )
                        }
                        className={inputBase()}
                      >
                        <option value="desktop">Desktop</option>
                        <option value="mobile">Mobile</option>
                        <option value="tablet">Tablet</option>
                        <option value="other">Other</option>
                      </select>
                    }
                  />
                </div>

                <Field
                  label="Browser / Device Details"
                  input={
                    <input
                      name="browser_device"
                      value={formData.browser}
                      onChange={(e) => setField('browser', e.target.value)}
                      placeholder="Chrome 121, iPhone 15, etc."
                      className={inputBase()}
                    />
                  }
                />

                <Field
                  label="Bug Summary"
                  error={errors.summary}
                  input={
                    <input
                      name="summary"
                      value={formData.summary}
                      onChange={(e) => setField('summary', e.target.value)}
                      placeholder="Short title for the issue"
                      className={inputBase(errors.summary)}
                    />
                  }
                />

                <Field
                  label="Steps to Reproduce"
                  error={errors.steps}
                  input={
                    <textarea
                      name="steps"
                      value={formData.steps}
                      onChange={(e) => setField('steps', e.target.value)}
                      placeholder="1. Enter level 3&#10;2. Tap jump near gate&#10;3. Character clips through floor"
                      className={`${inputBase(errors.steps)} min-h-[110px] resize-y`}
                    />
                  }
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Expected Result"
                    input={
                      <textarea
                        name="expected"
                        value={formData.expected}
                        onChange={(e) => setField('expected', e.target.value)}
                        placeholder="What should have happened?"
                        className={`${inputBase()} min-h-[90px] resize-y`}
                      />
                    }
                  />
                  <Field
                    label="Actual Result"
                    error={errors.actual}
                    input={
                      <textarea
                        name="actual"
                        value={formData.actual}
                        onChange={(e) => setField('actual', e.target.value)}
                        placeholder="What happened instead?"
                        className={`${inputBase(errors.actual)} min-h-[90px] resize-y`}
                      />
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Session / Level Context (optional)"
                    input={
                      <input
                        name="session_context"
                        value={formData.sessionId}
                        onChange={(e) => setField('sessionId', e.target.value)}
                        placeholder="Level 7, Endless mode, score 2310..."
                        className={inputBase()}
                      />
                    }
                  />
                  <Field
                    label="Screenshots (up to 3)"
                    error={errors.screenshots}
                    input={
                      <input
                        ref={fileInputRef}
                        name="screenshots"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => updateScreenshots(e.target.files)}
                        className={inputBase(errors.screenshots)}
                      />
                    }
                  />
                </div>

                {previewUrls.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {previewUrls.map((url, index) => (
                      <div
                        key={url}
                        className="overflow-hidden rounded-lg border border-white/20 bg-black/40"
                      >
                        <img
                          src={url}
                          alt={`Screenshot preview ${index + 1}`}
                          className="h-24 w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {errors.form && (
                  <div className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
                    {errors.form}
                  </div>
                )}

                {feedback.type !== 'idle' && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      feedback.type === 'success'
                        ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100'
                        : 'border-rose-300/40 bg-rose-500/15 text-rose-100'
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-100/45 bg-gradient-to-r from-cyan-300/25 via-fuchsia-300/15 to-orange-300/20 px-4 py-3 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-50 transition hover:-translate-y-0.5 hover:border-cyan-100/70 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ fontFamily: headingFont }}
                >
                  {sending ? 'Sending Report...' : 'Submit Bug Report'}
                  <BugGlyph />
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

const Field = ({
  label,
  input,
  error,
}: {
  label: string;
  input: ReactNode;
  error?: string;
}) => (
  <label className="block text-[11px] uppercase tracking-[0.2em] text-cyan-100/80">
    <span style={{ fontFamily: headingFont }}>{label}</span>
    <div className="mt-2">{input}</div>
    {error && <p className="mt-1 text-xs tracking-normal text-rose-200">{error}</p>}
  </label>
);

const inputBase = (error?: string) =>
  `w-full rounded-xl border px-3 py-2 text-sm text-white outline-none transition ${
    error
      ? 'border-rose-300/80 bg-rose-500/10'
      : 'border-cyan-100/25 bg-slate-900/90 hover:border-cyan-100/45 focus:border-cyan-100/70'
  }`;

const BugGlyph = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-4 w-4 fill-none stroke-current stroke-2"
  >
    <path d="M12 7c3 0 5 2.2 5 5v3.5c0 1.9-1.6 3.5-3.5 3.5h-3c-1.9 0-3.5-1.6-3.5-3.5V12c0-2.8 2-5 5-5Z" />
    <path d="M12 7V4m-5.5 8H4m3.2-4.2L5.4 6m10.4 1.8L17.6 6M17.5 12H20m-3.2 3.8 1.8 1.8m-10.4-1.8-1.8 1.8" />
  </svg>
);
