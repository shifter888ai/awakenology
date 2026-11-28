#!/usr/bin/env python3
"""Build the allow-listed Editor-only asset bundle for isolated staging."""
from pathlib import Path
import argparse
import shutil

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "editor"
EXPECTED_FILES = (
    "index.html",
    "generator.html",
    "html-generator.html",
    "shared-editing-core.js",
)


def build(output_dir: Path | None = None) -> Path:
    destination = Path(output_dir) if output_dir else ROOT / "dist-editor"
    missing = [name for name in EXPECTED_FILES if not (SOURCE / name).is_file()]
    if missing:
        raise FileNotFoundError("Missing Editor assets: " + ", ".join(missing))
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    for name in EXPECTED_FILES:
        shutil.copy2(SOURCE / name, destination / name)
    actual = sorted(path.name for path in destination.iterdir() if path.is_file())
    expected = sorted(EXPECTED_FILES)
    if actual != expected:
        raise RuntimeError(f"Editor bundle is not allow-listed: {actual}")
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    output = build(args.output)
    print(f"Built {len(EXPECTED_FILES)} Editor assets into {output}")
