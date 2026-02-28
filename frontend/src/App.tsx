import { useEffect, useMemo, useState } from "react";
import deckData from "./data/deck.json";
import type { Deck } from "./types";

const unknownShortcut = "ArrowLeft";
const knownShortcut = "ArrowRight";
const soundShortcut = "ArrowUp";

const PROGRESS_KEY = "deckster-progress-v1";
const SETTINGS_KEY = "deckster-settings-v1";

type RawCard = {
  id?: string;
  note_id?: string;
  de_word?: string;
  de_sentence?: string;
  en_word?: string;
  en_sentence?: string;
  audio_url?: string | null;
};

type RawDeck = {
  id?: string;
  title?: string;
  cards?: RawCard[];
};

type ProgressState = {
  index: number;
  missedIds: string[];
  reviewMode: boolean;
  reviewIndex: number;
};

type SettingsState = {
  showGermanSentence: boolean;
  showEnglishSentence: boolean;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return ["input", "textarea", "select"].includes(tag) || target.isContentEditable;
}

function normalizeDeck(raw: RawDeck): Deck {
  const cards = (raw.cards ?? []).map((card, index) => {
    const id = card.id?.trim() || card.note_id?.trim() || `card-${index + 1}`;
    return {
      id,
      note_id: card.note_id?.trim() || id,
      de_word: card.de_word?.trim() ?? "",
      de_sentence: card.de_sentence?.trim() ?? "",
      en_word: card.en_word?.trim() ?? "",
      en_sentence: card.en_sentence?.trim() ?? "",
      audio_url: card.audio_url ?? null
    };
  });
  return {
    id: raw.id?.trim() || "default-deck",
    title: raw.title?.trim() || "Deckster Lab",
    cards
  };
}

function loadProgress(): ProgressState {
  if (typeof window === "undefined") {
    return { index: 0, missedIds: [], reviewMode: false, reviewIndex: 0 };
  }
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { index: 0, missedIds: [], reviewMode: false, reviewIndex: 0 };
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    return {
      index: Number.isFinite(parsed.index) ? Number(parsed.index) : 0,
      missedIds: Array.isArray(parsed.missedIds) ? parsed.missedIds.filter(Boolean) : [],
      reviewMode: Boolean(parsed.reviewMode),
      reviewIndex: Number.isFinite(parsed.reviewIndex) ? Number(parsed.reviewIndex) : 0
    };
  } catch {
    return { index: 0, missedIds: [], reviewMode: false, reviewIndex: 0 };
  }
}

function loadSettings(): SettingsState {
  if (typeof window === "undefined") {
    return { showGermanSentence: true, showEnglishSentence: true };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { showGermanSentence: true, showEnglishSentence: true };
    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    return {
      showGermanSentence: parsed.showGermanSentence !== false,
      showEnglishSentence: parsed.showEnglishSentence !== false
    };
  } catch {
    return { showGermanSentence: true, showEnglishSentence: true };
  }
}

export default function App() {
  const deck = useMemo(() => normalizeDeck(deckData as RawDeck), []);
  const [index, setIndex] = useState(() => loadProgress().index);
  const [flipped, setFlipped] = useState(false);
  const [missedIds, setMissedIds] = useState<string[]>(() => loadProgress().missedIds);
  const [reviewMode, setReviewMode] = useState(() => loadProgress().reviewMode);
  const [reviewIndex, setReviewIndex] = useState(() => loadProgress().reviewIndex);
  const [infoOpen, setInfoOpen] = useState(false);
  const [showGermanSentence, setShowGermanSentence] = useState(() => loadSettings().showGermanSentence);
  const [showEnglishSentence, setShowEnglishSentence] = useState(() => loadSettings().showEnglishSentence);

  const cardById = useMemo(() => new Map(deck.cards.map((card) => [card.id, card])), [deck.cards]);
  const reviewQueue = missedIds;

  useEffect(() => {
    setMissedIds((prev) => {
      const next = prev.filter((id) => cardById.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [cardById]);

  useEffect(() => {
    if (!reviewMode) return;
    if (reviewQueue.length === 0) {
      setReviewMode(false);
      setReviewIndex(0);
      return;
    }
    if (reviewIndex >= reviewQueue.length) {
      setReviewIndex(0);
    }
  }, [reviewMode, reviewQueue.length, reviewIndex]);

  useEffect(() => {
    const maxIndex = Math.max(deck.cards.length - 1, 0);
    if (index > maxIndex) {
      setIndex(0);
    }
  }, [deck.cards.length, index]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: ProgressState = { index, missedIds, reviewMode, reviewIndex };
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(payload));
  }, [index, missedIds, reviewMode, reviewIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: SettingsState = { showGermanSentence, showEnglishSentence };
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
  }, [showGermanSentence, showEnglishSentence]);

  const currentCard = useMemo(() => {
    if (deck.cards.length === 0) return null;
    if (reviewMode && reviewQueue.length > 0) {
      const targetId = reviewQueue[reviewIndex % reviewQueue.length];
      return cardById.get(targetId) ?? null;
    }
    return deck.cards[index % deck.cards.length];
  }, [cardById, deck.cards, index, reviewIndex, reviewMode, reviewQueue]);

  const progressLabel =
    deck.cards.length > 0 ? `${Math.min(index + 1, deck.cards.length)} / ${deck.cards.length}` : "0 / 0";

  const missedCount = missedIds.length;

  const handleAdvance = () => {
    if (deck.cards.length === 0) return;
    if (reviewMode) {
      if (reviewQueue.length === 0) return;
      setReviewIndex((prev) => (prev + 1) % reviewQueue.length);
    } else {
      setIndex((prev) => (prev + 1) % deck.cards.length);
    }
    setFlipped(false);
  };

  const handleAnswer = (known: boolean) => {
    if (!currentCard) return;
    setMissedIds((prev) => {
      if (known) {
        return prev.filter((id) => id !== currentCard.id);
      }
      if (prev.includes(currentCard.id)) {
        return prev;
      }
      return [...prev, currentCard.id];
    });
    handleAdvance();
  };

  const handleFlip = () => {
    if (!currentCard) return;
    setFlipped((prev) => !prev);
  };

  const playSound = () => {
    if (!currentCard?.audio_url) return;
    const audio = new Audio(currentCard.audio_url);
    void audio.play();
  };

  const startReview = () => {
    if (!missedIds.length) return;
    setReviewIndex(0);
    setReviewMode(true);
    setFlipped(false);
  };

  const resetProgress = () => {
    const confirmed = window.confirm("Reset your progress for this deck?");
    if (!confirmed) return;
    setIndex(0);
    setMissedIds([]);
    setReviewMode(false);
    setReviewIndex(0);
    setFlipped(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PROGRESS_KEY);
    }
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat || isTypingTarget(event.target)) return;
      if (!currentCard) return;
      if (event.code === "ArrowDown") {
        event.preventDefault();
        handleFlip();
      }
      if (event.code === unknownShortcut) {
        event.preventDefault();
        handleAnswer(false);
      }
      if (event.code === knownShortcut) {
        event.preventDefault();
        handleAnswer(true);
      }
      if (event.code === soundShortcut) {
        event.preventDefault();
        playSound();
      }
      if (event.key === "1") {
        event.preventDefault();
        handleAnswer(false);
      }
      if (event.key === "2") {
        event.preventDefault();
        handleAnswer(true);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentCard]);

  return (
    <div className="min-h-screen text-ink">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-display text-ink">Goethe Institute A1 Wordlist</h1>
            <h2 className="mt-2 font-brand text-xs uppercase tracking-[0.4em] text-ink/50">Deckster Lab</h2>
          </div>
          <div className="flex items-center justify-center md:justify-end gap-2">
            <button
              type="button"
              onClick={resetProgress}
              className="rounded-full border border-ink/15 bg-white/70 px-3 py-2 text-xs uppercase tracking-[0.2em] text-ink/70 hover:bg-white transition"
              aria-label="Reset progress"
              title="Reset progress"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="rounded-full border border-ink/15 bg-white/70 p-2 text-ink/70 hover:bg-white transition"
              aria-label="Open instructions"
              title="Instructions"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10 9V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="10" cy="6.5" r="1" fill="currentColor" />
              </svg>
            </button>
          </div>
        </header>

        <main className="mt-6 flex flex-col items-center gap-8">
          <section className="w-full card-surface rounded-2xl shadow-card p-6 md:p-8 animate-floatIn">
            <div
              className={`relative border border-ink/10 rounded-xl p-6 md:p-10 text-center min-h-[280px] flex items-center justify-center ${flipped ? "bg-slate-100" : "bg-white/70"
                }`}
            >
              {!flipped && currentCard && (
                <>
                  <button
                    type="button"
                    onClick={() => handleAnswer(false)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-ink/15 bg-white/80 p-2 text-ink/70 shadow-soft hover:bg-white transition"
                    aria-label="Don't know"
                    title="Don't know"
                  >
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M5 5L15 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleAdvance}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-ink/15 bg-white/80 p-2 text-ink/70 shadow-soft hover:bg-white transition"
                    aria-label="Next card"
                    title="Next card"
                  >
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path
                        d="M4.5 10H14.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <path
                        d="M10.5 6L14.5 10L10.5 14"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </>
              )}
              {currentCard ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm uppercase tracking-[0.2em] text-ink/40">{flipped ? "Back" : "Front"}</p>
                  <div className="text-center">
                    <p className="mt-2 text-4xl md:text-5xl font-display font-semibold text-ink">
                      {flipped ? currentCard.en_word : currentCard.de_word}
                    </p>
                    {!flipped && showGermanSentence && currentCard.de_sentence && (
                      <p className="mt-3 text-base md:text-lg text-ink/60 font-light max-w-xl">
                        {currentCard.de_sentence}
                      </p>
                    )}
                    {flipped && showEnglishSentence && currentCard.en_sentence && (
                      <p className="mt-3 text-base md:text-lg text-ink/60 font-light max-w-xl">
                        {currentCard.en_sentence}
                      </p>
                    )}
                  </div>
                  <p className="text-[9px] uppercase tracking-[0.1em] text-ink/40 font-light">
                    Note ID - {currentCard.note_id}
                  </p>
                </div>
              ) : (
                <p className="text-ink/60">No cards in this deck yet.</p>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
              <button
                onClick={() => handleAnswer(false)}
                className="rounded-xl bg-ember text-white px-4 py-3 text-sm font-semibold shadow-soft hover:shadow-card transition"
                disabled={!currentCard}
              >
                Don&apos;t know
                <span className="block text-xs text-white/80">Arrow left</span>
              </button>
              <button
                onClick={handleFlip}
                className="rounded-xl border border-ink/15 px-4 py-3 text-sm font-semibold hover:bg-white/70 transition"
                disabled={!currentCard}
              >
                Flip card
                <span className="block text-xs text-ink/50">Arrow down</span>
              </button>
              <button
                onClick={playSound}
                className="rounded-xl border border-ink/15 px-4 py-3 text-sm font-semibold hover:bg-white/70 transition disabled:opacity-60"
                disabled={!currentCard?.audio_url}
              >
                Play sound
                <span className="block text-xs text-ink/50">Arrow up</span>
              </button>
              <button
                onClick={() => handleAnswer(true)}
                className="rounded-xl bg-moss text-white px-4 py-3 text-sm font-semibold shadow-soft hover:shadow-card transition"
                disabled={!currentCard}
              >
                Got it
                <span className="block text-xs text-white/80">Arrow right</span>
              </button>
            </div>
          </section>

          <section className="w-full card-surface rounded-2xl shadow-card p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink/40">Deck</p>
                <p className="mt-2 text-lg font-semibold text-ink">{deck.title}</p>
                <p className="text-sm text-ink/60">{deck.cards.length} cards</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink/40">Progress</p>
                <p className="mt-2 text-lg font-semibold text-ink">{progressLabel}</p>
                <p className="text-sm text-ink/60">{missedCount} missed</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink/40">Missed review</p>
                {missedIds.length === 0 && <p className="mt-2 text-sm text-ink/60">You are clear for now.</p>}
                {missedIds.length > 0 && (
                  <button
                    onClick={reviewMode ? () => setReviewMode(false) : startReview}
                    className="mt-2 w-full rounded-xl bg-ink text-linen px-4 py-3 text-sm font-semibold shadow-soft hover:shadow-card transition"
                  >
                    {reviewMode ? "Exit review" : "Review missed cards"}
                  </button>
                )}
                {reviewMode && reviewQueue.length > 0 && (
                  <p className="mt-3 text-xs text-ink/50">
                    Reviewing {Math.min(reviewIndex + 1, reviewQueue.length)} of {reviewQueue.length}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 border-t border-ink/10 pt-4">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/40">Sentence display</p>
              <div className="mt-3 flex flex-col md:flex-row md:items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-ink/70">
                  <input
                    type="checkbox"
                    checked={showGermanSentence}
                    onChange={(event) => setShowGermanSentence(event.target.checked)}
                  />
                  Show German sentence
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-ink/70">
                  <input
                    type="checkbox"
                    checked={showEnglishSentence}
                    onChange={(event) => setShowEnglishSentence(event.target.checked)}
                  />
                  Show English sentence
                </label>
              </div>
            </div>
            <div className="mt-6 border-t border-ink/10 pt-4 flex flex-col gap-3 text-sm text-ink/60 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col gap-2">
                <p className="text-[13px] text-ink/50">Designed and Vibe Coded by Akshay Verma.</p>
                <div className="social-media-links">
                  <a href="https://twitter.com/imakshayverma" target="_blank" rel="noreferrer">
                    <i className="fa fa-twitter" aria-hidden="true"></i>
                  </a>
                  <a href="https://github.com/imakshayverma" target="_blank" rel="noreferrer">
                    <i className="fa fa-github" aria-hidden="true"></i>
                  </a>
                  <a href="https://www.facebook.com/Akshayverma29" target="_blank" rel="noreferrer">
                    <i className="fa fa-facebook-official" aria-hidden="true"></i>
                  </a>
                  <a href="https://www.instagram.com/akshaysahab/" target="_blank" rel="noreferrer">
                    <i className="fa fa-instagram" aria-hidden="true"></i>
                  </a>
                  <a href="https://in.linkedin.com/in/imakshayverma" target="_blank" rel="noreferrer">
                    <i className="fa fa-linkedin-square" aria-hidden="true"></i>
                  </a>
                </div>
              </div>
              <p className="md:text-right">
                Source deck:{" "}
                <a
                  href="https://ankiweb.net/shared/info/293204297"
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink underline"
                >
                  AnkiWeb shared deck
                </a>
                <p className="text-[12px] text-ink/50">This app is published under the MIT license.</p>
              </p>
            </div>
          </section>
        </main>
      </div>

      {infoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6"
          onClick={() => setInfoOpen(false)}
        >
          <div
            className="card-surface w-full max-w-lg rounded-2xl shadow-card p-6 md:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-brand text-xs uppercase tracking-[0.3em] text-ink/50">Deckster Lab</p>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="rounded-full border border-ink/15 bg-white/70 p-2 text-ink/70 hover:bg-white transition"
                aria-label="Close instructions"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M5 5L15 15"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <h2 className="mt-4 text-2xl font-display text-ink">Quick instructions</h2>
            <div className="mt-4 space-y-3 text-sm text-ink/70">
              <p>This is a simple flashcard app to help you study vocabulary decks for A1 German. The app is
                entirely client-side and stores your progress in your browser. The app gives the best experience on desktop, but should work on mobile as well.
              </p>
              <p>Use the buttons or keyboard shortcuts to navigate through the flashcards.</p>
              <p>Press Arrow down to flip. Arrow left marks "didn't know", arrow right marks "got it".</p>
              <p>Press Arrow up to play audio when available.</p>
              <p>Use review mode to cycle through the missed cards that you didnt know.</p>
              <p>Your progress is saved locally; use Reset to clear it.</p>

              <p>If you have any questions or feedback, feel free to reach out on social media handles shared in footnote!</p>
            </div>
            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="rounded-full bg-ink text-linen px-4 py-2 text-sm font-semibold shadow-soft hover:shadow-card transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
