'use client';

export interface Tab {
  id: string;
  etiqueta: string;
}

export function Tabs({
  tabs,
  activa,
  onChange,
}: {
  tabs: Tab[];
  activa: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Secciones" className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activa === tab.id}
          onClick={() => onChange(tab.id)}
          className={`min-h-[44px] shrink-0 rounded-[8px] border px-3 py-2 ${
            activa === tab.id
              ? 'border-[#0A2A5E] bg-[#0A2A5E] text-white'
              : 'border-[#D9DEE7] bg-white text-[#1B2433]'
          }`}
        >
          {tab.etiqueta}
        </button>
      ))}
    </div>
  );
}
