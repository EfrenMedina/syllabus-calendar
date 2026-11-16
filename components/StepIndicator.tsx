import { Check } from "lucide-react";

const STEPS = ["Upload", "Review", "Export"] as const;

export function StepIndicator(props: { current: 1 | 2 | 3 }): React.JSX.Element {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((label, i) => {
          const step = i + 1;
          const done = step < props.current;
          const active = step === props.current;
          return (
            <li key={label} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              {i > 0 && <span aria-hidden className="h-px w-6 bg-zinc-300 sm:w-10 dark:bg-zinc-700" />}
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                  active
                    ? "bg-blue-600 text-white"
                    : done
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "border border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : step}
              </span>
              <span className={active ? "font-medium" : "text-zinc-500 dark:text-zinc-400"}>
                {label}
                <span className="sr-only">{done ? " (done)" : active ? " (current step)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
