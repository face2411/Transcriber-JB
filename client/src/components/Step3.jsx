import { useState } from "react";
import { THEME } from "@vee/shared";
import { anthropic, hunter } from "../api/client.js";
import { Card, Btn, Tag, Label, Textarea, Spinner, ErrorBox, CopyBtn } from "./primitives.jsx";

const { orange: O, green: GR, red: RD, surface2: S2, border: BR, textPrimary: T1, textSecondary: T2, textMuted: T3 } = THEME;

function guessDomain(name) {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/)[0] + ".com";
}

export default function Step3({ onNext, onBack, sessionData, setSessionData }) {
  const [linkedInData, setLinkedInData] = useState(sessionData.linkedInPaste || "");
  const [loading, setLoading] = useState(false);
  const [contact, setContact] = useState(sessionData.contact || null);
  const [additionalOpps, setAdditionalOpps] = useState(sessionData.additionalOpportunities || []);
  const [error, setError] = useState(null);
  const company = sessionData.selectedCompany;

  const analyze = async () => {
    if (!linkedInData.trim()) return;
    setLoading(true); setError(null);
    try {
      const result = await anthropic.contactAnalysis({ linkedInText: linkedInData, company });
      setContact(result.contact);
      setAdditionalOpps(result.additional_opportunities || []);
      setSessionData((p) => ({
        ...p,
        contact: result.contact,
        linkedInPaste: linkedInData,
        outreachPkg: result.outreach,
        additionalOpportunities: result.additional_opportunities || [],
      }));
    } catch (e) {
      setError(e.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  // -- Dynamic boolean search strings ------------------------------------------
  const [booleanTracks, setBooleanTracks] = useState(sessionData.booleanTracks || null);
  const [boolLoading, setBoolLoading] = useState(false);
  const [boolError, setBoolError] = useState(null);

  const generateBooleans = async () => {
    setBoolLoading(true); setBoolError(null);
    try {
      const { tracks } = await anthropic.booleanStrings({ company });
      setBooleanTracks(tracks);
      setSessionData((p) => ({ ...p, booleanTracks: tracks }));
    } catch (e) {
      setBoolError(e.message || "Boolean string generation failed");
    } finally {
      setBoolLoading(false);
    }
  };

  const navURL = (boolean) => `https://www.linkedin.com/sales/search/people?keywords=${encodeURIComponent(boolean)}&company=${encodeURIComponent(company?.name || "")}`;

  // -- Key leadership lookup (best-effort public info, not a verified org chart) --
  const [leadership, setLeadership] = useState(sessionData.leadership || null);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [leaderError, setLeaderError] = useState(null);

  const fetchLeadership = async () => {
    setLeaderLoading(true); setLeaderError(null);
    try {
      const result = await anthropic.leadershipLookup({
        name: company?.name, website: company?.website, domain: company?.domain,
      });
      setLeadership(result);
      setSessionData((p) => ({ ...p, leadership: result }));
    } catch (e) {
      setLeaderError(e.message || "Leadership lookup failed");
    } finally {
      setLeaderLoading(false);
    }
  };

  // -- Hunter email lookup -------------------------------------------------------
  const [emailResult, setEmailResult] = useState(sessionData.emailResult || null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [customDomain, setCustomDomain] = useState("");
  const defaultDomain = company?.domain || guessDomain(company?.name);

  const fetchEmail = async () => {
    if (!contact?.name) return;
    setEmailLoading(true); setEmailError(null); setEmailResult(null);
    const domain = customDomain.trim() || defaultDomain;
    const [firstName, ...rest] = contact.name.trim().split(" ");
    try {
      const result = await hunter.emailFinder({ domain, firstName, lastName: rest.join(" ") });
      setEmailResult(result);
      if (result.found) setSessionData((p) => ({ ...p, emailResult: result, contact: { ...p.contact, email: result.email } }));
    } catch (e) {
      setEmailError(e.message || "Email lookup failed");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, color: T1, fontWeight: 600, marginBottom: 4 }}>Find the right contact</div>
        <div style={{ fontSize: 13, color: T2 }}>{company?.name} &middot; {company?.service_line_fit}</div>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Label style={{ margin: 0 }}>Key Leadership</Label>
          <Btn small variant="ghost" onClick={fetchLeadership} disabled={leaderLoading}>
            {leaderLoading ? <><Spinner />&nbsp;Searching...</> : leadership ? "Refresh" : "Find Leadership"}
          </Btn>
        </div>
        <ErrorBox>{leaderError}</ErrorBox>
        {!leadership && !leaderLoading && (
          <div style={{ fontSize: 12, color: T3 }}>Best-effort public info (LinkedIn, press releases, company site) - not a verified org chart.</div>
        )}
        {leadership && (
          <div>
            {leadership.leaders?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
                {leadership.leaders.map((l, i) => (
                  <div key={i} style={{ borderLeft: `2px solid ${BR}`, paddingLeft: 10 }}>
                    <div style={{ fontSize: 13, color: T1, fontWeight: 700 }}>{l.name}</div>
                    <div style={{ fontSize: 12, color: T2 }}>{l.title}</div>
                    {l.relevance && <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{l.relevance}</div>}
                    {l.source_note && <div style={{ fontSize: 10, color: T3, marginTop: 2, fontStyle: "italic" }}>{l.source_note}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: T3, marginBottom: 8 }}>{leadership.note}</div>
            )}
            {leadership.leaders?.length > 0 && leadership.note && (
              <div style={{ fontSize: 11, color: T3, fontStyle: "italic" }}>{leadership.note}</div>
            )}
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Label style={{ margin: 0 }}>Boolean Search Strings (LinkedIn Sales Navigator)</Label>
          <Btn small variant="ghost" onClick={generateBooleans} disabled={boolLoading}>
            {boolLoading ? <><Spinner />&nbsp;Generating...</> : booleanTracks ? "Regenerate" : "Generate"}
          </Btn>
        </div>
        <ErrorBox>{boolError}</ErrorBox>
        {!booleanTracks && !boolLoading && (
          <div style={{ fontSize: 12, color: T3 }}>Generates search tracks tailored to this company's signal and service line fit.</div>
        )}
        {booleanTracks && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {booleanTracks.map((t, i) => (
              <div key={i} style={{ borderLeft: `2px solid ${BR}`, paddingLeft: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <div style={{ fontSize: 12, color: T1, fontWeight: 700 }}>{t.label}</div>
                  <Tag>{t.seniority}</Tag>
                </div>
                <div style={{ fontSize: 11, color: T3, marginBottom: 4 }}>{t.rationale}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <code style={{ fontSize: 11, color: "#ccc", background: "#0a0a0a", padding: "4px 8px", borderRadius: 3, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.boolean}</code>
                  <CopyBtn text={t.boolean} />
                  <a href={navURL(t.boolean)} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: O, whiteSpace: "nowrap" }}>Open in Sales Nav</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Label>Paste LinkedIn Profile Text</Label>
        <Textarea value={linkedInData} onChange={setLinkedInData} rows={8} mono placeholder="Paste the full profile text here..." />
        <div style={{ marginTop: 10 }}>
          <Btn onClick={analyze} disabled={!linkedInData.trim() || loading}>
            {loading ? <><Spinner />&nbsp;Analyzing...</> : "Analyze + Generate Outreach"}
          </Btn>
        </div>
        <ErrorBox>{error}</ErrorBox>
      </Card>

      {contact && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, color: T1, fontWeight: 700 }}>{contact.name}</div>
              <div style={{ fontSize: 12, color: T2 }}>{contact.title}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Tag>{contact.seniority}</Tag>
              {contact.is_economic_buyer && <Tag color="green">Economic Buyer</Tag>}
              {contact.offshore_exposure && <Tag color="red">Offshore Exposure</Tag>}
            </div>
          </div>
          {contact.offshore_note && <div style={{ fontSize: 12, color: T2, marginBottom: 8 }}>{contact.offshore_note}</div>}
          {contact.pain_indicators?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Label>Pain Indicators</Label>
              {contact.pain_indicators.map((p, i) => <div key={i} style={{ fontSize: 12, color: T2 }}>&bull; {p}</div>)}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
            <div><Label>Recommended Angle</Label><div style={{ fontSize: 12, color: T1 }}>{contact.recommended_angle}</div></div>
            <div><Label>Channel</Label><div style={{ fontSize: 12, color: T1 }}>{contact.outreach_channel}</div></div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BR}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Label style={{ margin: 0 }}>Email Lookup</Label>
              <Btn small variant="ghost" onClick={fetchEmail} disabled={emailLoading}>
                {emailLoading ? <><Spinner />&nbsp;Looking up...</> : "Find Email"}
              </Btn>
            </div>
            <input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder={defaultDomain}
              style={{ width: "100%", background: S2, border: `1px solid ${BR}`, borderRadius: 4, padding: "6px 10px", color: T1, fontSize: 11, boxSizing: "border-box", marginBottom: 8 }} />
            {emailError && <div style={{ fontSize: 11, color: RD }}>{emailError}</div>}
            {emailResult && emailResult.found && (
              <div style={{ fontSize: 12, color: GR, fontFamily: "monospace" }}>{emailResult.email} <span style={{ color: T3 }}>({emailResult.confidence} confidence)</span></div>
            )}
            {emailResult && !emailResult.found && <div style={{ fontSize: 11, color: T3 }}>No email found for {emailResult.domain}.</div>}
          </div>

          {additionalOpps.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BR}` }}>
              <Label>Additional Vee Entry Points</Label>
              {additionalOpps.map((o, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <Tag color="blue">{o.service_line}</Tag>
                  <div style={{ fontSize: 12, color: T2, marginTop: 4 }}>{o.rationale}</div>
                  <div style={{ fontSize: 11, color: T3 }}>Entry point: {o.entry_point}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={onNext} disabled={!contact}>Continue to Outreach</Btn>
        <Btn variant="muted" onClick={onBack}>Back</Btn>
      </div>
    </div>
  );
}
