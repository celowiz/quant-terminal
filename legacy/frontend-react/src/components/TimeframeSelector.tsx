import React from 'react'

type TimeframeSelectorProps = {
  timeframe: string
  setTimeframe: (value: string) => void
}

const timeframeOptions = [
  { value: 'd', label: 'Diário' },
  { value: 'w', label: 'Semanal' },
  { value: 'm', label: 'Mensal' },
  { value: 'q', label: 'Trimestral' },
  { value: 'y', label: 'Anual' }
]

export default function TimeframeSelector({ timeframe, setTimeframe }: TimeframeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-white text-sm font-bold whitespace-nowrap">
        Período:
      </label>
      <select 
        value={timeframe}
        onChange={(e) => setTimeframe(e.target.value)}
        className="bg-black text-white border border-[#FFA028] px-3 py-2 rounded-sm text-sm font-bold cursor-pointer min-w-[120px] outline-none focus:ring-2 focus:ring-[#FFA028] focus:ring-opacity-50"
      >
        {timeframeOptions.map(option => (
          <option key={option.value} value={option.value} className="bg-black text-white">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
