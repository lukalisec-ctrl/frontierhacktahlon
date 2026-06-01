export type Stage = "Pre-op" | "Operative" | "Post-op";

export type EvidenceStatus = "New" | "Accepted" | "Deferred" | "Dismissed";

export type Priority = "High" | "Medium" | "Low";

export type PathwayItem = {
  id: string;
  text: string;
  updateId?: string;
};

export type Surgery = {
  id: string;
  name: string;
  indication: string;
  lastReviewed: string;
  pathway: Record<Stage, PathwayItem[]>;
};

export type EvidenceUpdate = {
  id: string;
  surgeryId: string;
  stage: Stage;
  title: string;
  currentPractice: string;
  newEvidenceShows: string;
  priority: Priority;
  articleTitle: string;
  articleUrl: string;
  suggestedAcceptedChange: string;
  status: EvidenceStatus;
};

export type MockData = {
  surgeon: {
    name: string;
    role: string;
    unit: string;
  };
  surgeries: Surgery[];
  evidenceUpdates: EvidenceUpdate[];
};
