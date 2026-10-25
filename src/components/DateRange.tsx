import { useRef } from 'react'

type DateRangeProps = {
  startDate: string
  setStartDate: (value: string) => void
  endDate: string
  setEndDate: (value: string) => void
  onDateChange?: () => void
}

export default function DateRange({ startDate, setStartDate, endDate, setEndDate, onDateChange }: DateRangeProps) {
  const startRef = useRef<HTMLInputElement | null>(null)
  const endRef = useRef<HTMLInputElement | null>(null)
  
  return (
    <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <label className="text-white text-sm font-bold whitespace-nowrap">
            Start date:
          </label>
          <input
            type="date"
            ref={startRef}
            className="bg-black text-white border border-[#FFA028] px-3 py-2 rounded-sm text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFA028] focus:ring-opacity-50"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onBlur={() => onDateChange && onDateChange()}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-white text-sm font-bold whitespace-nowrap">
            End date:
          </label>
          <input
            type="date"
            ref={endRef}
            className="bg-black text-white border border-[#FFA028] px-3 py-2 rounded-sm text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFA028] focus:ring-opacity-50"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onBlur={() => onDateChange && onDateChange()}
          />
        </div>
      </div>
  )
}