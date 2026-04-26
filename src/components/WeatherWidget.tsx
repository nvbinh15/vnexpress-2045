import { WeatherIcon } from './icons'

interface CityTemp {
  city: string
  temp: number
}

const DEFAULTS: CityTemp[] = [
  { city: 'Hà Nội', temp: 28 },
  { city: 'TP HCM', temp: 32 },
]

interface Props {
  cities?: CityTemp[]
  variant?: 'topbar' | 'inline'
}

export default function WeatherWidget({ cities = DEFAULTS, variant = 'topbar' }: Props) {
  if (variant === 'topbar') {
    return (
      <span className="inline-flex items-center gap-1 text-vne-mute">
        <WeatherIcon size={14} className="text-vne-red" />
        {cities.map((c, i) => (
          <span key={c.city} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-vne-line">·</span>}
            <span>{c.city}</span>
            <span className="font-bold text-vne-ink">{c.temp}°</span>
          </span>
        ))}
      </span>
    )
  }
  return (
    <div className="flex items-center gap-3 px-3 py-2 border border-vne-line rounded-sm bg-white">
      <WeatherIcon size={20} className="text-vne-red" />
      {cities.map(c => (
        <div key={c.city} className="flex flex-col leading-tight">
          <span className="text-[11px] text-vne-mute">{c.city}</span>
          <span className="text-[14px] font-bold text-vne-ink">{c.temp}°C</span>
        </div>
      ))}
    </div>
  )
}
