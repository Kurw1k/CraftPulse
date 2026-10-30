import { getLocale } from './locale'

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function formatMemory(mb: number): string {
  if (!Number.isFinite(mb)) return '—'
  const ru = getLocale() === 'ru'
  if (mb >= 1024) {
    const gb = mb / 1024
    return `${gb >= 10 ? gb.toFixed(0) : gb.toFixed(1)} ${ru ? 'ГБ' : 'GB'}`
  }
  return `${Math.round(mb)} ${ru ? 'МБ' : 'MB'}`
}

export function formatBytes(bytes: number): string {
  const ru = getLocale() === 'ru'
  const units = ru ? ['Б', 'КБ', 'МБ', 'ГБ'] : ['B', 'KB', 'MB', 'GB']
  if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${units[0]}`
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const ru = getLocale() === 'ru'
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}${ru ? ' млн' : 'M'}`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}${ru ? ' тыс.' : 'K'}`
  }
  return String(value)
}

export function formatDuration(ms: number): string {
  const ru = getLocale() === 'ru'
  const u = ru
    ? { d: 'д', h: 'ч', m: 'м', s: 'с' }
    : { d: 'd', h: 'h', m: 'm', s: 's' }
  if (!Number.isFinite(ms) || ms <= 0) return `0${u.s}`
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}${u.d} ${hours}${u.h}`
  if (hours > 0) return `${hours}${u.h} ${minutes}${u.m}`
  if (minutes > 0) return `${minutes}${u.m} ${seconds}${u.s}`
  return `${seconds}${u.s}`
}

export function formatDate(timestamp: number): string {
  const locale = getLocale() === 'ru' ? 'ru-RU' : 'en-US'
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(timestamp))
  } catch {
    return new Date(timestamp).toLocaleDateString()
  }
}

export function timeAgo(timestamp: number): string {
  const ru = getLocale() === 'ru'
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return ru ? 'только что' : 'just now'
  if (minutes < 60) return ru ? `${minutes} мин назад` : `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return ru ? `${hours} ч назад` : `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return ru ? `${days} дн назад` : `${days} d ago`
  return formatDate(timestamp)
}
