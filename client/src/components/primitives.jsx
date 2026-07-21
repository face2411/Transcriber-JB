// Small UI building blocks shared by every screen. Ported 1:1 from the
// original vee-platform.jsx artifact's primitives (Card, Btn, Tag, etc.)
// so the rebuilt app keeps the same look and feel.

import { useState } from "react";
import { THEME, STEPS } from "@vee/shared";

const { orange: O, orangeDim: O2, surface1: S1, surface2: S2, surface3: S3, border: BR,
  textPrimary: T1, textSecondary: T2, textMuted: T3, green: GR, red: RD, blue: BL } = THEME;

export function Label({ children, style }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: T3, marginBottom: 6, ...style }}>{children}</div>;
}

export function Card({ children, style, accent }) {
  return (
    <div style={{
      background: S1, border: `1px solid ${accent ? O2 : BR}`,
      borderRadius: 6, padding: 20,
      borderLeft: accent ? `3px solid ${O}` : undefined,
      ...style,
    }}>{children}</div>
  );
}

export function Btn({ children, onClick, disabled, variant = "primary", small, style }) {
  const base = {
    border: "none", borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
    fontSize: small ? 10 : 12, padding: small ? "4px 10px" : "9px 22px",
    transition: "opacity 0.15s",
    opacity: disabled ? 0.35 : 1,
    fontFamily: "inherit",
    ...style,
  };
  const variants = {
    primary: { background: O, color: "#fff" },
    ghost: { background: "transparent", color: O, border: `1px solid ${O2}` },
    muted: { background: S3, color: T2, border: `1px solid ${BR}` },
    danger: { background: "transparent", color: RD, border: `1px solid #5a2222` },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

export function Tag({ children, color = "default" }) {
  const map = {
    default: { bg: S3, text: T2, bd: BR },
    orange: { bg: "#2a1500", text: O, bd: O2 },
    green: { bg: "#0d2b0d", text: GR, bd: "#2d6b2d" },
    red: { bg: "#2b0d0d", text: RD, bd: "#6b2d2d" },
    blue: { bg: "#0d1a2b", text: BL, bd: "#2d4a6b" },
    tier1: { bg: "#2a1200", text: "#ff8c42", bd: O },
    tier2: { bg: "#0d2b0d", text: GR, bd: "#2d6b2d" },
    tier3: { bg: "#0d1a2b", text: BL, bd: "#2d4a6b" },
  };
  const c = map[color] || map.default;
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.bd}`,
      borderRadius: 3, padding: "2px 8px", fontSize: 10,
      fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      fontFamily: "monospace",
    }}>{children}</span>
  );
}

export function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      navigator.clipboard?.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };
  return (
    <button onClick={copy}
      style={{ background: "none", border: `1px solid ${copied ? "#2d6b2d" : BR}`, borderRadius: 3, padding: "2px 10px", fontSize: 10, color: copied ? GR : T2, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "monospace" }}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function Textarea({ value, onChange, placeholder, rows = 3, mono }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: "100%", background: S2, border: `1px solid ${BR}`, borderRadius: 4, padding: "9px 12px", color: T1, fontSize: mono ? 12 : 13, fontFamily: mono ? "monospace" : "inherit", lineHeight: 1.6, resize: "vertical", boxSizing: "border-box", outline: "none" }} />
  );
}

export function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", background: S2, border: `1px solid ${BR}`, borderRadius: 4, padding: "9px 12px", color: T1, fontSize: 13, boxSizing: "border-box", outline: "none" }} />
  );
}

export function Divider() {
  return <div style={{ borderTop: `1px solid ${BR}`, margin: "18px 0" }} />;
}

export function Spinner() {
  return (
    <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid ${BR}`, borderTop: `2px solid ${O}`, borderRadius: "50%", animation: "spin 0.7s linear infinite" }}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </span>
  );
}

export function DraftBlock({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Label style={{ margin: 0 }}>{label}</Label>
        <CopyBtn text={value} />
      </div>
      <div style={{ background: "#0a0a0a", border: `1px solid ${BR}`, borderRadius: 4, padding: "12px 14px", fontSize: 13, color: "#ccc", whiteSpace: "pre-wrap", lineHeight: 1.7, fontFamily: "inherit" }}>{value}</div>
    </div>
  );
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return <div style={{ color: RD, fontSize: 13, marginBottom: 12 }}>{children}</div>;
}

export function StepBar({ current, onStepClick }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = done && onStepClick;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80 }}>
              <div
                onClick={() => clickable && onStepClick(i)}
                style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  background: done ? O : active ? S3 : S2,
                  border: `2px solid ${done ? O : active ? O : BR}`,
                  color: done ? "#fff" : active ? O : T3,
                  cursor: clickable ? "pointer" : "default",
                }}
                title={done ? `Back to ${s}` : undefined}
              >
                {done ? "✓" : i + 1}
              </div>
              <div style={{ fontSize: 9, color: active ? O : done ? T2 : T3, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center" }}>{s}</div>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: done ? O2 : BR, margin: "0 4px", marginBottom: 16 }} />}
          </div>
        );
      })}
    </div>
  );
}
