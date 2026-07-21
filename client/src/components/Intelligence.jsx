import { useState, useEffect } from "react";
import { THEME } from "@vee/shared";
import { listActivity, updateActivityEntry, anthropic } from "../api/client.js";
import { Card, Btn, Label, Spinner, ErrorBox } from "./primitives.jsx";

const { orange: O, green: GR, red: RD, surface3: S3, border: BR, textPrimary: T1, textSecondary: T2, textMuted: T3 } = THEME;

function tally(log, field) {
  const counts = {};
  log.forEach((e) => {
    const key = e[field] || "Unknown";
    if (!counts[key]) counts[key] = { total: 0, positive: 0, meetings: 0 };
    counts[key].total += 1;
    if (e.response_type === "positive" || e.response_received === "yes") counts[key].positive += 1;
    if (e.led_to_meeting === "yes") counts[key].meetings += 1;
  });
  return Object.entries(counts).map(([label, v]) => ({ label, ...v })).sort((a, b) => b.total - a.total);
}

function BarRow({ label, positive, total, meetings }) {
  const pct = total ? Math.round((positive / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: T1 }}>{label}</span>
        <span style={{ fontSize: 11, color: T2, fontFamily: "monospace" }}>
          {positive} convo{positive !== 1 ? "s" : ""} / {total} sent
          {meetings > 0 && <span style={{ color: GR }}> &middot; {meetings} mtg</span>}
        </span>
      </div>
      <div style={{ background: S3, borderRadius: 2, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct >= 30 ? GR : pct >= 15 ? O : RD, borderRadius: 2 }} />
      </div>
    </div>
  );
}

export default function Intelligence() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [insight, setInsight] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [insightError, setInsightError] = useState(null);

  const load = () => {
    setLoading(true);
    listActivity().then((data) => setLog([...data].reverse())).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const totalWithResponse = log.filter((e) => e.response_received === "yes").length;
  const totalPositive = log.filter((e) => e.response_type === "positive").length;
  const totalMeetings = log.filter((e) => e.led_to_meeting === "yes").length;

  const generateInsight = async () => {
    if (log.length < 5) return;
    setGenerating(true); setInsightError(null);
    try {
      const summary = {
        total: log.length,
        byVertical: tally(log, "vertical").slice(0, 5),
        byServiceLine: tally(log, "service_line_fit").slice(0, 4),
        byChannel: tally(log, "channel").slice(0, 4),
        bySignalTier: tally(log, "signal_tier"),
        recentOutcomes: log.slice(0, 10).map((e) => ({ company: e.company, response_type: e.response_type, vertical: e.vertical })),
      };
      const result = await anthropic.coaching({ summary });
      setInsight(result);
    } catch (e) {
      setInsightError(e.message || "Insight generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const logResponse = async (id, patch) => {
    setUpdating(id);
    try {
      await updateActivityEntry(id, patch);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <Card><div style={{ color: T2, fontSize: 13 }}>Loading intelligence data...</div></Card>;
  if (error) return <ErrorBox>{error}</ErrorBox>;

  if (log.length === 0) {
    return (
      <Card>
        <div style={{ fontSize: 13, color: T2, lineHeight: 1.7, marginBottom: 12 }}>
          No outreach logged yet. Complete a workflow and log it in Step 5. Pattern analysis builds automatically after 3+ logged sessions.
        </div>
        <Btn small variant="ghost" onClick={load}>Refresh</Btn>
      </Card>
    );
  }

  if (log.length < 3) {
    return (
      <Card>
        <div style={{ fontSize: 13, color: T2, lineHeight: 1.7 }}>
          Pattern intelligence activates after at least 3 logged sessions.
          <br /><br />
          <span style={{ color: T3 }}>Currently logged: {log.length} session{log.length !== 1 ? "s" : ""}</span>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        {[
          { label: "Total Outreach", value: log.length },
          { label: "Responses", value: `${totalWithResponse} (${log.length ? Math.round((totalWithResponse / log.length) * 100) : 0}%)` },
          { label: "Conversations", value: totalPositive },
          { label: "Meetings Booked", value: totalMeetings },
        ].map((s) => (
          <Card key={s.label} style={{ padding: 14 }}>
            <div style={{ fontSize: 10, color: T3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, color: O, fontWeight: 700 }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <Label>By Vertical</Label>
          {tally(log, "vertical").slice(0, 5).map((r) => <BarRow key={r.label} label={r.label} positive={r.positive} total={r.total} meetings={r.meetings} />)}
        </Card>
        <Card>
          <Label>By Channel</Label>
          {tally(log, "channel").slice(0, 4).map((r) => <BarRow key={r.label} label={r.label} positive={r.positive} total={r.total} meetings={r.meetings} />)}
        </Card>
        <Card>
          <Label>By Service Line</Label>
          {tally(log, "service_line_fit").slice(0, 4).map((r) => <BarRow key={r.label} label={r.label} positive={r.positive} total={r.total} meetings={r.meetings} />)}
        </Card>
        <Card>
          <Label>By Signal Tier</Label>
          {tally(log, "signal_tier").map((r) => <BarRow key={r.label} label={r.label} positive={r.positive} total={r.total} meetings={r.meetings} />)}
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Label style={{ margin: 0 }}>AI Coaching Analysis</Label>
          {log.length >= 5 && (
            <Btn small variant="ghost" onClick={generateInsight} disabled={generating}>
              {generating ? <><Spinner />&nbsp;Analyzing...</> : "Generate Insight"}
            </Btn>
          )}
        </div>
        {log.length < 5 && <div style={{ fontSize: 12, color: T3 }}>Activates after 5+ logged sessions. Currently: {log.length}.</div>}
        <ErrorBox>{insightError}</ErrorBox>
        {insight && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {[
              ["Top Performing Vertical", insight.top_performing_vertical],
              ["Underperforming Area", insight.underperforming_area],
              ["Channel Insight", insight.channel_insight],
              ["Signal Tier Insight", insight.signal_tier_insight],
              ["Recommended Focus", insight.recommended_focus],
              ["Pattern Warning", insight.pattern_warning],
              ["Coaching Note", insight.coaching_note],
            ].map(([label, value]) => value ? (
              <div key={label} style={{ borderLeft: `2px solid ${BR}`, paddingLeft: 10 }}>
                <div style={{ fontSize: 10, color: T3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{value}</div>
              </div>
            ) : null)}
          </div>
        )}
      </Card>

      <Card>
        <Label>Recent Outreach</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {log.slice(0, 15).map((e) => (
            <div key={e.id} style={{ padding: "8px 10px", background: S3, borderRadius: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 12, color: T1, fontWeight: 600 }}>{e.company}</span>
                  <span style={{ fontSize: 11, color: T3 }}> &middot; {e.contact} &middot; {e.channel} &middot; {e.date}</span>
                </div>
                <span style={{ fontSize: 10, color: e.response_received === "yes" ? GR : T3 }}>
                  {e.response_received === "yes" ? `Responded (${e.response_type || "unknown"})` : e.response_received === "no" ? "No response" : "Not logged"}
                </span>
              </div>
              {updating !== e.id && (
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <Btn small variant="ghost" onClick={() => setUpdating(e.id)}>{e.response_received ? "Update" : "Log Response"}</Btn>
                </div>
              )}
              {updating === e.id && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {["yes", "no"].map((v) => (
                    <button key={v} onClick={() => logResponse(e.id, { response_received: v })}
                      style={{ background: "none", border: `1px solid ${BR}`, borderRadius: 4, padding: "3px 8px", fontSize: 10, color: T2, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                      {v}
                    </button>
                  ))}
                  {["positive", "neutral", "negative"].map((t) => (
                    <button key={t} onClick={() => logResponse(e.id, { response_type: t })}
                      style={{ background: "none", border: `1px solid ${BR}`, borderRadius: 4, padding: "3px 8px", fontSize: 10, color: T2, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                      {t}
                    </button>
                  ))}
                  <button onClick={() => setUpdating(null)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", fontSize: 10 }}>Done</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
