import { useCallback, useSyncExternalStore } from "react";
import { useRouter } from "@tanstack/react-router";

type ModalParam = "produto" | "imagem" | "calendario";
type ModalEntry = { parentIndex: number; pathname: string };

declare module "@tanstack/history" {
  interface HistoryState {
    eternaFlorModal?: ModalEntry;
  }
}

const closingEntries = new WeakMap<object, string>();

function hasParent(entry: ModalEntry | undefined, pathname: string, index: number) {
  return entry?.pathname === pathname && entry.parentIndex === index - 1;
}

/** URL-backed modal state using the router's history, including native Back/Forward. */
export function useModalHistory(param: ModalParam) {
  const router = useRouter();
  const history = router.history;
  useSyncExternalStore(
    history.subscribe,
    () => history.location.href,
    () => history.location.href,
  );
  const read = () => router.options.parseSearch(history.location.search);
  const selected = read()[param];
  const value = typeof selected === "string" && selected.length > 0 ? selected : null;

  const change = useCallback(
    (next: string | null) => {
      const search = router.options.parseSearch(history.location.search);
      if ((search[param] ?? null) === next) return;
      const { state, pathname } = history.location;
      const closingKey = closingEntries.get(history);
      if (closingKey && closingKey === state.__TSR_key) return;
      const entry = state.eternaFlorModal;
      if (next === null && hasParent(entry, pathname, state.__TSR_index)) {
        // X, Escape and backdrop consume the same entry as device Back. Guard
        // repeated dismiss events while the browser's asynchronous pop is pending.
        closingEntries.set(history, state.__TSR_key ?? state.key ?? String(state.__TSR_index));
        const unsubscribe = history.subscribe(({ location }) => {
          if (location.state.__TSR_key !== closingEntries.get(history)) {
            closingEntries.delete(history);
            unsubscribe();
          }
        });
        history.back();
        return;
      }

      const replacing = next === null || typeof search[param] === "string";
      const nextSearch = { ...search };
      if (next === null) delete nextSearch[param];
      else nextSearch[param] = next;
      let marker = entry;
      if (!replacing) {
        marker = {
          parentIndex: state.__TSR_index,
          pathname,
        };
      }
      void router.navigate({
        to: ".",
        search: nextSearch,
        hash: true,
        // Retain an existing section anchor without scrolling back to its top.
        hashScrollIntoView: false,
        replace: replacing,
        resetScroll: false,
        state: (previous) => {
          const nextState = { ...previous };
          if (next !== null && marker) nextState.eternaFlorModal = marker;
          else delete nextState.eternaFlorModal;
          return nextState;
        },
      });
    },
    [router, history, param],
  );
  const close = useCallback(() => change(null), [change]);

  const ensureHistory = useCallback(() => {
    const location = history.location;
    const search = router.options.parseSearch(location.search);
    if (
      typeof search[param] !== "string" ||
      hasParent(location.state.eternaFlorModal, location.pathname, location.state.__TSR_index)
    )
      return;

    // A direct URL has no underlying page entry yet. Create it once, after
    // hydration, so native Back also closes deep-linked modals. The persisted
    // marker prevents adding another entry on refresh or Forward.
    const baseSearch = { ...search };
    delete baseSearch[param];
    const base = router.buildLocation({ to: ".", search: baseSearch, hash: true });
    const baseState = { ...location.state };
    baseState.__hashScrollIntoViewOptions = false;
    delete baseState.eternaFlorModal;
    history.replace(base.href, baseState);
    // Browser history batches mutations; commit the base before pushing the modal.
    history.flush?.();
    history.push(location.href, {
      ...location.state,
      __hashScrollIntoViewOptions: false,
      eternaFlorModal: { parentIndex: location.state.__TSR_index, pathname: location.pathname },
    });
  }, [router, history, param]);

  return { value, change, close, ensureHistory };
}
