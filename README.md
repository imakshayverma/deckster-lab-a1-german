# Deckster Lab - A1 German Wordlist

A minimal flash-card app for [Goethe Institute A1 Wordlist](https://ankiweb.net/shared/info/293204297). While the app was initially concieved to build a generic flashcard reader app, for ease of use and building the final app quickly, I have hardcoded it to A1 German wordlist which was the first use case I wanted to try it for. 

## Quick start

```bash
cd frontend
npm install
npm run dev
```

## Deck configuration

Edit `frontend/src/data/deck.json` to change the cards. Each card uses `de_word`, `de_sentence`, `en_word`, and `en_sentence`.

## APKG conversion (optional)

Use `tools/apkg_to_deck.py` to convert an Anki `.apkg` into the frontend deck format and extract audio into `frontend/public/media`. The apkg front end deck format is hardcoded for ease of development and usage. 

## GitHub Pages

This repo includes a GitHub Actions workflow that builds and deploys the frontend to Pages.
