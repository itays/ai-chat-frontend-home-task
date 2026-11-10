import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary.tsx";

const Broken = () => {
  throw new Error("boom");
};

it("replaces a crashed app with an error page that offers a reload", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  render(
    <AppErrorBoundary>
      <Broken />
    </AppErrorBoundary>
  );

  expect(
    screen.getByRole("heading", { name: "Something went wrong" })
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
});
