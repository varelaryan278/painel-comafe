"use client";

export function Seg<T extends string>({ options, value, onChange, dots, label }: {
  options: [T, string][]; value: T; onChange: (v: T) => void; dots?: Partial<Record<string, string>>; label?: string;
}) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(([v, l]) => (
        <button key={v} type="button" className={"seg" + (value === v ? " on" : "")} aria-pressed={value === v} onClick={() => onChange(v)}>
          {dots?.[v] && <span className="dot" style={{ background: dots[v] }} />}
          {l}
        </button>
      ))}
    </div>
  );
}
