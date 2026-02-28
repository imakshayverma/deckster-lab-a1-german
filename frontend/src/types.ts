export type Card = {
  id: string;
  note_id: string;
  de_word: string;
  de_sentence: string;
  en_word: string;
  en_sentence: string;
  audio_url?: string | null;
};

export type Deck = {
  id: string;
  title: string;
  cards: Card[];
};
