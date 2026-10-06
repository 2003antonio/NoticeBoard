import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AssignForm from "../pages/manager/AssignForm";
import * as plansApi from "../api/plans";
import * as cohortsApi from "../api/cohorts";
import * as traineesApi from "../api/trainees";

vi.mock("../api/plans");
vi.mock("../api/cohorts");
vi.mock("../api/trainees");

describe("Assign form", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    cohortsApi.listCohorts.mockResolvedValue({
      items: [{ id: "c1", name: "Cohort One", member_count: 2 }],
      total: 1,
    });
    traineesApi.listTrainees.mockResolvedValue({
      items: [{ id: "t1", name: "Trainee One", email: "t1@x.test" }],
      total: 1,
    });
    plansApi.assignPlan.mockResolvedValue({ notified: 2 });
  });

  it("refuses to submit with neither a cohort nor a trainee", async () => {
    render(<AssignForm planId="p1" />);
    await userEvent.click(screen.getByRole("button", { name: /assign plan/i }));

    expect(await screen.findByText(/choose a cohort or a trainee/i)).toBeInTheDocument();
    expect(plansApi.assignPlan).not.toHaveBeenCalled();
  });

  it("refuses to submit with both a cohort and a trainee selected", async () => {
    render(<AssignForm planId="p1" />);
    // Wait for both pickers to load their options.
    await userEvent.click(await screen.findByLabelText(/Cohort One/i));
    await userEvent.click(await screen.findByLabelText(/Trainee One/i));
    await userEvent.click(screen.getByRole("button", { name: /assign plan/i }));

    expect(await screen.findByText(/not both/i)).toBeInTheDocument();
    expect(plansApi.assignPlan).not.toHaveBeenCalled();
  });
});
