import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  prepare: vi.fn(),
  save: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("@/lib/site-settings", () => ({
  siteSettingsQuery: { queryKey: ["site-settings"], queryFn: mocks.read },
  saveSiteImage: mocks.save,
}));
vi.mock("@/lib/site-image", () => ({ prepareSiteImage: mocks.prepare }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

import { Route } from "@/routes/admin.definicoes";

const SettingsPage = Route.options.component as ComponentType;
const photo = new Blob(["processed"], { type: "image/webp" });
let queryClient: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.read.mockResolvedValue({ id: 1, hero_image_url: null, custom_bouquet_image_url: null });
  mocks.prepare.mockResolvedValue(photo);
  mocks.save.mockResolvedValue("https://storage.test/updated.webp");
  vi.stubGlobal("URL", { createObjectURL: () => "blob:preview", revokeObjectURL: mocks.revoke });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

async function openSettings() {
  render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Alterar fotografia" })[0]).toBeEnabled(),
  );
}

describe("Admin photo workflow", () => {
  it.each([
    ["Imagem principal da homepage", "hero_image_url"],
    ["Imagem dos personalizados", "custom_bouquet_image_url"],
  ])("previews and saves %s only after clicking Guardar", async (title, field) => {
    await openSettings();
    const section = within(screen.getByRole("region", { name: title! }));
    expect(section.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(section.getByLabelText(`Tirar fotografia: ${title}`)).toHaveAttribute(
      "capture",
      "environment",
    );
    fireEvent.change(section.getByLabelText(`Escolher fotografia: ${title}`), {
      target: { files: [new File(["original"], "phone.jpg", { type: "image/jpeg" })] },
    });
    await section.findByText("Nova fotografia selecionada. Guarda para atualizar a homepage.");
    expect(mocks.prepare).toHaveBeenCalledWith(expect.any(File), field);
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(section.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith("Imagem atualizada com sucesso."),
    );
    expect(mocks.save).toHaveBeenCalledWith(field, photo);
    expect(section.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(mocks.revoke).toHaveBeenCalledWith("blob:preview");
  });

  it("keeps a selected photo available to retry when saving fails", async () => {
    mocks.save.mockRejectedValue(new Error("Não foi possível enviar a fotografia."));
    await openSettings();
    const section = within(screen.getByRole("region", { name: "Imagem principal da homepage" }));
    fireEvent.change(section.getByLabelText("Escolher fotografia: Imagem principal da homepage"), {
      target: { files: [new File(["original"], "phone.jpg", { type: "image/jpeg" })] },
    });
    await section.findByText("Nova fotografia selecionada. Guarda para atualizar a homepage.");
    fireEvent.click(section.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("Não foi possível enviar a fotografia."),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(section.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });
});
