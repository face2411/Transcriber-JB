import { useState } from "react";
import { THEME, OUTREACH_CHANNELS, HUBSPOT_STATUSES } from "@vee/shared";
import { logActivity, saveCompany, getCompanyByName, tagCompany } from "../api/client.js";
import { Card, Btn, Label, Textarea, ErrorBox } from "./primitives.jsx";

const { orange: O, green: GR, surface2: S2, border: BR, textPrimary: T1, textSecondary: T2, textMuted: T3 } = THEME;

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function buildSessionBrief(sessionData) {
  const { selectedCompany: co, contact, outreachPkg: pkg, companyNews: news } = sessionData;
  const lines = [];
  lines.push(`# Session Brief - ${co?.name}`);
  lines.push(`**Date:** ${todayISO()}`);
  lines.push("");
  lines.push("## Company");
  lines.push(`**${co?.name}** (${co?.hq || "location unknown"})`);
  lines.push(`Service line: ${co?.service_line_fit} | Signal tier: ${co?.signal_tier}`);
  lines.push(co?.why_now || "");
  if (news?.summary) {
    lines.push("");
    lines.push("## Recent Intelligence");
    lines.push(news.summary);
  }
  lines.push("");
  lines.push("## Contact");
  lines.push(`**${contact?.name}** - ${contact?.title} (${contact?.seniority})`);
  lines.push(`Angle: ${contact?.recommended_angle}`);
  lines.push("");
  lines.push("## Outreach Package");
  if (pkg?.inmail) {
    lines.push(`### LinkedIn InMail`);
    lines.push(`**Subject:** ${pkg.inmail.subject}`);
    lines.push("");
    lines.push(pkg.inmail.body);
    lines.push("");
  }
  if (pkg?.connection_request) {
    lines.push(`### Connection Request`);
    lines.push(pkg.connection_request);
    lines.push("");
  }
  if (pkg?.email) {
    lines.push(`### Email`);
    lines.push(`**Subject:** ${pkg.email.subject}`);
    lines.push("");
    lines.push(pkg.email.body);
  }
  return lines.join("\n");
}

function downloadMarkdown(content, filename) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Step5({ onBack, onDone, sessionData }) {
  const [channel, setChannel] = useState(OUTREACH_CHANNELS[0]);
  const [responseReceived, setResponseReceived] = useState(null);
  const [responseType, setResponseType] = useState(null);
  const [ledToMeeting, setLedToMeeting] = useState(null);
  const [hubspotStatus, setHubspotStatus] = useState(HUBSPOT_STATUSES[0]);
  const [notes, setNotes] = useState("");
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState(null);

  const co = sessionData.selectedCompany;
  const contact = sessionData.contact;

  const logOutreach = async () => {
    setLogging(true); setError(null);
    try {
      await logActivity({
        company: co?.name,
        contact: contact?.name,
        title: contact?.title,
        channel,
        vertical: sessionData.verticalRec?.top_vertical,
        signal_tier: co?.signal_tier,
        service_line_fit: co?.service_line_fit,
        hubspot_status: hubspotStatus,
        notes,
        response_received: responseReceived,
        response_type: responseType,
        led_to_meeting: ledToMeeting,
      });

      const existing = await getCompanyByName(co.name).catch(() => null);
      const history = existing?.contact_history || [];
      await saveCompany(co.name, {
        contact_history: [...history, { name: contact?.name, title: contact?.title, channel, date: todayISO(), response_received: responseReceived, response_type: responseType, led_to_meeting: ledToMeeting }],
      });

      await tagCompany(co.name, {
        reason: "In HubSpot - being worked",
        vertical: sessionData.verticalRec?.top_vertical,
        signal_tier: co?.signal_tier,
        service_line_fit: co?.service_line_fit,
        hq: co?.hq,
      });

      setLogged(true);
    } catch (e) {
      setError(e.message || "Logging failed");
    } finally {
      setLogging(false);
    }
  };

  const YesNo = ({ value, onChange }) => (
    <div style={{ display: "flex", gap: 8 }}>
      {["yes", "no"].map((v) => (
        <button key={v} onClick={() => onChange(v)}
          style={{ background: value === v ? "#2a1500" : S2, border: `1px solid ${value === v ? O : BR}`, borderRadius: 4, padding: "5px 14px", fontSize: 11, color: value === v ? O : T2, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
          {v}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, color: T1, fontWeight: 600, marginBottom: 4 }}>HubSpot Handoff</div>
        <div style={{ fontSize: 13, color: T2 }}>Log this outreach and hand off to HubSpot.</div>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <Label>Channel Used</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {OUTREACH_CHANNELS.map((c) => (
            <button key={c} onClick={() => setChannel(c)}
              style={{ background: channel === c ? "#2a1500" : S2, border: `1px solid ${channel === c ? O : BR}`, borderRadius: 4, padding: "6px 12px", fontSize: 11, color: channel === c ? O : T2, cursor: "pointer", fontFamily: "inherit" }}>
              {c}
            </button>
          ))}
        </div>

        <Label>Response Received? <span style={{ fontWeight: 400, color: T3 }}>(optional - updatable later)</span></Label>
        <div style={{ marginBottom: 16 }}><YesNo value={responseReceived} onChange={setResponseReceived} /></div>

        {responseReceived === "yes" && (
          <>
            <Label>Response Type</Label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["positive", "neutral", "negative"].map((t) => (
                <button key={t} onClick={() => setResponseType(t)}
                  style={{ background: responseType === t ? "#2a1500" : S2, border: `1px solid ${responseType === t ? O : BR}`, borderRadius: 4, padding: "5px 14px", fontSize: 11, color: responseType === t ? O : T2, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                  {t}
                </button>
              ))}
            </div>
            <Label>Led to Meeting?</Label>
            <div style={{ marginBottom: 16 }}><YesNo value={ledToMeeting} onChange={setLedToMeeting} /></div>
          </>
        )}

        <Label>HubSpot Status</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {HUBSPOT_STATUSES.map((s) => (
            <button key={s} onClick={() => setHubspotStatus(s)}
              style={{ background: hubspotStatus === s ? "#0d1a2b" : S2, border: `1px solid ${hubspotStatus === s ? THEME.blue : BR}`, borderRadius: 4, padding: "6px 12px", fontSize: 11, color: hubspotStatus === s ? THEME.blue : T2, cursor: "pointer", fontFamily: "inherit" }}>
              {s}
            </button>
          ))}
        </div>

        <Label>Notes for HubSpot</Label>
        <Textarea value={notes} onChange={setNotes} rows={3} placeholder="Context for the HubSpot entry..." />

        <div style={{ marginTop: 16 }}>
          <Btn onClick={logOutreach} disabled={logging || logged}>
            {logging ? "Logging..." : logged ? "Logged" : "Log Outreach"}
          </Btn>
          {logged && <span style={{ marginLeft: 12, fontSize: 12, color: GR }}>Saved to activity log and tagged "In HubSpot - being worked".</span>}
        </div>
        <ErrorBox>{error}</ErrorBox>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Label>Export</Label>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn small variant="ghost" onClick={() => downloadMarkdown(buildSessionBrief(sessionData), `vee-session-${(co?.name || "company").toLowerCase().replace(/\s+/g, "-")}-${todayISO()}.md`)}>
            Download Session Brief
          </Btn>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="muted" onClick={onBack}>Back</Btn>
        <Btn variant="ghost" onClick={onDone}>Start New Prospect</Btn>
      </div>
    </div>
  );
}
