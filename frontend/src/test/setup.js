// Adds the jest-dom matchers (toBeInTheDocument, toBeDisabled, ...) to Vitest's
// expect, and clears sessionStorage between tests so auth state never leaks.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
