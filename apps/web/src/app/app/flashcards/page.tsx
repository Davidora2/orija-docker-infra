import { FlashcardDeck } from "@/components/flashcard-deck";
import { GhostLink, Panel, SectionTitle } from "@/components/ui";
import { cardsForDeck, flashcardDecks } from "@/data/flashcards";

export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string }>;
}) {
  const { deck: deckParam } = await searchParams;
  const deckId = deckParam && flashcardDecks.some((d) => d.id === deckParam)
    ? deckParam
    : "exam-guidelines";
  const active = flashcardDecks.find((d) => d.id === deckId)!;
  const cards = cardsForDeck(deckId);

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Flashcards"
        title="Memorize the exam-critical facts"
        subtitle="Start with CSCT Exam Guidelines — these numbers show up as hard facts on the test."
      />

      <div className="flex flex-wrap gap-2">
        {flashcardDecks.map((deck) => (
          <GhostLink
            key={deck.id}
            href={`/app/flashcards?deck=${deck.id}`}
            className={deck.id === deckId ? "border-teal bg-mist" : undefined}
          >
            {deck.title}
          </GhostLink>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-navy/50">
            Active deck
          </p>
          <h2 className="mt-2 font-display text-2xl text-navy">{active.title}</h2>
          <p className="mt-2 text-sm text-navy/65">{active.countHint}</p>
          <p className="mt-4 text-sm text-navy/55">{cards.length} cards in this deck</p>
        </Panel>
        <FlashcardDeck deckId={deckId} title={active.title} cards={cards} />
      </div>
    </div>
  );
}
