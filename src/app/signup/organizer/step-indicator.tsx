const STEPS = ["Organization", "Stripe", "First event"] as const;

export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div>
      <p className="eyebrow-signal">
        Step {current} of 3 · {STEPS[current - 1]}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {STEPS.map((_, idx) => {
          const step = idx + 1;
          const state =
            step < current ? "done" : step === current ? "active" : "todo";
          return (
            <span
              key={step}
              aria-hidden
              className="h-[3px] rounded-full"
              style={{
                background:
                  state === "todo"
                    ? "hsl(var(--hairline))"
                    : "hsl(var(--signal))",
                opacity: state === "done" ? 0.45 : 1,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
