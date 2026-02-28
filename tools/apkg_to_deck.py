#!/usr/bin/env python3
"""
Convert an Anki .apkg into the Deckster Lab frontend deck format.

Usage:
  python3 tools/apkg_to_deck.py data/Goethe_Institute_A1_Wordlist.apkg

Optional arguments:
  --output frontend/src/data/deck.json
  --media-dir frontend/public/media
  --no-audio
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import tempfile
import zipfile
from pathlib import Path

SOUND_PATTERN = re.compile(r"\[sound:([^\]]+)\]")


def strip_html(value: str) -> str:
    if not value:
        return ""
    cleaned = re.sub(r"<[^>]+>", " ", value)
    normalized = re.sub(r"\s+", " ", cleaned)
    return normalized.strip()


def extract_sound(value: str) -> tuple[str, list[str]]:
    if not value:
        return "", []
    sounds = SOUND_PATTERN.findall(value)
    cleaned = SOUND_PATTERN.sub("", value)
    return cleaned, sounds


def slugify(value: str) -> str:
    lowered = value.strip().lower()
    cleaned = re.sub(r"[^a-z0-9\\s_-]", "", lowered)
    dashed = re.sub(r"[\\s_-]+", "-", cleaned).strip("-")
    return dashed or "deck"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert Anki .apkg to Deckster Lab JSON.")
    parser.add_argument("apkg", type=Path, help="Path to .apkg file")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("frontend/src/data/deck.json"),
        help="Output deck JSON path",
    )
    parser.add_argument(
        "--media-dir",
        type=Path,
        default=Path("frontend/public/media"),
        help="Directory to write extracted audio files",
    )
    parser.add_argument("--no-audio", action="store_true", help="Skip extracting audio files")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    apkg_path: Path = args.apkg
    if not apkg_path.exists():
        raise SystemExit(f"APKG file not found: {apkg_path}")

    media_out_dir: Path = args.media_dir
    output_path: Path = args.output

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        with zipfile.ZipFile(apkg_path, "r") as zip_ref:
            collection_name = next(
                (name for name in zip_ref.namelist() if name.endswith(".anki2") or name.endswith(".anki21")),
                None,
            )
            if collection_name is None:
                raise SystemExit("APKG collection not found")
            extracted = tmpdir / "collection.sqlite"
            extracted.write_bytes(zip_ref.read(collection_name))

            media_map = {}
            if "media" in zip_ref.namelist():
                raw_media = zip_ref.read("media").decode("utf-8")
                media_map = json.loads(raw_media)

            filename_to_key = {value: key for key, value in media_map.items()}

        conn = sqlite3.connect(extracted)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute("SELECT id, flds FROM notes").fetchall()
        finally:
            conn.close()

    cards: list[dict[str, object]] = []
    media_out_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(apkg_path, "r") as zip_ref:
        for row in rows:
            fields = row["flds"].split("\x1f") if row["flds"] else []
            cleaned_fields: list[str] = []
            sound_files: list[str] = []
            for field in fields:
                cleaned, sounds = extract_sound(field)
                cleaned_fields.append(strip_html(cleaned))
                sound_files.extend(sounds)

            de_word = cleaned_fields[1] if len(cleaned_fields) > 1 else ""
            de_sentence = cleaned_fields[2] if len(cleaned_fields) > 2 else ""
            en_word = cleaned_fields[3] if len(cleaned_fields) > 3 else ""
            en_sentence = cleaned_fields[4] if len(cleaned_fields) > 4 else ""

            if not any([de_word, de_sentence, en_word, en_sentence]):
                continue

            audio_url = None
            if not args.no_audio and sound_files:
                sound_file = sound_files[0]
                key = filename_to_key.get(sound_file)
                if key is not None:
                    try:
                        media_bytes = zip_ref.read(key)
                    except KeyError:
                        media_bytes = None
                    if media_bytes is not None:
                        out_path = media_out_dir / sound_file
                        if not out_path.exists():
                            out_path.write_bytes(media_bytes)
                        audio_url = f"/media/{sound_file}"

            cards.append(
                {
                    "id": str(row["id"]),
                    "note_id": str(row["id"]),
                    "de_word": de_word,
                    "de_sentence": de_sentence,
                    "en_word": en_word,
                    "en_sentence": en_sentence,
                    "audio_url": audio_url,
                }
            )

    file_stem = apkg_path.stem.replace("_", " ").strip()
    deck = {
        "id": slugify(apkg_path.stem),
        "title": file_stem,
        "cards": cards,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(deck, ensure_ascii=True, indent=2), encoding="utf-8")

    print(f"Wrote {len(cards)} cards to {output_path}")


if __name__ == "__main__":
    main()
