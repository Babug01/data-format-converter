# Data Format Converter

**Live demo:** https://babug01.github.io/data-format-converter/

Paste JSON, YAML, or TOML and convert it to either of the other two formats. The input format is
auto-detected (JSON first, then YAML, then TOML) or can be forced with a selector, and parse errors
surface the exact line and column whenever the underlying parser reports one, instead of a generic
"invalid input" message. Runs entirely in the browser; nothing you paste ever leaves your machine.

## Features

- **Auto-detection with a sane fallback order** — tries JSON first (the strictest grammar), then YAML,
  then TOML. The YAML step only counts as a match if it parses to an object or array — YAML's grammar is
  permissive enough that almost any text "parses" as a single scalar string, which would otherwise
  swallow real TOML input before TOML ever got a turn.
- **Force a specific input format** when auto-detection isn't what you want (e.g. a YAML document that
  happens to also be valid — but not intended as — TOML-ish text).
- **Precise parse errors** — JSON errors get a computed `(line N, column M)` appended when Node's error
  message only carries a raw character offset; YAML and TOML errors already include their own line/column
  and a source snippet, shown as reported rather than reformatted into something less informative.
- **Adjustable indent width** for JSON and TOML output — indent doesn't apply to TOML.
- **Clear rejection when a shape can't survive the round trip** — e.g. converting a top-level array or
  scalar to TOML fails with an explicit explanation, since TOML can only represent an object/table at its
  root.

## Tech Stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [`yaml`](https://www.npmjs.com/package/yaml) — same YAML library already used elsewhere in this
  portfolio, kept consistent rather than introducing a second YAML parser
- [`@iarna/toml`](https://www.npmjs.com/package/@iarna/toml) for TOML parsing/stringifying

## Running locally

```bash
git clone https://github.com/Babug01/data-format-converter.git
cd data-format-converter
npm install
npm run dev
```

## License

MIT — see [LICENSE](LICENSE).
