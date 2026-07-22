import { useState, useEffect } from "react";
import { THEME, SIGNAL_TYPES, TAG_REASONS, tagColor } from "@vee/shared";
import { anthropic, getExclusions, tagCompany as apiTagCompany, removeTag as apiRemoveTag, getCompanyByName, saveCompany } from "../api/client.js";
import { Card, Btn, Tag, Label, Spinner, ErrorBox, Input } from "./primitives.jsx";

const { orange: O, orangeDim: O2, green: GR, blue: BL, surface1: S1, surface2: S2, surface3: S3,
  border: BR, textPrimary: T1, textSecondary: T2, textMuted: T3, red: RD } = THEME;

const tierColor = (t) => (t === "Tier 1" ? "tier1" : t === "Tier 2" ? "tier2" : "tier3");
const liCompanyURL = (name) => `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(name)}`;
// Falls back to a Google search when the AI wasn't confident of the exact
// domain, rather than guessing/inventing one - matches spec.md's "Website
// (cached domain or Google search)" action link.
const websiteURL = (co) => co.website || `https://www.google.com/search?q=${encodeURIComponent(co.name + " official website")}`;

export default function Step2({ onNext, onBack, sessionData, setSessionData }) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [companies, setCompanies] = useState(sessionData.companies || []);
  const [skipped, setSkipped] = useState(sessionData.skippedCompanies || []);
  const [selected, setSelected] = useState(sessionData.selectedCompany || null);
  const [error, setError] = useState(null);
  const [exclusions, setExclusions] = useState({});
  const [tagging, setTagging] = useState(null);
  const [showTagBrowser, setShowTagBrowser] = useState(false);
  const [tagFilter, setTagFilter] = useState("all");
  const [tagSearch, setTagSearch] = useState("");
  const [tagVerticalFilter, setTagVerticalFilter] = useState("all");

  const [tier1Only, setTier1Only] = useState(sessionData.tier1Only || false);
  const [signalTypes, setSignalTypes] = useState(sessionData.signalTypes || []);

  const vertical = sessionData.verticalRec?.top_vertical || "manufacturing";
  const sizeRange = sessionData.sizeRange || "201-1,500 employees";
  const buyerType = sessionData.buyerType || "operator";

  useEffect(() => {
    getExclusions().then(setExclusions).catch(() => {});
  }, []);

  // Fast Mode: user named a specific company - run a real one-off assessment.
  const [fastLoading, setFastLoading] = useState(false);
  const [fastError, setFastError] = useState(null);
  const [fastResult, setFastResult] = useState(sessionData.fastResult || null);

  useEffect(() => {
    if (!sessionData.fastMode || !sessionData.fastCompany || fastResult) return;
    setFastLoading(true); setFastError(null);
    anthropic.fastResearch({ company: sessionData.fastCompany, url: sessionData.fastUrl, vertical: sessionData.verticalRec?.top_vertical })
      .then((assessment) => {
        setFastResult(assessment);
        setSessionData((p) => ({ ...p, fastResult: assessment }));
        return saveCompany(assessment.name, assessment);
      })
      .catch((e) => setFastError(e.message))
      .finally(() => setFastLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seenNames = [...companies.map((c) => c.name), ...skipped];
  const excludedNames = Object.keys(exclusions);

  const findCompanies = async (append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    const excludeList = append ? [...new Set([...seenNames, ...excludedNames])] : excludedNames;
    try {
      const { companies: results } = await anthropic.companySearch({
        vertical, buyerType, sizeRange, tier1Only, signalTypes, excludeList,
      });
      const updated = append ? [...companies, ...results] : results;
      setCompanies(updated);
      setSessionData((p) => ({ ...p, companies: updated, tier1Only, signalTypes }));
    } catch (e) {
      setError(e.message || "Company search failed");
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  };

  const skipCompany = (name) => {
    const updated = [...skipped, name];
    setSkipped(updated);
    setSessionData((p) => ({ ...p, skippedCompanies: updated }));
    if (selected?.name === name) { setSelected(null); setSessionData((p) => ({ ...p, selectedCompany: null })); }
  };

  const [tagReasonPicker, setTagReasonPicker] = useState(null);
  const doTag = async (name, reason, co) => {
    try {
      await apiTagCompany(name, {
        reason, vertical: co?.vertical || vertical, signal_tier: co?.signal_tier, service_line_fit: co?.service_line_fit, hq: co?.hq,
      });
      const next = await getExclusions();
      setExclusions(next);
    } catch (e) {
      setError(e.message);
    }
    setTagging(null); setTagReasonPicker(null);
  };

  const removeExclusion = async (name) => {
    try {
      await apiRemoveTag(name);
      const next = await getExclusions();
      setExclusions(next);
    } catch (e) {
      setError(e.message);
    }
  };

  const [newsLoading, setNewsLoading] = useState(false);
  const [news, setNews] = useState(sessionData.companyNews || null);
  const [newsError, setNewsError] = useState(null);
  const [newsUrl, setNewsUrl] = useState("");
  const [cachedRecord, setCachedRecord] = useState(null);

  const selectCompany = async (co) => {
    setSelected(co);
    setSessionData((p) => ({ ...p, selectedCompany: co }));
    setNews(null); setNewsError(null);
    const existing = await getCompanyByName(co.name).catch(() => null);
    setCachedRecord(existing);
    if (existing?.news) {
      setNews(existing.news);
      setSessionData((p) => ({ ...p, companyNews: existing.news }));
    }
  };

  const fetchNews = async (co, forceRefresh = false) => {
    if (!forceRefresh && news) return;
    setNewsLoading(true); setNewsError(null);
    try {
      const result = await anthropic.newsIntel({
        name: co.name, website: co.website, domain: co.domain, disambiguationUrl: newsUrl.trim(),
      });
      setNews(result);
      setSessionData((p) => ({ ...p, companyNews: result }));
      await saveCompany(co.name, {
        news: result, signal_tier: co.signal_tier, service_line_fit: co.service_line_fit, hq: co.hq, why_now: co.why_now, gcc_risk: co.gcc_risk,
      });
      if (result.signals?.length > 0) {
        setCompanies((prev) => prev.map((c) => (c.name === co.name ? { ...c, signal_verified: true } : c)));
      }
    } catch (e) {
      setNewsError(e.message || "News search failed");
    } finally {
      setNewsLoading(false);
    }
  };

  const goToContact = () => {
    setSessionData((p) => ({ ...p, selectedCompany: selected, companyNews: news }));
    onNext();
  };

  // -- Fast Mode result screen -------------------------------------------------
  if (sessionData.fastMode) {
    if (fastLoading) {
      return <Card><div style={{ display: "flex", alignItems: "center", gap: 12, color: T2, fontSize: 13 }}><Spinner /> Researching {sessionData.fastCompany}...</div></Card>;
    }
    if (fastError) return <div><ErrorBox>{fastError}</ErrorBox><Btn variant="muted" onClick={onBack}>Back</Btn></div>;
    if (!fastResult) return null;

    const qColor = fastResult.qualification === "Qualified" ? "green" : fastResult.qualification === "Disqualified" ? "red" : "orange";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card accent>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 18, color: T1, fontWeight: 700 }}>{fastResult.name}</div>
              <div style={{ fontSize: 12, color: T2 }}>{fastResult.hq}</div>
            </div>
            <Tag color={qColor}>{fastResult.qualification}</Tag>
          </div>
          <div style={{ fontSize: 13, color: T2, lineHeight: 1.7, marginBottom: 10 }}>{fastResult.qualification_rationale}</div>
          {fastResult.flags?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <Label>Red Flags</Label>
              {fastResult.flags.map((f, i) => <div key={i} style={{ fontSize: 12, color: RD }}>&bull; {f}</div>)}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <Label>Signal Tier</Label>
              <Tag color={tierColor(fastResult.signal_tier)}>{fastResult.signal_tier}</Tag>
              {fastResult.tier_rationale && <div style={{ fontSize: 11, color: T3, fontStyle: "italic", marginTop: 4 }}>{fastResult.tier_rationale}</div>}
            </div>
            <div><Label>Service Line</Label><div style={{ fontSize: 12, color: T1 }}>{fastResult.service_line_fit}</div></div>
            <div><Label>Est. Employees</Label><div style={{ fontSize: 12, color: T1 }}>{fastResult.estimated_employees || "unknown"}</div></div>
            <div><Label>GCC Risk</Label><div style={{ fontSize: 12, color: fastResult.gcc_risk === "flag" ? RD : T1 }}>{fastResult.gcc_risk}{fastResult.gcc_note ? ` - ${fastResult.gcc_note}` : ""}</div></div>
          </div>
          {fastResult.why_now && <div style={{ marginTop: 10, fontSize: 12, color: T2, fontStyle: "italic" }}>{fastResult.why_now}</div>}
        </Card>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={() => { setSessionData((p) => ({ ...p, selectedCompany: fastResult })); onNext(); }}>Start Prospecting</Btn>
          <Btn variant="ghost" onClick={() => setTagReasonPicker(fastResult.name)}>Tag</Btn>
          <Btn variant="muted" onClick={onBack}>Back</Btn>
        </div>
        {tagReasonPicker === fastResult.name && (
          <Card>
            <Label>Tag reason</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TAG_REASONS.map((r) => (
                <button key={r} onClick={() => doTag(fastResult.name, r, fastResult)}
                  style={{ background: S2, border: `1px solid ${BR}`, borderRadius: 4, padding: "5px 10px", fontSize: 11, color: T2, cursor: "pointer", fontFamily: "inherit" }}>
                  {r}
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // -- Pre-search filter screen -------------------------------------------------
  if (companies.length === 0 && !loading) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, color: T1, fontWeight: 600, marginBottom: 4 }}>Companies in {vertical}</div>
          <div style={{ fontSize: 13, color: T2 }}>Optional filters, then find candidates.</div>
        </div>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <input type="checkbox" checked={tier1Only} onChange={(e) => setTier1Only(e.target.checked)} id="tier1only" />
            <label htmlFor="tier1only" style={{ fontSize: 12, color: T1, cursor: "pointer" }}>Tier 1 Only - highest confidence accounts</label>
          </div>
          <Label>Signal Type Focus</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
            {SIGNAL_TYPES.map((s) => {
              const active = signalTypes.includes(s.id);
              return (
                <button key={s.id} onClick={() => setSignalTypes((prev) => active ? prev.filter((x) => x !== s.id) : [...prev, s.id])}
                  style={{ background: active ? "#2a1500" : S2, border: `1px solid ${active ? O : BR}`, borderRadius: 4, padding: "6px 12px", fontSize: 11, color: active ? O : T2, cursor: "pointer", fontFamily: "inherit" }}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </Card>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <Btn onClick={() => findCompanies(false)} disabled={loading}>
            {loading ? <><Spinner />&nbsp;Finding...</> : "Find Companies"}
          </Btn>
          <Btn variant="ghost" onClick={() => setShowTagBrowser((v) => !v)}>{showTagBrowser ? "Hide" : "Browse"} Tagged Accounts</Btn>
          <Btn variant="muted" onClick={onBack}>Back</Btn>
        </div>
        <ErrorBox>{error}</ErrorBox>
        {showTagBrowser && (
          <TagBrowser exclusions={exclusions} tagFilter={tagFilter} setTagFilter={setTagFilter} tagSearch={tagSearch} setTagSearch={setTagSearch}
            tagVerticalFilter={tagVerticalFilter} setTagVerticalFilter={setTagVerticalFilter} onRemove={removeExclusion} />
        )}
      </div>
    );
  }

  if (loading) {
    return <Card><div style={{ display: "flex", alignItems: "center", gap: 12, color: T2, fontSize: 13 }}><Spinner /> Finding companies in {vertical}...</div></Card>;
  }

  // -- Company list + intelligence panel ---------------------------------------
  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 20, color: T1, fontWeight: 600, marginBottom: 4 }}>Companies in {vertical}</div>
          <div style={{ fontSize: 13, color: T2 }}>{companies.length} candidates. Click a card to research.</div>
        </div>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {companies.filter((c) => !skipped.includes(c.name)).map((co) => (
            <div key={co.name} onClick={() => selectCompany(co)}
              style={{
                background: selected?.name === co.name ? "#1a0f00" : S1,
                border: `1px solid ${selected?.name === co.name ? O : BR}`,
                borderLeft: `3px solid ${selected?.name === co.name ? O : O2}`,
                borderRadius: 6, padding: 14, cursor: "pointer",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 14, color: T1, fontWeight: 700 }}>{co.name}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Tag color={tierColor(co.signal_tier)}>{co.signal_tier}</Tag>
                  {co.signal_verified && <Tag color="green">Verified</Tag>}
                </div>
              </div>
              {co.hq && <div style={{ fontSize: 11, color: T3, marginBottom: 6 }}>{co.hq}</div>}
              {co.tier_rationale && <div style={{ fontSize: 11, color: T3, fontStyle: "italic", marginBottom: 6 }}>Why {co.signal_tier}: {co.tier_rationale}</div>}
              <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, marginBottom: 8 }}>{co.why_now}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {(co.matched_signal_types || []).map((id) => {
                  const st = SIGNAL_TYPES.find((s) => s.id === id);
                  return st ? <Tag key={id}>{st.label}</Tag> : null;
                })}
              </div>
              {co.gcc_risk && co.gcc_risk !== "low" && <div style={{ fontSize: 11, color: RD, marginBottom: 6 }}>GCC: {co.gcc_note}</div>}
              <div style={{ display: "flex", gap: 10, fontSize: 11 }} onClick={(e) => e.stopPropagation()}>
                <a href={liCompanyURL(co.name)} target="_blank" rel="noreferrer" style={{ color: BL }}>LinkedIn</a>
                <a href={websiteURL(co)} target="_blank" rel="noreferrer" style={{ color: BL }}>{co.website ? "Website" : "Website (search)"}</a>
                <button onClick={() => skipCompany(co.name)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", fontSize: 11, padding: 0 }}>Skip</button>
                <button onClick={() => setTagReasonPicker(tagReasonPicker === co.name ? null : co.name)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", fontSize: 11, padding: 0 }}>Tag</button>
              </div>
              {tagReasonPicker === co.name && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                  {TAG_REASONS.map((r) => (
                    <button key={r} onClick={() => doTag(co.name, r, co)}
                      style={{ background: S2, border: `1px solid ${BR}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, color: T2, cursor: "pointer", fontFamily: "inherit" }}>
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {selected && (
          <Card style={{ alignSelf: "flex-start", position: "sticky", top: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 15, color: T1, fontWeight: 700 }}>{selected.name}</div>
              {cachedRecord && <Tag color="green">Intel cached</Tag>}
            </div>
            <div style={{ fontSize: 12, color: T2, marginBottom: 14 }}>{selected.service_line_fit}</div>
            <Label>Disambiguation URL <span style={{ fontWeight: 400, color: T3 }}>(optional)</span></Label>
            <Input value={newsUrl} onChange={setNewsUrl} placeholder="https://company.com" />
            <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
              <Btn small onClick={() => fetchNews(selected, false)} disabled={newsLoading}>
                {newsLoading ? <><Spinner />&nbsp;Pulling...</> : "Pull Recent News"}
              </Btn>
              {news && <Btn small variant="ghost" onClick={() => fetchNews(selected, true)} disabled={newsLoading}>Refresh</Btn>}
            </div>
            <ErrorBox>{newsError}</ErrorBox>
            {news && (
              <div>
                <div style={{ fontSize: 12, color: T2, lineHeight: 1.7, marginBottom: 12 }}>{news.summary}</div>
                {news.signals?.map((s, i) => (
                  <div key={i} style={{ borderLeft: `2px solid ${BR}`, paddingLeft: 10, marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                      <Tag color={s.signal_strength === "High" ? "tier1" : s.signal_strength === "Medium" ? "tier2" : "tier3"}>{s.signal_strength}</Tag>
                      <Tag>{s.category}</Tag>
                    </div>
                    <div style={{ fontSize: 12, color: T1, fontWeight: 600 }}>{s.headline}</div>
                    <div style={{ fontSize: 11, color: T2, marginTop: 2 }}>{s.detail}</div>
                    {s.prospecting_relevance && <div style={{ fontSize: 11, color: O, marginTop: 2, fontStyle: "italic" }}>Vee angle: {s.prospecting_relevance}</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn onClick={goToContact}>Start Prospecting</Btn>
              <Btn variant="ghost" onClick={() => setTagReasonPicker(selected.name)}>Tag</Btn>
            </div>
            {tagReasonPicker === selected.name && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {TAG_REASONS.map((r) => (
                  <button key={r} onClick={() => doTag(selected.name, r, selected)}
                    style={{ background: S2, border: `1px solid ${BR}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, color: T2, cursor: "pointer", fontFamily: "inherit" }}>
                    {r}
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <Btn variant="ghost" onClick={() => findCompanies(true)} disabled={loadingMore}>
          {loadingMore ? <><Spinner />&nbsp;Loading...</> : "Find More Companies"}
        </Btn>
        <Btn variant="muted" onClick={() => findCompanies(false)} disabled={loading || loadingMore}>Reset List</Btn>
        <Btn variant="muted" onClick={onBack}>Back</Btn>
      </div>
    </div>
  );
}

function TagBrowser({ exclusions, tagFilter, setTagFilter, tagSearch, setTagSearch, tagVerticalFilter, setTagVerticalFilter, onRemove }) {
  const entries = Object.entries(exclusions).map(([name, info]) => ({ name, ...info }));
  const verticals = [...new Set(entries.map((e) => e.vertical).filter(Boolean))].sort();
  const filtered = entries.filter((e) => {
    const matchesTag = tagFilter === "all" || e.reason === tagFilter;
    const matchesVertical = tagVerticalFilter === "all" || e.vertical === tagVerticalFilter;
    const matchesSearch = !tagSearch.trim() || e.name.toLowerCase().includes(tagSearch.trim().toLowerCase());
    return matchesTag && matchesVertical && matchesSearch;
  });

  return (
    <Card style={{ marginTop: 14 }}>
      <Label>Tagged Accounts ({entries.length})</Label>
      <Input value={tagSearch} onChange={setTagSearch} placeholder="Search by name..." />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0" }}>
        <button onClick={() => setTagFilter("all")} style={{ background: tagFilter === "all" ? "#2a1500" : S2, border: `1px solid ${tagFilter === "all" ? O : BR}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, color: tagFilter === "all" ? O : T2, cursor: "pointer", fontFamily: "inherit" }}>All</button>
        {TAG_REASONS.filter((r) => entries.some((e) => e.reason === r)).map((r) => (
          <button key={r} onClick={() => setTagFilter(r)} style={{ background: tagFilter === r ? "#2a1500" : S2, border: `1px solid ${tagFilter === r ? O : BR}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, color: tagFilter === r ? O : T2, cursor: "pointer", fontFamily: "inherit" }}>{r}</button>
        ))}
      </div>
      {verticals.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          <button onClick={() => setTagVerticalFilter("all")} style={{ background: tagVerticalFilter === "all" ? "#0d1a2b" : S2, border: `1px solid ${tagVerticalFilter === "all" ? THEME.blue : BR}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, color: tagVerticalFilter === "all" ? THEME.blue : T2, cursor: "pointer", fontFamily: "inherit" }}>All Verticals</button>
          {verticals.map((v) => (
            <button key={v} onClick={() => setTagVerticalFilter(v)} style={{ background: tagVerticalFilter === v ? "#0d1a2b" : S2, border: `1px solid ${tagVerticalFilter === v ? THEME.blue : BR}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, color: tagVerticalFilter === v ? THEME.blue : T2, cursor: "pointer", fontFamily: "inherit" }}>{v}</button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((e) => (
          <div key={e.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: S2, borderRadius: 4 }}>
            <div>
              <span style={{ fontSize: 12, color: T1 }}>{e.name}</span>
              <Tag color={tagColor(e.reason)}>{e.reason}</Tag>
            </div>
            <button onClick={() => onRemove(e.name)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", fontSize: 11 }}>Remove</button>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ fontSize: 12, color: T3 }}>No matches.</div>}
      </div>
    </Card>
  );
}
