export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface ExportOutcome {
  mode: "desktop" | "browser";
  path?: string;
}

function downloadInBrowser(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function saveGpx(filename: string, contents: string): Promise<ExportOutcome> {
  if (!isTauri()) {
    downloadInBrowser(filename, contents);
    return { mode: "browser" };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke<{ path: string }>("save_gpx", { filename, contents });
  return { mode: "desktop", path: result.path };
}

export async function revealInFinder(path: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("reveal_in_finder", { path });
}
