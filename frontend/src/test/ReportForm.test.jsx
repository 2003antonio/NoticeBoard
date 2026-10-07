import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TraineePlanDetail from "../pages/trainee/PlanDetail";
import { ToastProvider } from "../components/Toast";
import * as myplansApi from "../api/myplans";

vi.mock("../api/myplans");

// ToastProvider is required because submitting a report now fires a toast.
function renderDetail(plan) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[{ pathname: `/my/plans/${plan.id}`, state: { plan } }]}>
        <Routes>
          <Route path="/my/plans/:planId" element={<TraineePlanDetail />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("Trainee report form", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    myplansApi.myReports.mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 });
    myplansApi.submitReport.mockResolvedValue({ id: "r1", status: "on_track" });
  });

  it("blocks submit (and does not call the API) when 'blocked' has no notes", async () => {
    renderDetail({ id: "1", title: "Plan P", due_date: null, source: "direct", latest_status: "no_report" });
    await screen.findByText("Plan P");

    await userEvent.selectOptions(screen.getByLabelText(/status/i), "blocked");
    await userEvent.click(screen.getByRole("button", { name: /submit update/i }));

    expect(await screen.findByText(/say what is blocking you/i)).toBeInTheDocument();
    expect(myplansApi.submitReport).not.toHaveBeenCalled();
  });

  it("disables the form once the plan is done", async () => {
    renderDetail({ id: "1", title: "Plan P", due_date: null, source: "direct", latest_status: "done" });
    await screen.findByText("Plan P");

    expect(screen.getByText(/no more updates can be submitted/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit update/i })).not.toBeInTheDocument();
  });
});
