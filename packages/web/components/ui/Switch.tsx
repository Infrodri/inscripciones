'use client';

interface Props {
  id: string;
  etiqueta: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

export function Switch({ id, etiqueta, checked, onChange }: Props) {
  return (
    <div className="flex min-h-[44px] items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-etiqueta`}
        id={id}
        onClick={() => onChange(!checked)}
        className={`relative h-7 min-w-[44px] rounded-full transition-colors ${
          checked ? 'bg-[#0A2A5E]' : 'bg-[#D9DEE7]'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </button>
      <span id={`${id}-etiqueta`} className="text-[#1B2433]">
        {etiqueta}
      </span>
    </div>
  );
}
