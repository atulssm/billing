"use client";

type QuantityStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
};

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max,
}: QuantityStepperProps) {
  const safeValue = Number.isNaN(value) ? 0 : value;

  function apply(next: number) {
    let v = next;
    if (max != null) v = Math.min(max, v);
    v = Math.max(min, v);
    onChange(v);
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950 text-[11px] text-slate-100">
      <button
        type="button"
        onClick={() => apply(safeValue - 1)}
        className="flex h-6 w-6 items-center justify-center rounded-l-lg text-slate-200 active:bg-slate-800 active:scale-95"
        aria-label="Decrease quantity"
      >
        -
      </button>
      <div className="flex min-w-[2.25rem] items-center justify-center px-1 text-[11px] font-medium">
        {safeValue}
      </div>
      <button
        type="button"
        onClick={() => apply(safeValue + 1)}
        className="flex h-6 w-6 items-center justify-center rounded-r-lg text-slate-200 active:bg-slate-800 active:scale-95"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

