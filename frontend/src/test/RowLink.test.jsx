import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Table, { OpenHint, RowLink, StretchedLink } from "../components/Table";

function Harness() {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            <Table head={["Plan", ""]}>
              <RowLink to="/dest">
                <td>
                  <StretchedLink to="/dest">Week 1</StretchedLink>
                </td>
                <td>
                  <OpenHint />
                </td>
              </RowLink>
            </Table>
          }
        />
        <Route path="/dest" element={<p>DEST PAGE</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RowLink", () => {
  it("navigates when the row is clicked (mouse)", async () => {
    const { container } = render(<Harness />);
    await userEvent.click(container.querySelector("tbody tr"));
    expect(await screen.findByText("DEST PAGE")).toBeInTheDocument();
  });

  it("navigates when the row's link is activated with the keyboard (Enter)", async () => {
    render(<Harness />);
    const link = screen.getByRole("link", { name: "Week 1" });
    link.focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText("DEST PAGE")).toBeInTheDocument();
  });
});
