import { useState } from "react";
import { THEME, ALL_VERTICALS, SIZE_FILTERS } from "@vee/shared";
import { anthropic } from "../api/client.js";
import { Card, Btn, Tag, Label, Input, Spinner, ErrorBox } from "./primitives.jsx";

const { orange: O, blue: BL, green: GR, surface1: S1, surface2: S2, surface3: S3,
  border: BR, textPrimary: T1, textSecondary: T2, textMuted: T3 } = THEME;

function HqFilter({ value, onChange }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: T3, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8 }}>
        Headquarters Location <span style={{ fontSize: 9, color: T3, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
      </div>
      <Input value={value} onChange={onChange} placeholder="e.g. Texas, Chicago IL, Northeast US - leave blank for anywhere" />
    </div>
  );
}

function SizeSelector({ value, onChange }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: T3, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8 }}>Company Size</div>
      <div style={{ display: "flex", gap: 8 }}>
        {SIZE_FILTERS.map((s) => (
          <button key={s.id} onClick={() => onChange(s.id)}
            style={{
              background: value === s.id ? "#2a1500" : S2,
              border: `1px solid ${value === s.id ? O : BR}`,
              borderRadius: 6, padding: "8px 16px", cursor: "pointer",
              fontFamily: "inherit", textAlign: "left",
            }}>
            <div style={{ fontSize: 12, color: value === s.id ? O : T1, fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: T3, marginTop: 2 }}>{s.range}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Step1({ onNext, sessionData, setSessionData }) {
  const [mode, setMode] = useState(sessionData.step1Mode || null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(sessionData.verticalRec || null);
  const [error, setError] = useState(null);
  const [selectedVertical, setSelectedVertical] = useState(sessionData.overrideVertical || "");
  const [buyerType, setBuyerType] = useState(sessionData.buyerType || "operator");
  const [sizeFilter, setSizeFilter] = useState(sessionData.sizeFilter || "any");
  const [hqFilter, setHqFilter] = useState(sessionData.hqFilter || "");
  const [fastCompany, setFastCompany] = useState(sessionData.fastCompany || "");
  const [fastVertical, setFastVertical] = useState(sessionData.overrideVertical || "");
  const [fastUrl, setFastUrl] = useState(sessionData.fastUrl || "");

  const sizeRange = SIZE_FILTERS.find((s) => s.id === sizeFilter)?.range || "201-1,500 employees";

  const setModeAndSave = (m) => {
    setMode(m);
    setSessionData((p) => ({ ...p, step1Mode: m }));
  };

  const runAiRec = async () => {
    setLoading(true); setError(null);
    try {
      const reasoned = await anthropic.verticalRecommendation();
      setResult(reasoned);
      setSelectedVertical(reasoned.focuses[0].vertical);
      setSessionData((p) => ({
        ...p,
        verticalRec: {
          ...reasoned,
          top_vertical: reasoned.focuses[0].vertical,
          entry_title: reasoned.focuses[0].entry_title,
          adjusted_entry_title: reasoned.focuses[0].entry_title,
        },
        overrideVertical: reasoned.focuses[0].vertical,
      }));
    } catch (e) {
      setError(e.message || "Analysis failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const proceedWith = (vertical) => {
    setSessionData((p) => ({
      ...p,
      verticalRec: { ...(p.verticalRec || {}), top_vertical: vertical },
      overrideVertical: vertical,
      buyerType,
      sizeFilter,
      sizeRange,
      hqFilter,
      companies: [],
      skippedCompanies: [],
      selectedCompany: null,
      companyNews: null,
      booleanTracks: null,
      contact: null,
      outreachPkg: null,
    }));
    onNext();
  };

  if (!mode) {
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 20, color: T1, fontWeight: 600, marginBottom: 6 }}>Where are you focusing today?</div>
          <div style={{ fontSize: 13, color: T2 }}>Choose how you want to start.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div onClick={() => setModeAndSave("manual")}
            style={{ background: S1, border: `1px solid ${BR}`, borderRadius: 8, padding: 20, cursor: "pointer" }}>
            <div style={{ fontSize: 14, color: T1, fontWeight: 700, marginBottom: 6 }}>I know my vertical</div>
            <div style={{ fontSize: 11, color: T2, lineHeight: 1.7 }}>Pick a vertical and go straight to company recommendations.</div>
          </div>
          <div onClick={() => setModeAndSave("ai")}
            style={{ background: S1, border: `1px solid ${BR}`, borderRadius: 8, padding: 20, cursor: "pointer" }}>
            <div style={{ fontSize: 14, color: T1, fontWeight: 700, marginBottom: 6 }}>Where should I focus?</div>
            <div style={{ fontSize: 11, color: T2, lineHeight: 1.7 }}>Let the engine recommend the top 3 verticals with highest opportunity right now.</div>
          </div>
          <div onClick={() => setModeAndSave("fast")}
            style={{ background: "#0a1a0a", border: "1px solid #2d4a2d", borderRadius: 8, padding: 20, cursor: "pointer" }}>
            <div style={{ fontSize: 14, color: GR, fontWeight: 700, marginBottom: 6 }}>Fast Mode</div>
            <div style={{ fontSize: 11, color: T2, lineHeight: 1.7 }}>Skip Step 1. Type a company name and go straight to contact finding.</div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "fast") {
    return (
      <div>
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setModeAndSave(null)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", fontSize: 18, padding: 0 }}>&laquo;</button>
          <div>
            <div style={{ fontSize: 20, color: GR, fontWeight: 600 }}>Fast Mode</div>
            <div style={{ fontSize: 13, color: T2 }}>Skip straight to finding the right contact. No AI until Step 3.</div>
          </div>
        </div>
        <Card>
          <Label>Company Name</Label>
          <Input value={fastCompany} onChange={setFastCompany} placeholder="e.g. Modine Manufacturing" />
          <div style={{ marginTop: 12 }}>
            <Label>Company Website URL <span style={{ fontSize: 10, color: T3, fontWeight: 400 }}>(optional - removes ambiguity)</span></Label>
            <Input value={fastUrl} onChange={setFastUrl} placeholder="e.g. https://www.modine.com" />
          </div>
          <div style={{ marginTop: 14 }}>
            <Label>Vertical</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {ALL_VERTICALS.map((v) => (
                <button key={v} onClick={() => setFastVertical(v)}
                  style={{ background: fastVertical === v ? "#2a1500" : S2, border: `1px solid ${fastVertical === v ? O : BR}`, borderRadius: 4, padding: "5px 12px", fontSize: 11, color: fastVertical === v ? O : T2, cursor: "pointer", fontFamily: "inherit" }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <SizeSelector value={sizeFilter} onChange={(f) => { setSizeFilter(f); setSessionData((p) => ({ ...p, sizeFilter: f })); }} />
          <Btn disabled={!fastCompany.trim() || !fastVertical} onClick={() => {
            setSessionData((p) => ({
              ...p,
              verticalRec: { top_vertical: fastVertical, entry_title: "IT Director", adjusted_entry_title: "IT Director" },
              overrideVertical: fastVertical,
              sizeFilter, sizeRange,
              fastMode: true,
              fastCompany: fastCompany.trim(),
              fastUrl: fastUrl.trim(),
              companies: [], skippedCompanies: [], selectedCompany: null,
              companyNews: null, booleanTracks: null, contact: null, outreachPkg: null,
            }));
            onNext();
          }}>
            Go - Find {fastCompany || "Company"}
          </Btn>
        </Card>
      </div>
    );
  }

  if (mode === "manual") {
    return (
      <div>
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setModeAndSave(null)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", fontSize: 18, padding: 0 }}>&laquo;</button>
          <div>
            <div style={{ fontSize: 20, color: T1, fontWeight: 600 }}>Select a vertical</div>
            <div style={{ fontSize: 13, color: T2 }}>Choose where you're focusing today.</div>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <Label>Buyer Type</Label>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setBuyerType("operator")}
              style={{ background: buyerType === "operator" ? "#2a1500" : S2, border: `1px solid ${buyerType === "operator" ? O : BR}`, borderRadius: 6, padding: "10px 18px", fontSize: 13, color: buyerType === "operator" ? O : T2, fontWeight: buyerType === "operator" ? 700 : 400, cursor: "pointer", fontFamily: "inherit", flex: 1, textAlign: "left" }}>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>Companies operating in this vertical</div>
              <div style={{ fontSize: 11, color: T3, fontWeight: 400 }}>General contractors, manufacturers, healthcare systems, logistics operators</div>
            </button>
            <button onClick={() => setBuyerType("software")}
              style={{ background: buyerType === "software" ? "#0d1a2b" : S2, border: `1px solid ${buyerType === "software" ? BL : BR}`, borderRadius: 6, padding: "10px 18px", fontSize: 13, color: buyerType === "software" ? BL : T2, fontWeight: buyerType === "software" ? 700 : 400, cursor: "pointer", fontFamily: "inherit", flex: 1, textAlign: "left" }}>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>Software companies serving this vertical</div>
              <div style={{ fontSize: 11, color: T3, fontWeight: 400 }}>Procore, Autodesk, Trimble, Viewpoint - SaaS/software vendors whose customers are in the vertical</div>
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {ALL_VERTICALS.map((v) => (
            <button key={v} onClick={() => setSelectedVertical(v)}
              style={{
                background: selectedVertical === v ? (buyerType === "software" ? "#0d1a2b" : "#2a1500") : S2,
                border: `1px solid ${selectedVertical === v ? (buyerType === "software" ? BL : O) : BR}`,
                borderRadius: 6, padding: "10px 18px", fontSize: 13,
                color: selectedVertical === v ? (buyerType === "software" ? BL : O) : T2,
                fontWeight: selectedVertical === v ? 700 : 400,
                cursor: "pointer", fontFamily: "inherit",
              }}>
              {v}
            </button>
          ))}
        </div>
        <SizeSelector value={sizeFilter} onChange={(f) => { setSizeFilter(f); setSessionData((p) => ({ ...p, sizeFilter: f })); }} />
        <HqFilter value={hqFilter} onChange={(v) => { setHqFilter(v); setSessionData((p) => ({ ...p, hqFilter: v })); }} />
        <Btn onClick={() => proceedWith(selectedVertical)} disabled={!selectedVertical}>
          Find {buyerType === "software" ? "Software Companies serving" : "Companies in"} {selectedVertical || "..."}
        </Btn>
      </div>
    );
  }

  // -- AI recommendation mode --------------------------------------------------
  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setModeAndSave(null)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", fontSize: 18, padding: 0 }}>&laquo;</button>
        <div>
          <div style={{ fontSize: 20, color: T1, fontWeight: 600 }}>Today's recommended focus</div>
          <div style={{ fontSize: 13, color: T2 }}>Reasoning from pipeline patterns, then validating with live signals.</div>
        </div>
      </div>

      {!result && !loading && (
        <Card>
          <div style={{ fontSize: 13, color: T2, marginBottom: 16, lineHeight: 1.7 }}>
            The engine will analyze Vee's active motions and current market conditions to recommend which vertical deserves your attention today.
          </div>
          <Btn onClick={runAiRec}>Analyze Today's Focus</Btn>
        </Card>
      )}

      {loading && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: T2, fontSize: 13 }}>
            <Spinner /> Reasoning from pipeline patterns, then validating with live signals...
          </div>
        </Card>
      )}

      <ErrorBox>{error}</ErrorBox>

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 11, color: T3, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700 }}>
            Select a focus area to proceed
          </div>
          {result.focuses?.map((focus, i) => {
            const isSelected = selectedVertical === focus.vertical;
            const urgencyColor = focus.urgency === "High" ? "tier1" : focus.urgency === "Medium" ? "tier2" : "tier3";
            return (
              <div key={i} onClick={() => {
                setSelectedVertical(focus.vertical);
                setSessionData((p) => ({
                  ...p,
                  verticalRec: { ...result, top_vertical: focus.vertical, entry_title: focus.entry_title, adjusted_entry_title: focus.entry_title },
                  overrideVertical: focus.vertical,
                }));
              }}
                style={{
                  background: isSelected ? "#1a0f00" : S1,
                  border: `1px solid ${isSelected ? O : BR}`,
                  borderLeft: `3px solid ${isSelected ? O : i === 0 ? THEME.orangeDim : BR}`,
                  borderRadius: 6, padding: "16px 18px", cursor: "pointer",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 11, color: isSelected ? O : T3, fontWeight: 700, fontFamily: "monospace" }}>#{focus.rank}</div>
                    <div style={{ fontSize: 16, color: isSelected ? O : T1, fontWeight: 700 }}>{focus.vertical}</div>
                  </div>
                  <Tag color={urgencyColor}>{focus.urgency}</Tag>
                </div>
                <div style={{ fontSize: 12, color: T2, lineHeight: 1.7, marginBottom: 10 }}>{focus.rationale}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: T3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Entry Title</div>
                    <div style={{ fontSize: 12, color: isSelected ? O : T1, fontWeight: 600 }}>{focus.entry_title}</div>
                    <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{focus.entry_rationale}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: T3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Key Signal</div>
                    <div style={{ fontSize: 11, color: T2, lineHeight: 1.5 }}>{focus.signal_pattern}</div>
                  </div>
                </div>
              </div>
            );
          })}

          <Card style={{ borderStyle: "dashed" }}>
            <Label>Not seeing what you want?</Label>
            <div style={{ fontSize: 12, color: T2, marginBottom: 10 }}>Choose any vertical manually.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {ALL_VERTICALS.map((v) => (
                <button key={v} onClick={() => {
                  setSelectedVertical(v);
                  setSessionData((p) => ({ ...p, verticalRec: { ...(p.verticalRec || {}), top_vertical: v }, overrideVertical: v }));
                }}
                  style={{
                    background: selectedVertical === v && !result.focuses?.find((f) => f.vertical === v) ? "#2a1500" : S2,
                    border: `1px solid ${selectedVertical === v && !result.focuses?.find((f) => f.vertical === v) ? O : BR}`,
                    borderRadius: 4, padding: "5px 12px", fontSize: 11,
                    color: selectedVertical === v && !result.focuses?.find((f) => f.vertical === v) ? O : T2,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  {v}
                </button>
              ))}
            </div>
            <SizeSelector value={sizeFilter} onChange={(f) => { setSizeFilter(f); setSessionData((p) => ({ ...p, sizeFilter: f })); }} />
            <HqFilter value={hqFilter} onChange={(v) => { setHqFilter(v); setSessionData((p) => ({ ...p, hqFilter: v })); }} />
          </Card>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => proceedWith(selectedVertical || result.focuses?.[0]?.vertical)}>
              Find Companies in {selectedVertical || result.focuses?.[0]?.vertical}
            </Btn>
            <Btn variant="ghost" onClick={runAiRec}>Re-run Analysis</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
