import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AddPanel from "../components/AddPanel";

function setup(loadResult) {
  const load = vi.fn().mockResolvedValue(loadResult);
  const onConfirm = vi.fn().mockResolvedValue();
  render(
    <AddPanel
      buttonLabel="Add trainee"
      title="Add a trainee"
      confirmLabel="Add to cohort"
      name="add-member"
      load={load}
      getId={(t) => t.id}
      getLabel={(t) => t.name}
      emptyMessage="Everyone is already in this cohort."
      onConfirm={onConfirm}
    />
  );
  return { load, onConfirm };
}

describe("AddPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the panel and only shows the options the API returned", async () => {
    setup({ items: [{ id: "t1", name: "Ada Lovelace" }], total: 1 });
    await userEvent.click(screen.getByRole("button", { name: /add trainee/i }));
    expect(await screen.findByLabelText("Ada Lovelace")).toBeInTheDocument();
  });

  it("confirms with the chosen id", async () => {
    const { onConfirm } = setup({ items: [{ id: "t1", name: "Ada Lovelace" }], total: 1 });
    await userEvent.click(screen.getByRole("button", { name: /add trainee/i }));
    await userEvent.click(await screen.findByLabelText("Ada Lovelace"));
    await userEvent.click(screen.getByRole("button", { name: /add to cohort/i }));
    expect(onConfirm).toHaveBeenCalledWith("t1");
  });

  it("shows the empty state when nothing is available", async () => {
    setup({ items: [], total: 0 });
    await userEvent.click(screen.getByRole("button", { name: /add trainee/i }));
    expect(await screen.findByText(/everyone is already in this cohort/i)).toBeInTheDocument();
  });

  it("surfaces a failed confirm (e.g. a 409 race) and keeps the panel open", async () => {
    const load = vi.fn().mockResolvedValue({ items: [{ id: "t1", name: "Ada Lovelace" }], total: 1 });
    const onConfirm = vi.fn().mockRejectedValue(
      Object.assign(new Error("Trainee is already in this cohort"), { details: [] })
    );
    render(
      <AddPanel
        buttonLabel="Add trainee"
        title="Add a trainee"
        confirmLabel="Add to cohort"
        name="add-member"
        load={load}
        getId={(t) => t.id}
        getLabel={(t) => t.name}
        emptyMessage="empty"
        onConfirm={onConfirm}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /add trainee/i }));
    await userEvent.click(await screen.findByLabelText("Ada Lovelace"));
    await userEvent.click(screen.getByRole("button", { name: /add to cohort/i }));

    // The 409 message is shown, and the panel is still open (confirm still there).
    expect(await screen.findByText(/already in this cohort/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to cohort/i })).toBeInTheDocument();
  });
});
