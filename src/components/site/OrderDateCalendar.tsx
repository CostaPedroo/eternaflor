import { format } from "date-fns";
import { DayButton } from "react-day-picker";
import { pt } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";

export type OrderDateCalendarProps = {
  selected: Date | undefined;
  month: Date | undefined;
  today: Date | undefined;
  onMonthChange: (date: Date) => void;
  onSelect: (date: Date | undefined) => void;
};

const weekdays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const navigationButton =
  "grid h-11 w-11 place-items-center rounded-full text-primary hover:bg-muted disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

export default function OrderDateCalendar({
  selected,
  month,
  today,
  onMonthChange,
  onSelect,
}: OrderDateCalendarProps) {
  return (
    <Calendar
      mode="single"
      locale={pt}
      weekStartsOn={0}
      selected={selected}
      {...(month ? { month } : {})}
      onMonthChange={onMonthChange}
      {...(today ? { today, startMonth: today, disabled: { before: today } } : {})}
      onSelect={onSelect}
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
}
