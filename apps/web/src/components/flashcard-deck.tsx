"use client";

import { useEffect, useState } from "react";
import type { Flashcard } from "@/data/flashcards";
import { bumpFlashcard } from "@/lib/progress";
import { cn, shuffle } from "@/lib/utils";
import { Panel } from "@/components/ui";

export function FlashcardDeck({
  deckId,
  title,
  cards,
}: {
  deckId: string;
  title: string;
  cards: Flashcard[];
}) {
  const [deck, setDeck] = useState<Flashcard[]>(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setDeck(shuffle(cards));
    setIndex(0);
    setFlipped(false);
  }, [cards, deckId]);

  if (deck.length === 0) {
    return <Panel>No cards in this deck.</Panel>;
  }

  const card = deck[index];

  function flip() {
    if (!flipped) bumpFlashcard(deckId);
    setFlipped((f) => !f);
  }

  function next(delta: number) {
    setFlipped(false);
    setIndex((i) => (i + delta + deck.length) % deck.length);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-navy/60">
        <span>{title}</span>
        <span>
          {index + 1} / {deck.length}
        </span>
      </div>

      <button
        type="button"
        onClick={flip}
        className="group block w-full [perspective:1200px]"
        aria-label="Flip flashcard"
      >
        <div className={cn("card-flip relative min-h-[240px] w-full", flipped && "is-flipped")}>
          <div className="card-face absolute inset-0 rounded-2xl border border-[var(--line)] bg-white p-6 text-left shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-deep">
              Prompt
            </p>
            <p className="mt-6 font-display text-2xl leading-snug text-navy">{card.front}</p>
            <p className="absolute bottom-5 left-6 text-xs text-navy/45">Tap to reveal</p>
          </div>
          <div className="card-face back absolute inset-0 rounded-2xl border border-teal/30 bg-mist p-6 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Answer</p>
            <p className="mt-6 text-lg leading-relaxed text-navy">{card.back}</p>
            {card.tag ? (
              <p className="absolute bottom-5 left-6 text-xs font-semibold uppercase text-teal-deep">
                {card.tag}
              </p>
            ) : null}
          </div>
        </div>
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => next(-1)}
          className="rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm font-semibold text-navy"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => next(1)}
          className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          Next card
        </button>
      </div>
    </div>
  );
}
