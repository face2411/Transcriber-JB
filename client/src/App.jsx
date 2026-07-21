import { useState } from "react";
import { THEME, TABS } from "@vee/shared";
import { StepBar } from "./components/primitives.jsx";
import Step1 from "./components/Step1.jsx";
import Step2 from "./components/Step2.jsx";
import Step3 from "./components/Step3.jsx";
import Step4 from "./components/Step4.jsx";
import Step5 from "./components/Step5.jsx";
import TaggedAccounts from "./components/TaggedAccounts.jsx";
import Intelligence from "./components/Intelligence.jsx";

// Builds the starting sessionData for a fresh workflow, or one seeded from
// a Tagged Accounts record (see spec.md "Start Prospecting": lands on
// Step 2, not Step 3, so cached intelligence can be reviewed first).
function initialSessionFor(startRecord) {
  if (!startRecord) return {};
  return {
    selectedCompany: startRecord,
    companyNews: startRecord.news || null,
    verticalRec: { top_vertical: startRecord.vertical },
    companies: [startRecord],
    skippedCompanies: [],
  };
}

function Workflow({ startRecord }) {
  const [step, setStep] = useState(startRecord ? 1 : 0);
  const [sessionData, setSessionData] = useState(() => initialSessionFor(startRecord));

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const jumpTo = (i) => setStep(i);

  const startFresh = () => {
    setSessionData({});
    setStep(0);
  };

  const steps = [
    <Step1 key="1" onNext={next} sessionData={sessionData} setSessionData={setSessionData} />,
    <Step2 key="2" onNext={next} onBack={back} sessionData={sessionData} setSessionData={setSessionData} />,
    <Step3 key="3" onNext={next} onBack={back} sessionData={sessionData} setSessionData={setSessionData} />,
    <Step4 key="4" onNext={next} onBack={back} sessionData={sessionData} setSessionData={setSessionData} />,
    <Step5 key="5" onBack={back} onDone={startFresh} sessionData={sessionData} />,
  ];

  return (
    <div>
      <StepBar current={step} onStepClick={jumpTo} />
      {steps[step]}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [startRecord, setStartRecord] = useState(null);
  const [workflowKey, setWorkflowKey] = useState(0);

  // Bumping workflowKey remounts <Workflow>, which re-runs its useState
  // initializers with the new startRecord - this is what actually seeds
  // the session and jumps to Step 2 when "Start Prospecting" is clicked
  // from Tagged Accounts.
  const handleStartProspecting = (record) => {
    setStartRecord(record);
    setActiveTab("workflow");
    setWorkflowKey((k) => k + 1);
  };

  return (
    <div style={{ background: THEME.bg, color: THEME.textPrimary, minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ borderBottom: `1px solid ${THEME.border}`, padding: "16px 24px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", color: THEME.orange }}>
          VEE OPPORTUNITY INTELLIGENCE
        </div>
        <nav style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? THEME.surface3 : "transparent",
                color: activeTab === tab.id ? THEME.orange : THEME.textSecondary,
                border: `1px solid ${activeTab === tab.id ? THEME.orange : THEME.border}`,
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        {activeTab === "workflow" && <Workflow key={workflowKey} startRecord={startRecord} />}
        {activeTab === "tagged" && <TaggedAccounts onStartProspecting={handleStartProspecting} />}
        {activeTab === "intelligence" && <Intelligence />}
      </main>
    </div>
  );
}
