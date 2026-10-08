import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CohortDetail from "../pages/manager/CohortDetail";
import { ToastProvider } from "../components/Toast";
import * as cohortsApi from "../api/cohorts";
import * as plansApi from "../api/plans";
import { ApiError } from "../api/client";

vi.mock("../api/cohorts");
vi.mock("../api/plans");
vi.mock("../api/trainees");

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/cohorts/c1"]}>
        <Routes>
          <Route path="/cohorts/:cohortId" element={<CohortDetail />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("CohortDetail header", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    cohortsApi.listMembers.mockResolvedValue({ items: [] });
    cohortsApi.getCohortPlans.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it("shows the cohort's name as the title", async () => {
    cohortsApi.getCohort.mockResolvedValue({
      id: "c1",
      name: "Autumn Cohort",
      created_at: "2026-01-01T00:00:00Z",
      active_member_count: 4,
    });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Autumn Cohort" })).toBeInTheDocument();
    // The count (4) sits in its own <span>, so match the label and the number separately.
    expect(await screen.findByText(/active members/i)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows a friendly not-found state when the cohort is missing", async () => {
    cohortsApi.getCohort.mockRejectedValue(new ApiError("Cohort not found", { status: 404 }));
    renderPage();
    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });
});
