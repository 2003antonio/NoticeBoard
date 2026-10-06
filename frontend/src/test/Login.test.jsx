import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Login from "../pages/Login";
import { AuthProvider } from "../context/AuthContext";
import * as authApi from "../api/auth";
import { ApiError } from "../api/client";

// The API layer is mocked, so these tests never touch the network or backend.
vi.mock("../api/auth");

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Login", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows 'wrong email or password' on a 401", async () => {
    authApi.login.mockRejectedValue(new ApiError("Invalid credentials", { status: 401 }));
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "admin@noticeboard.test");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/wrong email or password/i)).toBeInTheDocument();
  });

  it("calls login with the entered credentials on success", async () => {
    authApi.login.mockResolvedValue({
      token: "t",
      user: { id: "1", name: "A", role: "manager", must_change_password: false },
    });
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), "admin@noticeboard.test");
    await userEvent.type(screen.getByLabelText(/password/i), "admin123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(authApi.login).toHaveBeenCalledWith("admin@noticeboard.test", "admin123");
  });
});
