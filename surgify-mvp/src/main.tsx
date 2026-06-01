import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  LayoutDashboard,
  Settings,
  Stethoscope,
  Undo2,
  X
} from "lucide-react";
import heroImage from "./assets/surgify-clinical-hero.png";
import logoMark from "./assets/surgify-logo-mark.png";
import rawData from "./data/mockData.json";
import "./index.css";
import type { EvidenceStatus, EvidenceUpdate, MockData, Stage, Surgery } from "./types";

type View = "landing" | "dashboard" | "surgeries" | "detail" | "settings";

const data = rawData as MockData;

const STAGES: Stage[] = ["Pre-op", "Operative", "Post-op"];

const DISCLAIMER =
  "Surgify supports evidence review and draft care pathway optimisation. It does not provide patient-specific medical advice, diagnose patients, recommend operations or replace clinician judgement. Any accepted change should be reviewed through the treating surgeon's usual clinical governance process.";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "surgeries", label: "Surgeries", icon: Stethoscope },
  { id: "settings", label: "Settings", icon: Settings }
] as const;

const priorityOrder: Record<EvidenceUpdate["priority"], number> = {
  High: 0,
  Medium: 1,
  Low: 2
};

const statusOrder: Record<EvidenceStatus, number> = {
  New: 0,
  Deferred: 1,
  Accepted: 2,
  Dismissed: 3
};

type StageAlertLevel = "none" | "red" | "yellow" | "both";

const API_BASE = "http://localhost:8000";

function mapPapersToUpdates(digest: {score: number; reason: string; takeaway: string; paper: {pmid: string; title: string; url: string; abstract: string; journal: string; pub_date: string}}[]): EvidenceUpdate[] {
  return digest.map((item) => {
    const title = item.paper.title || "";

    let surgeryId = "breast-conserving-surgery";
    if (/mastectomy|mastectomie/i.test(title)) surgeryId = "mastectomy";
    else if (/sentinel/i.test(title)) surgeryId = "sentinel-lymph-node-biopsy";
    else if (/axillary lymph node dissection|alnd/i.test(title)) surgeryId = "axillary-lymph-node-dissection";
    else if (/oncoplastic/i.test(title)) surgeryId = "oncoplastic-breast-surgery";

    let stage: Stage = "Operative";
    if (/pre.op|preoperative|staging|biopsy|diagnosis|assessment|consent|planning/i.test(title)) stage = "Pre-op";
    else if (/post.op|postoperative|follow.up|adjuvant|radiotherapy|reconstruction|recovery|discharge/i.test(title)) stage = "Post-op";

    const priority: EvidenceUpdate["priority"] = item.score >= 9 ? "High" : item.score >= 7 ? "Medium" : "Low";

    return {
      id: `pubmed-${item.paper.pmid}`,
      surgeryId,
      stage,
      title: item.takeaway.slice(0, 120),
      currentPractice: "Current practice per standard pathway.",
      newEvidenceShows: item.reason,
      priority,
      articleTitle: title,
      articleUrl: item.paper.url,
      suggestedAcceptedChange: item.takeaway,
      status: "New" as EvidenceStatus
    };
  });
}

function App() {
  const [view, setView] = useState<View>("landing");
  const [selectedSurgeryId, setSelectedSurgeryId] = useState(data.surgeries[0].id);
  const [selectedStage, setSelectedStage] = useState<Stage>("Operative");
  const [updates, setUpdates] = useState<EvidenceUpdate[]>(data.evidenceUpdates);
  const [toast, setToast] = useState("");
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  useEffect(() => {
    const fetchLiveEvidence = async () => {
      setEvidenceLoading(true);
      try {
        const res = await fetch(`${API_BASE}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Dr Asha Sharma",
            specialty: "Breast Surgery",
            primary_procedures: ["breast-conserving surgery", "mastectomy", "sentinel lymph node biopsy", "axillary lymph node dissection", "oncoplastic breast surgery"],
            secondary_procedures: [],
            learning_procedures: [],
            procedures: ["breast-conserving surgery", "mastectomy", "sentinel lymph node biopsy"],
            approaches: ["open surgery", "minimally invasive"],
            techniques: ["wide local excision", "oncoplastic surgery", "sentinel node biopsy"],
            devices: [],
            clinical_interests: ["margin status", "lymphoedema", "radiotherapy"],
            study_types: [],
            experience_years: 14,
            recent_only: false,
            cpd_logging: false
          })
        });
        if (!res.ok) return;
        const apiData = await res.json();
        const liveUpdates = mapPapersToUpdates(apiData.digest || []);
        if (liveUpdates.length > 0) {
          setUpdates((prev) => [...liveUpdates, ...prev]);
        }
      } catch {
        // Backend unavailable — mock data only
      } finally {
        setEvidenceLoading(false);
      }
    };
    fetchLiveEvidence();
  }, []);

  const selectedSurgery =
    data.surgeries.find((surgery) => surgery.id === selectedSurgeryId) ?? data.surgeries[0];

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const setUpdateStatus = (id: string, status: EvidenceStatus) => {
    setUpdates((current) =>
      current.map((update) => (update.id === id ? { ...update, status } : update))
    );

    if (status === "Accepted") showToast("Change accepted into draft pathway.");
    if (status === "Deferred") showToast("Change deferred for later review.");
    if (status === "Dismissed") showToast("Update dismissed.");
  };

  const undoAcceptance = (id: string) => {
    setUpdates((current) =>
      current.map((update) => (update.id === id ? { ...update, status: "New" } : update))
    );
    showToast("Acceptance undone and returned to review.");
  };

  const activeUpdates = useMemo(
    () =>
      updates
        .filter((update) => update.status !== "Dismissed")
        .sort((a, b) => {
          const statusDiff = statusOrder[a.status] - statusOrder[b.status];
          if (statusDiff !== 0) return statusDiff;
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }),
    [updates]
  );

  const stats = [
    { label: "surgeries tracked", value: data.surgeries.length },
    { label: "evidence updates", value: updates.length },
    { label: "proposed changes", value: updates.filter((update) => update.status === "New").length },
    {
      label: "accepted changes",
      value: updates.filter((update) => update.status === "Accepted").length
    }
  ];

  const openPathway = (surgeryId: string, stage: Stage = "Pre-op") => {
    setSelectedSurgeryId(surgeryId);
    setSelectedStage(stage);
    setView("detail");
  };

  if (view === "landing") {
    return <LandingPage onSeeDemo={() => setView("dashboard")} />;
  }

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-line bg-white/90 px-4 py-4 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center justify-between gap-4 lg:block">
            <button
              className="flex min-w-0 items-center gap-3 rounded-2xl text-left"
              type="button"
              onClick={() => setView("dashboard")}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-line bg-white p-1.5 shadow-sm">
                <img className="h-full w-full object-contain" src={logoMark} alt="" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold">Surgify</span>
                <span className="block truncate text-xs text-slate-500">Demo Breast Unit</span>
              </span>
            </button>

            <div className="hidden rounded-full border border-line bg-white px-3 py-2 text-xs text-slate-500 shadow-sm sm:block lg:mt-6 lg:block lg:rounded-2xl lg:px-4 lg:py-4">
              <strong className="block text-sm text-ink">{data.surgeon.name}</strong>
              <span>{data.surgeon.role}</span>
            </div>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-7 lg:flex-col lg:overflow-visible lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm transition lg:w-full lg:rounded-2xl ${
                    active
                      ? "bg-ink text-white shadow-lift"
                      : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                  }`}
                  onClick={() => setView(item.id)}
                >
                  <Icon size={17} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          {view === "dashboard" && (
            <Dashboard
              activeUpdates={activeUpdates}
              stats={stats}
              surgeries={data.surgeries}
              onStatusChange={setUpdateStatus}
              onOpenPathway={openPathway}
              evidenceLoading={evidenceLoading}
            />
          )}
          {view === "surgeries" && (
            <SurgeriesPage surgeries={data.surgeries} updates={updates} onOpenPathway={openPathway} />
          )}
          {view === "detail" && (
            <SurgeryDetail
              surgery={selectedSurgery}
              updates={updates}
              selectedStage={selectedStage}
              onStageChange={setSelectedStage}
              onStatusChange={setUpdateStatus}
              onUndoAcceptance={undoAcceptance}
            />
          )}
          {view === "settings" && (
            <SettingsPage surgeon={data.surgeon} updates={updates} surgeries={data.surgeries} />
          )}

          <footer className="mt-10 border-t border-line pt-5 text-xs leading-5 text-slate-500">
            {DISCLAIMER}
          </footer>
        </main>
      </div>

      <div
        className={`fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lift transition ${
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </div>
  );
}

function LandingPage({ onSeeDemo }: { onSeeDemo: () => void }) {
  useEffect(() => {
    const updateScroll = () => {
      const progress = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1.2);
      document.documentElement.style.setProperty("--landing-scroll", String(progress));
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.18 }
    );

    document.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScroll);
      observer.disconnect();
      document.documentElement.style.removeProperty("--landing-scroll");
    };
  }, []);

  const seeDemo = () => {
    window.scrollTo({ top: 0 });
    onSeeDemo();
  };

  return (
    <div className="landing-page min-h-screen bg-mist text-ink">
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/30 bg-white/76 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            className="flex items-center gap-3 rounded-2xl text-left"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <span className="grid h-10 w-10 place-items-center rounded-[14px] border border-line bg-white p-1.5 shadow-sm">
              <img className="h-full w-full object-contain" src={logoMark} alt="" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-semibold">Surgify</span>
              <span className="block text-xs text-slate-500">Breast surgery pathways</span>
            </span>
          </button>

          <button
            type="button"
            data-testid="landing-see-demo-nav"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lift transition hover:bg-slate-800"
            onClick={seeDemo}
          >
            See Demo
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      <main>
        <section className="landing-hero relative min-h-[84svh] overflow-hidden pt-16">
          <img
            src={heroImage}
            alt="A breast surgeon reviewing a clinical pathway interface on a tablet in a calm consultation room."
            className="landing-hero-image absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-white/68" />

          <div className="relative mx-auto flex min-h-[calc(84svh-4rem)] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-2xl pt-8" data-reveal>
              <p className="mb-4 text-sm font-medium text-teal">Evidence-guided breast surgery pathways</p>
              <h1 className="text-5xl font-semibold leading-none tracking-normal text-ink sm:text-7xl">
                Surgify
              </h1>
              <p className="mt-6 text-xl leading-8 text-graphite sm:text-2xl sm:leading-9">
                Compare current practice with new evidence across pre-op, operative and post-op
                care, then accept changes into a draft pathway for governance review.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-testid="landing-see-demo-hero"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-lift transition hover:bg-slate-800"
                  onClick={seeDemo}
                >
                  See Demo
                  <ArrowRight size={17} />
                </button>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center rounded-full border border-line bg-white/78 px-5 py-3 text-sm font-medium text-ink shadow-sm backdrop-blur-xl transition hover:bg-white"
                >
                  How it works
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="lg:sticky lg:top-28" data-reveal>
              <p className="mb-3 text-sm font-medium text-teal">Designed for breast surgeons</p>
              <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">
                Evidence review without enterprise dashboard noise.
              </h2>
              <p className="mt-5 text-lg leading-8 text-graphite">
                Surgify turns new literature into a calm pathway review workflow: select a surgery,
                choose the stage of care, compare current practice, and decide what enters the draft
                pathway.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  title: "Start with the operation",
                  text: "Breast-conserving surgery, mastectomy, sentinel node biopsy, axillary dissection and oncoplastic surgery each have a focused pathway."
                },
                {
                  title: "Review only the relevant stage",
                  text: "Pre-op, operative and post-op tabs show where evidence is active, so attention goes to the right clinical step first."
                },
                {
                  title: "Accept into a draft pathway",
                  text: "Accepted updates preserve the previous practice and record a draft recommendation for the normal governance process."
                }
              ].map((item, index) => (
                <article
                  key={item.title}
                  className="landing-reveal-card card p-6"
                  data-reveal
                  style={{ transitionDelay: `${index * 90}ms` }}
                >
                  <div className="mb-5 grid h-10 w-10 place-items-center rounded-full bg-teal/10 text-sm font-semibold text-teal">
                    {index + 1}
                  </div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 body-copy">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="card overflow-hidden" data-reveal>
            <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="p-6 sm:p-8 lg:p-10">
                <p className="mb-3 text-sm font-medium text-teal">For clinical governance</p>
                <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
                  A draft pathway change, not a protocol shortcut.
                </h2>
                <p className="mt-5 text-base leading-7 text-graphite">
                  Surgify supports evidence review and pathway optimisation. It does not replace
                  surgeon judgement, patient-specific decision-making or local governance.
                </p>
                <button
                  type="button"
                  data-testid="landing-see-demo-governance"
                  className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-lift transition hover:bg-slate-800"
                  onClick={seeDemo}
                >
                  See Demo
                  <ArrowRight size={17} />
                </button>
              </div>

              <div className="landing-product-panel min-h-[360px] bg-white p-4 sm:p-6 lg:p-8">
                <div className="h-full rounded-2xl border border-line bg-mist p-4 shadow-soft">
                  <div className="mb-4 flex gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                        New
                      </span>
                      <span className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700">
                        High priority
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold leading-snug">
                      Routine cavity shave margins may reduce re-excision risk
                    </h3>
                    <div className="mt-5 grid gap-3">
                      <div className="rounded-2xl bg-mist p-4">
                        <div className="label">Current practice</div>
                        <p className="mt-1 text-sm leading-6 text-graphite">
                          Cavity shave margins based on surgeon preference.
                        </p>
                      </div>
                      <div className="rounded-2xl bg-mist p-4">
                        <div className="label">New evidence shows</div>
                        <p className="mt-1 text-sm leading-6 text-graphite">
                          Selected patients may have lower positive margin and re-excision rates.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">
                      Accept change
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          <div className="rounded-[28px] bg-ink px-6 py-10 text-white shadow-lift sm:px-10" data-reveal>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-semibold sm:text-4xl">See the pathway review flow.</h2>
                <p className="mt-3 text-base leading-7 text-white/72">
                  Open the demo and review breast surgery updates from dashboard to draft pathway.
                </p>
              </div>
              <button
                type="button"
                data-testid="landing-see-demo-final"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-ink shadow-sm transition hover:bg-slate-100"
                onClick={seeDemo}
              >
                See Demo
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Dashboard({
  activeUpdates,
  stats,
  surgeries,
  onStatusChange,
  onOpenPathway,
  evidenceLoading
}: {
  activeUpdates: EvidenceUpdate[];
  stats: { label: string; value: number }[];
  surgeries: Surgery[];
  onStatusChange: (id: string, status: EvidenceStatus) => void;
  onOpenPathway: (surgeryId: string, stage?: Stage) => void;
  evidenceLoading?: boolean;
}) {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <div className="mb-3 flex items-center gap-3">
          <p className="text-sm font-medium text-teal">Dr Asha Sharma - Demo Breast Unit</p>
          {evidenceLoading && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/20 bg-teal/5 px-2.5 py-1 text-xs font-medium text-teal">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
              Fetching live evidence from PubMed…
            </span>
          )}
        </div>
        <h1 className="text-5xl font-semibold leading-none tracking-normal text-ink sm:text-6xl">
          Surgify
        </h1>
        <p className="mt-5 text-lg leading-8 text-graphite">
          Evidence-guided care pathway optimisation for breast surgeons.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <section key={stat.label} className="card px-5 py-5">
            <div className="text-3xl font-semibold">{stat.value}</div>
            <div className="mt-2 text-sm text-slate-500">{stat.label}</div>
          </section>
        ))}
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Suggested practice updates</h2>
            <p className="mt-1 text-sm text-slate-500">Active updates stay visible until dismissed.</p>
          </div>
        </div>

        <div className="grid gap-4">
          {activeUpdates.map((update) => (
            <EvidenceCard
              key={update.id}
              update={update}
              surgery={surgeries.find((surgery) => surgery.id === update.surgeryId)}
              onStatusChange={onStatusChange}
              onOpenPathway={onOpenPathway}
            />
          ))}
        </div>

        {activeUpdates.length === 0 && (
          <div className="soft-panel px-5 py-8 text-sm text-slate-500">
            No active suggested updates.
          </div>
        )}
      </section>
    </div>
  );
}

function SurgeriesPage({
  surgeries,
  updates,
  onOpenPathway
}: {
  surgeries: Surgery[];
  updates: EvidenceUpdate[];
  onOpenPathway: (surgeryId: string, stage?: Stage) => void;
}) {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Care pathways"
        title="Surgeries"
        subtitle="Five breast surgery pathways tracked against current evidence."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {surgeries.map((surgery) => {
          const surgeryUpdates = updates.filter((update) => update.surgeryId === surgery.id);
          const accepted = surgeryUpdates.filter((update) => update.status === "Accepted").length;

          return (
            <section key={surgery.id} className="card p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{surgery.name}</h2>
                  <div className="mt-5 space-y-4">
                    <InfoBlock label="Indication" value={surgery.indication} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MiniMetric label="Evidence updates" value={surgeryUpdates.length} />
                      <MiniMetric label="Accepted changes" value={accepted} />
                      <MiniMetric label="Last reviewed" value={surgery.lastReviewed} />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid={`open-${surgery.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lift transition hover:bg-slate-800"
                  onClick={() => onOpenPathway(surgery.id)}
                >
                  Open pathway
                  <ChevronRight size={16} />
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SurgeryDetail({
  surgery,
  updates,
  selectedStage,
  onStageChange,
  onStatusChange,
  onUndoAcceptance
}: {
  surgery: Surgery;
  updates: EvidenceUpdate[];
  selectedStage: Stage;
  onStageChange: (stage: Stage) => void;
  onStatusChange: (id: string, status: EvidenceStatus) => void;
  onUndoAcceptance: (id: string) => void;
}) {
  const surgeryUpdates = updates.filter((update) => update.surgeryId === surgery.id);
  const stageRows = surgery.pathway[selectedStage]
    .map((item, index) => {
      const update = item.updateId
        ? updates.find((candidate) => candidate.id === item.updateId)
        : undefined;
      const visibleUpdate = update?.status === "Dismissed" ? undefined : update;

      return { index, item, update: visibleUpdate };
    })
    .sort((a, b) => {
      if (Boolean(a.update) !== Boolean(b.update)) return a.update ? -1 : 1;
      if (a.update && b.update) {
        const statusDiff = statusOrder[a.update.status] - statusOrder[b.update.status];
        if (statusDiff !== 0) return statusDiff;

        const priorityDiff = priorityOrder[a.update.priority] - priorityOrder[b.update.priority];
        if (priorityDiff !== 0) return priorityDiff;
      }

      return a.index - b.index;
    });

  return (
    <div className="space-y-7">
      <header className="card p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-medium text-teal">Surgery name</p>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{surgery.name}</h1>
            <p className="mt-4 text-base leading-7 text-graphite">{surgery.indication}</p>
          </div>
          <div className="rounded-full border border-line bg-mist px-4 py-2 text-sm font-medium text-graphite">
            {surgeryUpdates.length} evidence updates
          </div>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto rounded-full border border-line bg-white p-1 shadow-sm">
        {STAGES.map((stage) => {
          const alertLevel = getStageAlertLevel(surgery.id, stage, updates);

          return (
            <button
              key={stage}
              type="button"
              data-testid={`stage-tab-${stage.toLowerCase().replace("-", "")}`}
              className={`inline-flex min-w-32 flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                selectedStage === stage
                  ? "bg-ink text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => onStageChange(stage)}
            >
              <span>{stage}</span>
              <StageAlertIndicator level={alertLevel} />
            </button>
          );
        })}
      </div>

      <div className="grid gap-4">
        {stageRows.map(({ item, update }) => {
          return (
            <PathwayComparisonCard
              key={item.id}
              itemText={item.text}
              update={update}
              surgery={surgery}
              onStatusChange={onStatusChange}
              onUndoAcceptance={onUndoAcceptance}
            />
          );
        })}
      </div>
    </div>
  );
}

function getStageAlertLevel(
  surgeryId: string,
  stage: Stage,
  updates: EvidenceUpdate[]
): StageAlertLevel {
  const stageUpdates = updates.filter(
    (update) =>
      update.surgeryId === surgeryId && update.stage === stage && update.status !== "Dismissed"
  );
  const hasRed = stageUpdates.some((update) => update.priority === "High");
  const hasYellow = stageUpdates.some(
    (update) => update.priority === "Medium" || update.priority === "Low"
  );

  if (hasRed && hasYellow) return "both";
  if (hasRed) return "red";
  if (hasYellow) return "yellow";
  return "none";
}

function StageAlertIndicator({ level }: { level: StageAlertLevel }) {
  if (level === "none") return null;

  const redIcon = (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-rose-50 ring-1 ring-rose-100">
      <AlertTriangle aria-hidden="true" className="text-rose-600" size={14} strokeWidth={2.4} />
    </span>
  );
  const yellowIcon = (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-50 ring-1 ring-amber-100">
      <AlertTriangle aria-hidden="true" className="text-amber-600" size={14} strokeWidth={2.4} />
    </span>
  );

  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1">
      {(level === "red" || level === "both") && redIcon}
      {(level === "yellow" || level === "both") && yellowIcon}
    </span>
  );
}

function EvidenceCard({
  update,
  surgery,
  onStatusChange,
  onOpenPathway,
  onUndoAcceptance
}: {
  update: EvidenceUpdate;
  surgery?: Surgery;
  onStatusChange: (id: string, status: EvidenceStatus) => void;
  onOpenPathway?: (surgeryId: string, stage?: Stage) => void;
  onUndoAcceptance?: (id: string) => void;
}) {
  return (
    <section
      className={`card p-5 sm:p-6 ${update.status === "Deferred" ? "opacity-80" : ""}`}
      data-testid={`evidence-card-${update.id}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusPill status={update.status} />
            <PriorityPill priority={update.priority} deferred={update.status === "Deferred"} />
          </div>
          <h3 className="text-xl font-semibold leading-snug">{update.title}</h3>
        </div>

        {onOpenPathway && surgery && (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-mist"
            onClick={() => onOpenPathway(surgery.id, update.stage)}
          >
            Open pathway
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <InfoBlock label="Surgery" value={surgery?.name ?? "Unknown surgery"} />
        <InfoBlock label="Stage" value={update.stage} />
      </div>

      {update.status === "Accepted" ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <InfoBlock label="Previous practice" value={update.currentPractice} />
          <InfoBlock label="Updated draft practice" value={update.suggestedAcceptedChange} />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <InfoBlock label="Current practice" value={update.currentPractice} />
          <InfoBlock label="New evidence shows" value={update.newEvidenceShows} />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <a
          className="inline-flex items-center gap-2 text-sm font-medium text-blue hover:text-teal"
          href={update.articleUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`View article: ${update.articleTitle}`}
        >
          <ExternalLink size={16} />
          View article
        </a>

        <ActionButtons
          update={update}
          onStatusChange={onStatusChange}
          onUndoAcceptance={onUndoAcceptance}
        />
      </div>

      <p className="mt-4 rounded-2xl bg-mist px-4 py-3 text-xs leading-5 text-slate-500">
        {DISCLAIMER}
      </p>
    </section>
  );
}

function PathwayComparisonCard({
  itemText,
  update,
  surgery,
  onStatusChange,
  onUndoAcceptance
}: {
  itemText: string;
  update?: EvidenceUpdate;
  surgery: Surgery;
  onStatusChange: (id: string, status: EvidenceStatus) => void;
  onUndoAcceptance: (id: string) => void;
}) {
  if (!update) {
    return (
      <section className="soft-panel p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <InfoBlock label="Current practice" value={itemText} />
          <InfoBlock label="New evidence shows" value="No new evidence update flagged." />
        </div>
        <div className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          Up to date
        </div>
      </section>
    );
  }

  return (
    <EvidenceCard
      update={update}
      surgery={surgery}
      onStatusChange={onStatusChange}
      onUndoAcceptance={onUndoAcceptance}
    />
  );
}

function ActionButtons({
  update,
  onStatusChange,
  onUndoAcceptance
}: {
  update: EvidenceUpdate;
  onStatusChange: (id: string, status: EvidenceStatus) => void;
  onUndoAcceptance?: (id: string) => void;
}) {
  if (update.status === "Accepted") {
    return (
      <button
        type="button"
        data-testid={`undo-${update.id}`}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-mist"
        onClick={() => {
          if (onUndoAcceptance) onUndoAcceptance(update.id);
          else onStatusChange(update.id, "New");
        }}
      >
        <Undo2 size={16} />
        Undo acceptance
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        data-testid={`accept-${update.id}`}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lift transition hover:bg-slate-800"
        onClick={() => onStatusChange(update.id, "Accepted")}
      >
        <Check size={16} />
        Accept change
      </button>
      <button
        type="button"
        data-testid={`defer-${update.id}`}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-mist"
        onClick={() => onStatusChange(update.id, "Deferred")}
      >
        <Clock3 size={16} />
        Defer
      </button>
      <button
        type="button"
        data-testid={`dismiss-${update.id}`}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
        onClick={() => onStatusChange(update.id, "Dismissed")}
      >
        <X size={16} />
        Dismiss
      </button>
    </div>
  );
}

function SettingsPage({
  surgeon,
  updates,
  surgeries
}: {
  surgeon: MockData["surgeon"];
  updates: EvidenceUpdate[];
  surgeries: Surgery[];
}) {
  const dismissed = updates.filter((update) => update.status === "Dismissed");

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        subtitle="Surgeon profile and local review context for the MVP."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-xl font-semibold">Surgeon</h2>
          <div className="mt-5 grid gap-4">
            <InfoBlock label="Name" value={surgeon.name} />
            <InfoBlock label="Role" value={surgeon.role} />
            <InfoBlock label="Unit" value={surgeon.unit} />
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-xl font-semibold">Pathway review</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Surgeries" value={surgeries.length} />
            <MiniMetric label="Updates" value={updates.length} />
            <MiniMetric label="Dismissed" value={dismissed.length} />
          </div>
          <p className="mt-5 rounded-2xl bg-mist px-4 py-3 text-xs leading-5 text-slate-500">
            {DISCLAIMER}
          </p>
        </section>
      </div>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  subtitle
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="max-w-3xl">
      <p className="mb-2 text-sm font-medium text-teal">{eyebrow}</p>
      <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
      <p className="mt-4 text-base leading-7 text-graphite">{subtitle}</p>
    </header>
  );
}

function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-1 body-copy">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-mist px-4 py-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function StatusPill({ status }: { status: EvidenceStatus }) {
  const className =
    status === "Accepted"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Deferred"
        ? "bg-amber-50 text-amber-700"
        : status === "Dismissed"
          ? "bg-rose-50 text-rose-700"
          : "bg-blue-50 text-blue-700";

  return (
    <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${className}`}>
      {status === "Accepted" ? "Accepted into draft pathway" : status}
    </span>
  );
}

function PriorityPill({
  priority,
  deferred
}: {
  priority: EvidenceUpdate["priority"];
  deferred?: boolean;
}) {
  const className =
    priority === "High"
      ? "border-rose-200 text-rose-700"
      : priority === "Medium"
        ? "border-amber-200 text-amber-700"
        : "border-slate-200 text-slate-600";

  return (
    <span
      className={`rounded-full border bg-white px-3 py-1.5 text-xs font-medium ${className} ${
        deferred ? "opacity-70" : ""
      }`}
    >
      {deferred ? "Lower priority" : `${priority} priority`}
    </span>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
