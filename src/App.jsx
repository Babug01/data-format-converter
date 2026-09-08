import { useState } from "react";
import YAML from "yaml";
import TOML from "@iarna/toml";
import Header from "./components/Header";

const REPO_URL = "https://github.com/Babug01/data-format-converter";

// --- Parsing / auto-detection --------------------------------------------
// Order: JSON, then YAML, then TOML. JSON is tried first because it's the
// strictest — a JSON document is (almost) always also valid YAML, so trying
// YAML first would make it impossible to ever detect plain JSON specifically.
//
// The YAML step only "counts" as a successful detection if it produces an
// object or array. YAML's grammar is so permissive that almost any text —
// including real TOML — parses as *something* (usually a single scalar
// string), which would otherwise make YAML swallow every non-JSON input
// before TOML ever gets a turn. Verified directly: parsing a real TOML
// document ("name = \"test\"\n[nested]\na = 1") through YAML.parse returns
// the whole thing folded into one plain-scalar string, not an object — so
// requiring an object/array return is what correctly lets TOML content fall
// through to the TOML parser instead of being misreported as YAML.
function posToLineCol(text, pos) {
  const upTo = text.slice(0, pos).split("\n");
  return { line: upTo.length, col: upTo[upTo.length - 1].length + 1 };
}

// Node's JSON.parse messages sometimes already embed "(line N column M)"
// (recent V8), sometimes only a raw "position N" (older/varies by error
// type), and sometimes neither (the "Unexpected token 'x', ... is not valid
// JSON" form). Only compute-and-append line/col when the message doesn't
// already carry it and a raw position is actually available — never fabricate
// a location.
function describeJsonError(err, text) {
  if (/\(line \d+ column \d+\)/.test(err.message)) return err.message;
  const m = /position (\d+)/.exec(err.message);
  if (m) {
    const { line, col } = posToLineCol(text, Number(m[1]));
    return `${err.message} (line ${line}, column ${col})`;
  }
  return err.message;
}

// yaml's and @iarna/toml's own error messages already include a human-
// readable "at line N, column M" / "at row N, col M" plus a source snippet
// with a caret — shown as-is rather than reformatted.
function firstLine(message) {
  return message.split("\n")[0].replace(/:$/, "");
}

function detectAndParse(text, forcedFormat) {
  if (forcedFormat && forcedFormat !== "auto") {
    return { format: forcedFormat, value: parseAs(forcedFormat, text) };
  }

  const attempts = [];

  try {
    return { format: "json", value: JSON.parse(text) };
  } catch (e) {
    attempts.push(`JSON: ${describeJsonError(e, text)}`);
  }

  try {
    const val = YAML.parse(text);
    if (val !== null && typeof val === "object") {
      return { format: "yaml", value: val };
    }
    attempts.push("YAML: parsed, but as a plain scalar rather than an object/array — doesn't look like structured data");
  } catch (e) {
    attempts.push(`YAML: ${firstLine(e.message)}`);
  }

  try {
    return { format: "toml", value: TOML.parse(text) };
  } catch (e) {
    attempts.push(`TOML: ${firstLine(e.message)}`);
  }

  throw new Error(`Couldn't parse this as JSON, YAML, or TOML.\n${attempts.join("\n")}`);
}

function parseAs(format, text) {
  try {
    if (format === "json") return JSON.parse(text);
    if (format === "yaml") return YAML.parse(text);
    if (format === "toml") return TOML.parse(text);
    throw new Error(`Unknown format: ${format}`);
  } catch (e) {
    if (format === "json") throw new Error(describeJsonError(e, text));
    throw new Error(e.message); // yaml/@iarna/toml messages already include line/column + a source snippet
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function stringifyAs(value, format, indent) {
  if (format === "json") return JSON.stringify(value, null, indent);
  if (format === "yaml") return YAML.stringify(value, { indent });
  if (format === "toml") {
    if (!isPlainObject(value)) {
      throw new Error("TOML can only represent an object (key/value table) at the top level — this input is " + (Array.isArray(value) ? "an array" : typeof value) + ", which has no TOML equivalent at the root.");
    }
    return TOML.stringify(value);
  }
  throw new Error(`Unknown target format: ${format}`);
}

const FORMATS = [
  { id: "auto", label: "Auto-detect" },
  { id: "json", label: "JSON" },
  { id: "yaml", label: "YAML" },
  { id: "toml", label: "TOML" },
];

const OUTPUT_FORMATS = [
  { id: "json", label: "JSON" },
  { id: "yaml", label: "YAML" },
  { id: "toml", label: "TOML" },
];

const SAMPLE_JSON = JSON.stringify(
  { name: "cloud8", version: 1, tags: ["aks", "terraform"], nested: { region: "westeurope", replicas: 3 } },
  null,
  2
);

const styles = {
  root: { minHeight: "100dvh", display: "flex", flexDirection: "column" },
  content: { fontFamily: "system-ui, sans-serif", padding: "24px 32px", maxWidth: 1100, margin: "0 auto", color: "var(--text, #1a1a1a)", width: "100%", boxSizing: "border-box", background: "var(--bg-subtle, #f0efed)", flex: 1 },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 13, opacity: 0.6, margin: "4px 0 20px" },
  row: { display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" },
  label: { fontSize: 12, opacity: 0.6, fontWeight: 600 },
  select: {
    padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)",
    background: "var(--input-bg, #f9fafb)", color: "var(--text, #1a1a1a)", fontSize: 13,
  },
  numberInput: {
    padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)",
    background: "var(--input-bg, #f9fafb)", color: "var(--text, #1a1a1a)", fontSize: 13, width: 60,
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 },
  panel: { display: "flex", flexDirection: "column", gap: 8 },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  textarea: {
    width: "100%", minHeight: 380, padding: 12, borderRadius: 8, border: "1px solid var(--border, #e5e7eb)",
    background: "var(--input-bg, #f9fafb)", color: "var(--text, #1a1a1a)", fontSize: 12.5, boxSizing: "border-box",
    fontFamily: "'SFMono-Regular', Consolas, monospace", resize: "vertical", lineHeight: 1.5,
  },
  outputBox: {
    width: "100%", minHeight: 380, padding: 12, borderRadius: 8, border: "1px solid var(--border, #e5e7eb)",
    background: "var(--input-bg, #f9fafb)", color: "var(--text, #1a1a1a)", fontSize: 12.5, boxSizing: "border-box",
    fontFamily: "'SFMono-Regular', Consolas, monospace", overflow: "auto", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5,
  },
  btn: {
    padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--accent, #4f46e5)",
    color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
  },
  iconBtn: {
    padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)", background: "transparent",
    color: "var(--text, #1a1a1a)", cursor: "pointer", fontSize: 11,
  },
  errorBox: {
    padding: 14, borderRadius: 8, border: "1px solid #e05c5c", background: "rgba(224,92,92,0.08)",
    color: "#e05c5c", fontSize: 12.5, fontFamily: "'SFMono-Regular', Consolas, monospace", whiteSpace: "pre-wrap",
  },
  badge: {
    display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.03em", background: "rgba(79,70,229,0.12)", color: "var(--accent, #4f46e5)",
  },
};

export default function DataFormatConverterTool() {
  const [input, setInput] = useState(SAMPLE_JSON);
  const [inputFormat, setInputFormat] = useState("auto");
  const [outputFormat, setOutputFormat] = useState("yaml");
  const [indent, setIndent] = useState(2);
  const [detected, setDetected] = useState(null);
  const [output, setOutput] = useState("");
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  function convert() {
    if (!input.trim()) {
      setOutput("");
      setError(null);
      setDetected(null);
      return;
    }
    try {
      const { format, value } = detectAndParse(input, inputFormat);
      setDetected(format);
      const result = stringifyAs(value, outputFormat, Number(indent) || 0);
      setOutput(result);
      setError(null);
    } catch (e) {
      setOutput("");
      setError(e.message);
      setDetected(null);
    }
  }

  function copyOutput() {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={styles.root}>
      <Header title="Data Format Converter" repoUrl={REPO_URL} />
      <div style={styles.content}>
        <h1 style={styles.title}>Data Format Converter</h1>
        <p style={styles.subtitle}>
          Paste JSON, YAML, or TOML — auto-detected or forced — and convert it to either of the other two formats.
          Parse errors show the exact line and column whenever the underlying parser reports one. Nothing leaves the browser.
        </p>

        <div style={styles.row}>
          <span style={styles.label}>Input format</span>
          <select style={styles.select} value={inputFormat} onChange={(e) => setInputFormat(e.target.value)}>
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>

          <span style={styles.label}>Convert to</span>
          <select style={styles.select} value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
            {OUTPUT_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>

          {outputFormat !== "toml" && (
            <>
              <span style={styles.label}>Indent</span>
              <input style={styles.numberInput} type="number" min="1" max="8" value={indent} onChange={(e) => setIndent(e.target.value)} />
            </>
          )}

          <button style={styles.btn} onClick={convert}>Convert</button>
          {detected && <span style={styles.badge}>detected: {detected}</span>}
        </div>

        <div style={styles.grid}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <span style={styles.label}>INPUT</span>
            </div>
            <textarea style={styles.textarea} value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} placeholder="Paste JSON, YAML, or TOML here" />
          </div>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <span style={styles.label}>OUTPUT</span>
              {output && <button style={styles.iconBtn} onClick={copyOutput}>{copied ? "Copied" : "Copy"}</button>}
            </div>
            {error ? <div style={styles.errorBox}>{error}</div> : <pre style={styles.outputBox}>{output}</pre>}
          </div>
        </div>
      </div>
    </div>
  );
}
