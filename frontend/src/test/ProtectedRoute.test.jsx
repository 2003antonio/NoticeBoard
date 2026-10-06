import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProtectedRoute from "../components/ProtectedRoute";
import { AuthProvider } from "../context/AuthContext";
import * as authApi from "../api/auth";

vi.mock("../api/auth");

// Seed a logged-in user: a stored token makes AuthProvider call /auth/me, which
// we mock to return the given user.
function seedUser(user) {
  sessionStorage.setItem("nbt_token", "test-token");
  authApi.me.mockResolvedValue({ user });
}

function renderApp(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>LOGIN PAGE</p>} />
          <Route path="/change-password" element={<p>CHANGE PASSWORD PAGE</p>} />
          <Route path="/my/plans" element={<p>TRAINEE HOME</p>} />
          <Route
            path="/manager-only"
            element={
              <ProtectedRoute roles={["manager"]}>
                <p>MANAGER PAGE</p>
              </ProtectedRoute>
            }
          />
          <Route
            path="/any"
            element={
              <ProtectedRoute>
                <p>SECRET</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => vi.resetAllMocks());

  it("redirects a logged-out user to the login page", async () => {
    renderApp("/any"); // no token seeded
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
  });

  it("keeps a trainee out of a manager-only page", async () => {
    seedUser({ id: "1", name: "T", role: "trainee", must_change_password: false });
    renderApp("/manager-only");
    // Sent to the trainee's own home instead of the manager page.
    expect(await screen.findByText("TRAINEE HOME")).toBeInTheDocument();
    expect(screen.queryByText("MANAGER PAGE")).not.toBeInTheDocument();
  });

  it("forces a must_change_password user to the change-password page", async () => {
    seedUser({ id: "1", name: "T", role: "trainee", must_change_password: true });
    renderApp("/any");
    expect(await screen.findByText("CHANGE PASSWORD PAGE")).toBeInTheDocument();
  });
});
