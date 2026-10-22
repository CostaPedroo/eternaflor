import { useEffect, useId, useState } from "react";
import { format, parseISO, startOfDay } from "date-fns";
import { DayButton } from "react-day-picker";
import { pt } from "react-day-picker/locale";
import { CalendarDays, X } from "lucide-react";
import { Content as DialogContent } from "@radix-ui/react-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { motionStyle } from "@/lib/storefront-motion";

// Calendar dates are local civil dates. Never serialize them through UTC/toISOString.
const dateValue = (date: Date) => format(date, "yyyy-MM-dd");
const weekdays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const navigationButton =
  "grid h-11 w-11 place-items-center rounded-full text-primary hover:bg-muted disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

/** The optional hidden field preserves the native date field's FormData contract. */
export function OrderDatePicker() {
  const labelId = useId();
  const [value, setValue] = useState("");
  const [draft, setDraft] = useState<Date>();
  const [today, setToday] = useState<Date>();
  const [month, setMonth] = useState<Date>();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setOpen(false);
      setMobile(media.matches);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = new Date();
      const current = startOfDay(now);
      const minimum = dateValue(current);
      setToday(current);
      setValue((previous) => (previous && previous < minimum ? "" : previous));
      setDraft((previous) => (previous && dateValue(previous) < minimum ? undefined : previous));
      // A local midnight accounts for both 23-hour and 25-hour DST days.
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    };
    refresh();
    return () => clearTimeout(timer);
  }, []);

  const changeOpen = (next: boolean) => {
    if (next) {
      const current = startOfDay(new Date());
      const selected = value && value >= dateValue(current) ? parseISO(value) : undefined;
      setToday(current);
      setDraft(selected);
      setMonth(selected ?? current);
    }
    setOpen(next);
  };

  const commit = (date?: Date) => {
    if (date && dateValue(date) < dateValue(new Date())) {
      setToday(startOfDay(new Date()));
      setDraft(undefined);
      return;
    }
    setValue(date ? dateValue(date) : "");
    setOpen(false);
  };

  const Root = mobile ? Dialog : Popover;
  const Trigger = mobile ? DialogTrigger : PopoverTrigger;
  const calendar = (
    <Calendar
      mode="single"
      locale={pt}
      weekStartsOn={0}
      selected={draft}
      {...(month ? { month } : {})}
      onMonthChange={setMonth}
      {...(today ? { today, startMonth: today, disabled: { before: today } } : {})}
      onSelect={(date) => (mobile ? setDraft(date) : commit(date))}
      autoFocus
      fixedWeeks
      className="w-full bg-background p-0"
      components={{ DayButton }}
      formatters={{
        formatCaption: (date) => {
          const text = format(date, "MMMM yyyy", { locale: pt });
          return text.charAt(0).toUpperCase() + text.slice(1);
        },
        formatWeekdayName: (date) => weekdays[date.getDay()]!,
      }}
      classNames={{
        root: "w-full",
        months: "relative w-full",
        month: "flex w-full flex-col gap-4",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: navigationButton,
        button_next: navigationButton,
        month_caption: "flex min-h-11 items-center justify-center px-11",
        caption_label: "font-serif text-2xl font-light",
        table: "w-full table-fixed border-collapse",
        weekdays: "grid grid-cols-7",
        weekday:
          "pb-3 pt-1 text-center text-[10px] font-normal tracking-[0.15em] text-muted-foreground",
        week: "grid grid-cols-7",
        day: "relative aspect-square min-w-0 p-0 text-center",
        day_button:
          "h-full w-full rounded-full font-serif text-xl font-light text-current hover:bg-muted disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
        selected: "[&>button]:bg-primary [&>button]:text-white [&>button]:hover:bg-primary",
        today: "[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-blush",
        outside: "text-muted-foreground/50",
        disabled: "opacity-35",
        hidden: "invisible",
      }}
    />
  );

  return (
    <div className="min-w-0">
      <span
        id={labelId}
        className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
      >
        Data em que precisa
      </span>
      <input type="hidden" name="data" value={value} />
      <Root open={open} onOpenChange={changeOpen}>
        <Trigger asChild>
          <button
            type="button"
            aria-labelledby={labelId}
            aria-describedby={`${labelId}-value`}
            className="mt-1 flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-transparent px-3 py-2 text-left font-serif text-xl font-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span id={`${labelId}-value`} className={value ? "" : "text-muted-foreground/60"}>
              {value ? format(parseISO(value), "dd/MM/yyyy") : "dd/mm/yyyy"}
            </span>
            <CalendarDays aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
          </button>
        </Trigger>
        {mobile ? (
          <DialogPortal>
            <DialogOverlay className="storefront-overlay bg-foreground/40" style={motionStyle} />
            <DialogContent
              style={motionStyle}
              className="storefront-dialog fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-1rem)] flex-col rounded-t-[2rem] border border-border bg-background text-foreground shadow-soft outline-none"
            >
              <div
                aria-hidden="true"
                className="mx-auto mt-3 h-1 w-12 shrink-0 rounded-full bg-border"
              />
              <div className="grid shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center border-b border-border px-5 py-3">
                <span aria-hidden="true" />
                <DialogTitle className="text-center font-serif text-3xl font-light italic">
                  Escolher data
                </DialogTitle>
                <DialogClose
                  aria-label="Fechar calendário"
                  className="grid h-11 w-11 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </DialogClose>
              </div>
              <DialogDescription className="sr-only">
                Escolhe uma data a partir de hoje e confirma.
              </DialogDescription>
              <div className="min-h-0 overflow-y-auto p-3">
                <div className="mx-auto w-full max-w-md">{calendar}</div>
              </div>
              <div className="shrink-0 px-5 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  disabled={!draft}
                  onClick={() => commit(draft)}
                  className="min-h-12 w-full rounded-lg bg-primary px-4 py-3 font-serif text-xl text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Confirmar data
                </button>
                <button
                  type="button"
                  onClick={() => commit()}
                  className="mt-1 min-h-11 w-full text-sm text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  Limpar
                </button>
              </div>
            </DialogContent>
          </DialogPortal>
        ) : (
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            collisionPadding={16}
            aria-label="Escolher data"
            className="storefront-dialog max-h-[var(--radix-popover-content-available-height)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-[1.25rem] border-blush bg-background p-4 text-foreground shadow-soft motion-reduce:animate-none"
          >
            {calendar}
            <div className="mt-4 flex items-center justify-between border-t border-border pt-2">
              <button
                type="button"
                onClick={() => commit(startOfDay(new Date()))}
                className="min-h-11 px-2 text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => commit()}
                className="min-h-11 px-2 text-sm text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Limpar
              </button>
            </div>
          </PopoverContent>
        )}
      </Root>
    </div>
  );
}
