import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderDatePicker } from "@/components/site/OrderDatePicker";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 22, 12));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function viewport(mobile: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === "(max-width: 767px)" && mobile,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  }));
}
const trigger = () => screen.getByRole("button", { name: "Data em que precisa" });
const hiddenValue = () => (document.querySelector('input[name="data"]') as HTMLInputElement).value;
async function open() {
  trigger().focus();
  fireEvent.click(trigger());
  return within(await screen.findByRole("dialog", { name: "Escolher data" }));
}

describe("Personalized order date picker", () => {
  it("uses Portuguese dates, rejects past days, supports keyboard navigation and submits local ISO dates", async () => {
    viewport(false);
    const submit = vi.fn();
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(new FormData(event.currentTarget).get("data"));
        }}
      >
        <OrderDatePicker />
        <button type="submit">Enviar</button>
      </form>,
    );
    expect(trigger()).toHaveTextContent("dd/mm/yyyy");
    const panel = await open();
    expect(panel.getByText("Outubro 2026")).toBeInTheDocument();
    expect(panel.getByRole("button", { name: /21 de outubro de 2026/i })).toBeDisabled();
    const today = panel.getByRole("button", { name: /22 de outubro de 2026/i });
    expect(today).not.toBeDisabled();
    today.focus();
    fireEvent.keyDown(today, { key: "ArrowRight" });
    await waitFor(() =>
      expect(panel.getByRole("button", { name: /23 de outubro de 2026/i })).toHaveFocus(),
    );
    fireEvent.click(panel.getByRole("button", { name: /24 de outubro de 2026/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger()).toHaveTextContent("24/10/2026");
    expect(hiddenValue()).toBe("2026-10-24");
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(submit).toHaveBeenCalledWith("2026-10-24");
  });

  it("handles year transitions, leap days, reopening the selected month, clearing and today", async () => {
    viewport(false);
    vi.setSystemTime(new Date(2027, 11, 31, 12));
    render(<OrderDatePicker />);
    let panel = await open();
    fireEvent.click(panel.getByRole("button", { name: "Ir para o próximo mês" }));
    expect(panel.getByText("Janeiro 2028")).toBeInTheDocument();
    fireEvent.click(panel.getByRole("button", { name: "Ir para o próximo mês" }));
    fireEvent.click(panel.getByRole("button", { name: /29 de fevereiro de 2028/i }));
    expect(hiddenValue()).toBe("2028-02-29");
    panel = await open();
    expect(panel.getByText("Fevereiro 2028")).toBeInTheDocument();
    fireEvent.click(panel.getByRole("button", { name: "Limpar" }));
    expect(hiddenValue()).toBe("");
    panel = await open();
    expect(panel.getByText("Dezembro 2027")).toBeInTheDocument();
    fireEvent.click(panel.getByRole("button", { name: "Hoje" }));
    expect(hiddenValue()).toBe("2027-12-31");
    expect(trigger()).toHaveTextContent("31/12/2027");
  });

  it("confirms mobile drafts, cancels without changing the form, locks scrolling and restores focus", async () => {
    viewport(true);
    render(<OrderDatePicker />);
    let panel = await open();
    expect(document.body).toHaveAttribute("data-scroll-locked");
    fireEvent.click(panel.getByRole("button", { name: /25 de outubro de 2026/i }));
    expect(hiddenValue()).toBe("");
    fireEvent.click(panel.getByRole("button", { name: "Fechar calendário" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(hiddenValue()).toBe("");
    await waitFor(() => expect(trigger()).toHaveFocus());
    panel = await open();
    fireEvent.click(panel.getByRole("button", { name: /26 de outubro de 2026/i }));
    fireEvent.click(panel.getByRole("button", { name: "Confirmar data" }));
    expect(hiddenValue()).toBe("2026-10-26");
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
    panel = await open();
    fireEvent.click(panel.getByRole("button", { name: /27 de outubro de 2026/i }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(hiddenValue()).toBe("2026-10-26");
    panel = await open();
    fireEvent.pointerDown(document.querySelector(".storefront-overlay")!, {
      button: 0,
      pointerType: "mouse",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    panel = await open();
    fireEvent.click(panel.getByRole("button", { name: "Limpar" }));
    expect(hiddenValue()).toBe("");
  });

  it("closes the desktop popover with Escape and outside interaction", async () => {
    viewport(false);
    render(
      <div>
        <OrderDatePicker />
        <button type="button">Exterior</button>
      </div>,
    );
    await open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger()).toHaveFocus());
    await open();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Exterior" }), {
      button: 0,
      pointerType: "mouse",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("updates the minimum at local midnight and expires a date that has become past", async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 23, 59, 59));
    viewport(true);
    render(<OrderDatePicker />);
    fireEvent.click(trigger());
    const panel = within(screen.getByRole("dialog"));
    fireEvent.click(panel.getByRole("button", { name: /24 de outubro de 2026/i }));
    fireEvent.click(panel.getByRole("button", { name: "Confirmar data" }));
    expect(hiddenValue()).toBe("2026-10-24");
    act(() => vi.advanceTimersByTime(1000));
    expect(hiddenValue()).toBe("");
    fireEvent.click(trigger());
    const nextDay = within(screen.getByRole("dialog"));
    expect(nextDay.getByRole("button", { name: /24 de outubro de 2026/i })).toBeDisabled();
    expect(nextDay.getByRole("button", { name: /25 de outubro de 2026/i })).not.toBeDisabled();
  });

  it("hydrates stable closed markup on mobile without rendering a server calendar", async () => {
    viewport(true);
    const element = document.createElement("div");
    element.innerHTML = renderToString(<OrderDatePicker />);
    document.body.append(element);
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    const recoverable = vi.fn();
    const errors = vi.spyOn(console, "error");
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(element, <OrderDatePicker />, { onRecoverableError: recoverable });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    act(() => root.unmount());
    element.remove();
  });
});
