import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  prepare: vi.fn(),
  upload: vi.fn(),
  reorder: vi.fn(),
  visibility: vi.fn(),
  remove: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/gallery-admin", () => ({
  adminGalleryQuery: { queryKey: ["admin", "gallery"], queryFn: mocks.read, retry: false },
  prepareGalleryImage: mocks.prepare,
  uploadGalleryImage: mocks.upload,
  reorderGalleryImages: mocks.reorder,
  setGalleryVisibility: mocks.visibility,
  deleteGalleryImage: mocks.remove,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
import { Route } from "@/routes/admin.galeria";
const Page = Route.options.component as ComponentType;
const row = {
  id: "one",
  image_url: "/one.webp",
  width: 1000,
  height: 1400,
  sort_order: 0,
  is_active: true,
  created_at: "2026-10-08",
};
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.read.mockResolvedValue([row]);
  mocks.prepare.mockResolvedValue({
    image: new Blob(["webp"], { type: "image/webp" }),
    width: 1000,
    height: 1400,
  });
  mocks.upload.mockResolvedValue({ ...row, id: "new" });
  mocks.reorder.mockResolvedValue(undefined);
  mocks.visibility.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue({ storageCleanupFailed: false });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
});
async function page() {
  render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
  await screen.findByAltText("Fotografia 1 da galeria");
}
describe("Simple gallery administration", () => {
  it("prepares multiple images for preview, uploads only on Guardar and preserves failed photos for retry", async () => {
    await page();
    const files = [
      new File(["original"], "one.jpg", { type: "image/jpeg" }),
      new File(["original"], "two.png", { type: "image/png" }),
    ];
    fireEvent.change(screen.getByLabelText("Escolher fotografias para a galeria"), {
      target: { files },
    });
    const save = await screen.findByRole("button", { name: "Guardar fotografias (2)" });
    await waitFor(() => expect(save).toBeEnabled());
    expect(mocks.prepare).toHaveBeenCalledTimes(2);
    expect(screen.getAllByAltText(/Nova fotografia/)).toHaveLength(2);
    expect(mocks.upload).not.toHaveBeenCalled();
    mocks.upload
      .mockResolvedValueOnce({ ...row, id: "first-new", sort_order: 1 })
      .mockRejectedValueOnce(new Error("Falha de envio"));
    fireEvent.click(save);
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(2));
    const retry = await screen.findByRole("button", { name: "Guardar fotografias (1)" });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(screen.getAllByAltText(/Nova fotografia/)).toHaveLength(1);
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("continuam selecionadas"));
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Guardar fotografias/ })).not.toBeInTheDocument(),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(mocks.success).toHaveBeenCalledWith("Fotografias adicionadas à galeria.");
  });
  it("reorders by IDs, hides/shows and confirms deletion without product fields", async () => {
    mocks.read.mockResolvedValue([row, { ...row, id: "two", is_active: false, sort_order: 1 }]);
    await page();
    expect(screen.queryByLabelText(/Preço|Categoria|Título|Descrição/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Descer fotografia 1" }));
    await waitFor(() => expect(mocks.reorder).toHaveBeenCalledWith(["two", "one"]));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ocultar fotografia 1" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ocultar fotografia 1" }));
    await waitFor(() => expect(mocks.visibility).toHaveBeenCalledWith("one", false));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Mostrar fotografia 2" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mostrar fotografia 2" }));
    await waitFor(() => expect(mocks.visibility).toHaveBeenCalledWith("two", true));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Eliminar fotografia 1" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar fotografia 1" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(row));
  });
  it("leaves ordering unchanged on failure and reports the failure", async () => {
    mocks.read.mockResolvedValue([row, { ...row, id: "two", sort_order: 1 }]);
    mocks.reorder.mockRejectedValue(new Error("Não foi possível guardar a ordem."));
    await page();
    fireEvent.click(screen.getByRole("button", { name: "Descer fotografia 1" }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("Não foi possível guardar a ordem."),
    );
    expect(client.getQueryData(["admin", "gallery"])).toEqual([
      row,
      { ...row, id: "two", sort_order: 1 },
    ]);
  });
  it("disables upload when the migration is unavailable and supports mobile camera selection", async () => {
    mocks.read.mockRejectedValue(new Error("Aplica a configuração da galeria."));
    render(
      <QueryClientProvider client={client}>
        <Page />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Aplica a configuração da galeria.");
    expect(screen.getByRole("button", { name: "Adicionar fotografias" })).toBeDisabled();
    expect(screen.getByLabelText("Tirar fotografia para a galeria")).toHaveAttribute(
      "capture",
      "environment",
    );
    expect(screen.getByLabelText("Escolher fotografias para a galeria")).toHaveAttribute(
      "multiple",
    );
  });
});
