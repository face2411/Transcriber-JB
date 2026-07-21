import { useState, useEffect } from "react";
import { THEME, TAG_REASONS, tagColor } from "@vee/shared";
import { getExclusions, removeTag, tagCompany, getCompanyByName } from "../api/client.js";
import { Card, Btn, Tag, Label, Input, Spinner, ErrorBox } from "./primitives.jsx";

const { orange: O, blue: BL, red: RD, surface1: S1, surface2: S2, border: BR, textPrimary: T1, textSecondary: T2, textMuted: T3 } = THEME;

function exportCompanyReport(record) {
  if (!record) return;
  const lines = [];
  lines.push(`# Company Assessment Report`);
  lines.push(`**Company:** ${record.name}`);
  if (record.hq) lines.push(`**HQ:** ${record.hq}`);
  if (record.website) lines.push(`**Website:** ${record.website}`);
  lines.push(`**Assessed:** ${record.last_updated || "Unknown"}`);
  lines.push("");
  if (record.qualification) {
    lines.push(`## ${record.qualification}`);
    if (record.qualification_rationale) lines.push(record.qualification_rationale);
    lines.push("");
  }
  if (record.signal_tier) lines.push(`**Signal Tier:** ${record.signal_tier}`);
  if (record.service_line_fit) lines.push(`**Service Line Fit:** ${record.service_line_fit}`);
  if (record.why_now) lines.push(`\n**Signal:** ${record.why_now}`);
  if (record.news?.summary) {
    lines.push(`\n## Company Intelligence`);
    lines.push(record.news.summary);
  }
  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vee-assessment-${(record.name || "company").toLowerCase().replace(/\s+/g, "-")}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TaggedAccounts({ onStartProspecting }) {
  const [exclusions, setExclusions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [retagging, setRetagging] = useState(null);

  const load = () => {
    setLoading(true);
    getExclusions().then(setExclusions).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const entries = Object.entries(exclusions).map(([name, info]) => ({ name, ...info }));
  const verticals = [...new Set(entries.map((e) => e.vertical).filter(Boolean))].sort();
  const filtered = entries.filter((e) => {
    const matchesTag = tagFilter === "all" || e.reason === tagFilter;
    const matchesVertical = verticalFilter === "all" || e.vertical === verticalFilter;
    const matchesSearch = !search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesTag && matchesVertical && matchesSearch;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const toggleExpand = async (name) => {
    if (expanded === name) { setExpanded(null); setDetail(null); return; }
    setExpanded(name);
    setDetail(null);
    const record = await getCompanyByName(name).catch(() => null);
    setDetail(record);
  };

  const doRetag = async (name, reason, entry) => {
    await tagCompany(name, { reason, vertical: entry.vertical, signal_tier: entry.signal_tier, service_line_fit: entry.service_line_fit, hq: entry.hq });
    setRetagging(null);
    load();
  };

  const doRemove = async (name) => {
    await removeTag(name);
    load();
  };

  if (loading) return <Card><div style={{ display: "flex", alignItems: "center", gap: 10, color: T2, fontSize: 13 }}><Spinner /> Loading tagged accounts...</div></Card>;
  if (error) return <ErrorBox>{error}</ErrorBox>;

  if (entries.length === 0) {
    return (
      <Card>
        <div style={{ fontSize: 13, color: T2, lineHeight: 1.7, marginBottom: 12 }}>
          No tagged companies yet. Tag a company from the Workflow tab and it'll show up here.
        </div>
        <Btn small variant="ghost" onClick={load}>Refresh</Btn>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 20, color: T1, fontWeight: 600 }}>Tagged Accounts ({filtered.length})</div>
        <Btn small variant="ghost" onClick={load}>Refresh</Btn>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Input value={search} onChange={setSearch} placeholder="Search by company name..." />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          <button onClick={() => setTagFilter("all")} style={{ background: tagFilter === "all" ? "#2a1500" : S2, border: `1px solid ${tagFilter === "all" ? O : BR}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, color: tagFilter === "all" ? O : T2, cursor: "pointer", fontFamily: "inherit" }}>All</button>
          {TAG_REASONS.filter((r) => entries.some((e) => e.reason === r)).map((r) => (
            <button key={r} onClick={() => setTagFilter(r)} style={{ background: tagFilter === r ? "#2a1500" : S2, border: `1px solid ${tagFilter === r ? O : BR}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, color: tagFilter === r ? O : T2, cursor: "pointer", fontFamily: "inherit" }}>{r}</button>
          ))}
        </div>
        {verticals.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <button onClick={() => setVerticalFilter("all")} style={{ background: verticalFilter === "all" ? "#0d1a2b" : S2, border: `1px solid ${verticalFilter === "all" ? BL : BR}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, color: verticalFilter === "all" ? BL : T2, cursor: "pointer", fontFamily: "inherit" }}>All Verticals</button>
            {verticals.map((v) => (
              <button key={v} onClick={() => setVerticalFilter(v)} style={{ background: verticalFilter === v ? "#0d1a2b" : S2, border: `1px solid ${verticalFilter === v ? BL : BR}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, color: verticalFilter === v ? BL : T2, cursor: "pointer", fontFamily: "inherit" }}>{v}</button>
            ))}
          </div>
        )}
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((e) => {
          const borderColor = e.reason.startsWith("Disqualified") || e.reason === "Competitor conflict" ? RD : e.reason === "Assigned to another rep" ? "#ffaa44" : BL;
          const isExpanded = expanded === e.name;
          return (
            <Card key={e.name} style={{ borderLeft: `3px solid ${borderColor}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => toggleExpand(e.name)}>
                <div>
                  <div style={{ fontSize: 14, color: T1, fontWeight: 700, marginBottom: 4 }}>{e.name}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Tag color={tagColor(e.reason)}>{e.reason}</Tag>
                    {e.vertical && <Tag>{e.vertical}</Tag>}
                    {e.signal_tier && <Tag color={e.signal_tier === "Tier 1" ? "tier1" : e.signal_tier === "Tier 2" ? "tier2" : "tier3"}>{e.signal_tier}</Tag>}
                  </div>
                  {e.hq && <div style={{ fontSize: 11, color: T3, marginTop: 6 }}>{e.hq} &middot; tagged {e.date}</div>}
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BR}` }}>
                  {!detail && <div style={{ display: "flex", alignItems: "center", gap: 8, color: T2, fontSize: 12 }}><Spinner /> Loading intelligence...</div>}
                  {detail && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {detail.qualification && (
                        <div>
                          <Label>Qualification</Label>
                          <div style={{ fontSize: 12, color: T2 }}>{detail.qualification} - {detail.qualification_rationale}</div>
                          {detail.flags?.map((f, i) => <div key={i} style={{ fontSize: 11, color: RD }}>&bull; {f}</div>)}
                        </div>
                      )}
                      {detail.why_now && (
                        <div>
                          <Label>Signal</Label>
                          <div style={{ fontSize: 12, color: T2 }}>{detail.why_now}</div>
                        </div>
                      )}
                      {detail.news?.summary && (
                        <div>
                          <Label>Company Intelligence</Label>
                          <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{detail.news.summary}</div>
                        </div>
                      )}
                      {detail.contact_history?.length > 0 && (
                        <div>
                          <Label>Contact History</Label>
                          {detail.contact_history.map((c, i) => (
                            <div key={i} style={{ fontSize: 12, color: T2 }}>&bull; {c.name} ({c.title}) - {c.date} via {c.channel}</div>
                          ))}
                        </div>
                      )}
                      {!detail.qualification && !detail.why_now && !detail.news && <div style={{ fontSize: 12, color: T3 }}>No intelligence pulled yet for this company.</div>}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <Btn small onClick={() => onStartProspecting(detail || e)}>Start Prospecting</Btn>
                    {detail && <Btn small variant="ghost" onClick={() => exportCompanyReport(detail)}>Export</Btn>}
                    <Btn small variant="ghost" onClick={() => setRetagging(retagging === e.name ? null : e.name)}>Re-tag</Btn>
                    <Btn small variant="danger" onClick={() => doRemove(e.name)}>Remove</Btn>
                  </div>

                  {retagging === e.name && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {TAG_REASONS.map((r) => (
                        <button key={r} onClick={() => doRetag(e.name, r, e)}
                          style={{ background: S2, border: `1px solid ${BR}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, color: T2, cursor: "pointer", fontFamily: "inherit" }}>
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
