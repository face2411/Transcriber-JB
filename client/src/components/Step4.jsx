import { useState, useEffect } from "react";
import { THEME } from "@vee/shared";
import { anthropic } from "../api/client.js";
import { Card, Btn, Tag, Label, Textarea, Spinner, ErrorBox, DraftBlock, Divider, CopyBtn } from "./primitives.jsx";

const { green: GR, red: RD, textPrimary: T1, textSecondary: T2, border: BR } = THEME;

export default function Step4({ onNext, onBack, sessionData, setSessionData }) {
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState(sessionData.outreachPkg || null);
  const [directorNotes, setDirectorNotes] = useState("");
  const [revising, setRevising] = useState(false);
  const [error, setError] = useState(null);

  const company = sessionData.selectedCompany;
  const contact = sessionData.contact;

  const generate = async (notes = "") => {
    const setBusy = notes ? setRevising : setLoading;
    setBusy(true); setError(null);
    try {
      const result = await anthropic.outreach({ company, contact, notes });
      setPkg(result);
      setSessionData((p) => ({ ...p, outreachPkg: result }));
    } catch (e) {
      setError(e.message || "Outreach generation failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!pkg) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const charCount = pkg?.connection_request?.length || 0;
  const charOk = charCount <= 275;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, color: T1, fontWeight: 600, marginBottom: 4 }}>Outreach package</div>
        <div style={{ fontSize: 13, color: T2 }}>{contact?.name} &middot; {contact?.title} &middot; {company?.name}</div>
      </div>

      {(loading || revising) && (
        <Card><div style={{ display: "flex", alignItems: "center", gap: 12, color: T2, fontSize: 13 }}><Spinner /> {revising ? "Revising to your direction..." : "Drafting outreach..."}</div></Card>
      )}
      <ErrorBox>{error}</ErrorBox>

      {pkg && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <div style={{ marginBottom: 10 }}><Tag color="orange">Lead with: {pkg.recommended_channel}</Tag></div>
            <Divider />
            <DraftBlock label="LinkedIn InMail - Subject" value={pkg.inmail?.subject} />
            <DraftBlock label="LinkedIn InMail - Body" value={pkg.inmail?.body} />
            <Divider />
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Label style={{ margin: 0 }}>Connection Request</Label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: charOk ? GR : RD, fontFamily: "monospace" }}>{charCount}/275</span>
                  <CopyBtn text={pkg.connection_request} />
                </div>
              </div>
              <div style={{ background: "#0a0a0a", border: `1px solid ${charOk ? BR : RD}`, borderRadius: 4, padding: "12px 14px", fontSize: 12, color: "#ccc", whiteSpace: "pre-wrap", lineHeight: 1.7, fontFamily: "monospace" }}>
                {pkg.connection_request}
              </div>
              {!charOk && <div style={{ fontSize: 11, color: RD, marginTop: 4 }}>Over character limit - revise below.</div>}
            </div>
            <Divider />
            <DraftBlock label="Email - Subject" value={pkg.email?.subject} />
            <DraftBlock label="Email - Body" value={pkg.email?.body} />
          </Card>

          {pkg.sequence && (
            <Card>
              <Label>Sequence Decision Tree</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { k: "if_accept_no_response", l: "If they connect but don't respond" },
                  { k: "if_not_right_now", l: "If they say not right now" },
                  { k: "if_wrong_contact", l: "If this is the wrong person" },
                ].map(({ k, l }) => (
                  <div key={k} style={{ paddingLeft: 12, borderLeft: `2px solid ${BR}` }}>
                    <div style={{ fontSize: 10, color: T2, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 13, color: T2, lineHeight: 1.6 }}>{pkg.sequence[k]}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card style={{ borderStyle: "dashed" }}>
            <Label>Director Override</Label>
            <div style={{ fontSize: 12, color: T2, marginBottom: 10 }}>Paste feedback and the draft will be revised to spec.</div>
            <Textarea value={directorNotes} onChange={setDirectorNotes} rows={3} placeholder="e.g. shorten the InMail, lead with the M&A angle instead..." />
            <div style={{ marginTop: 10 }}>
              <Btn variant="ghost" onClick={() => generate(directorNotes)} disabled={!directorNotes.trim() || revising}>
                {revising ? <><Spinner />&nbsp;Revising...</> : "Revise Draft"}
              </Btn>
            </div>
          </Card>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={onNext}>Continue to Activity Log</Btn>
            <Btn variant="muted" onClick={onBack}>Back</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
