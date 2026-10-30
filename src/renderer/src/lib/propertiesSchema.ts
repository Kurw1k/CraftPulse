import { translate, type Language } from '@shared/i18n'

export type PropertyFieldType = 'text' | 'number' | 'boolean' | 'select'

export interface PropertyField {
  key: string
  label: string
  type: PropertyFieldType
  hint?: string
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  min?: number
  max?: number
  step?: number
}

export interface PropertySection {
  title: string
  description: string
  fields: PropertyField[]
}

export const PROPERTY_SECTIONS: PropertySection[] = [
  {
    title: 'Сеть и доступ',
    description: 'Порт, MOTD и параметры подключения игроков.',
    fields: [
      { key: 'server-port', label: 'Порт сервера', type: 'number', min: 1, max: 65535 },
      {
        key: 'server-ip',
        label: 'Привязать к IP',
        type: 'text',
        placeholder: '0.0.0.0',
        hint: 'Оставьте пустым, чтобы слушать все интерфейсы.'
      },
      {
        key: 'online-mode',
        label: 'Online mode',
        type: 'boolean',
        hint: 'Проверка лицензии Mojang. Отключение опасно для публичного сервера.'
      },
      { key: 'max-players', label: 'Максимум игроков', type: 'number', min: 1, max: 1000 },
      { key: 'motd', label: 'MOTD', type: 'text', placeholder: 'A CraftPulse Minecraft Server' },
      {
        key: 'network-compression-threshold',
        label: 'Порог сжатия сети',
        type: 'number',
        min: -1,
        max: 65536
      },
      {
        key: 'white-list',
        label: 'Белый список',
        type: 'boolean',
        hint: 'Разрешает вход только игрокам из whitelist.json.'
      },
      { key: 'enforce-whitelist', label: 'Строгий whitelist', type: 'boolean' },
      { key: 'enable-rcon', label: 'Включить RCON', type: 'boolean' },
      { key: 'rcon.port', label: 'Порт RCON', type: 'number', min: 1, max: 65535 },
      { key: 'rcon.password', label: 'Пароль RCON', type: 'text', placeholder: 'секрет' }
    ]
  },
  {
    title: 'Геймплей',
    description: 'Режим игры, сложность и правила выживания.',
    fields: [
      {
        key: 'gamemode',
        label: 'Режим игры',
        type: 'select',
        options: [
          { value: 'survival', label: 'Survival' },
          { value: 'creative', label: 'Creative' },
          { value: 'adventure', label: 'Adventure' },
          { value: 'spectator', label: 'Spectator' }
        ]
      },
      {
        key: 'difficulty',
        label: 'Сложность',
        type: 'select',
        options: [
          { value: 'peaceful', label: 'Peaceful' },
          { value: 'easy', label: 'Easy' },
          { value: 'normal', label: 'Normal' },
          { value: 'hard', label: 'Hard' }
        ]
      },
      { key: 'hardcore', label: 'Hardcore', type: 'boolean' },
      { key: 'pvp', label: 'PvP', type: 'boolean' },
      { key: 'allow-flight', label: 'Разрешить полёт', type: 'boolean' },
      { key: 'allow-nether', label: 'Разрешить Нижний мир', type: 'boolean' },
      { key: 'force-gamemode', label: 'Принудительный режим', type: 'boolean' },
      { key: 'enable-command-block', label: 'Command blocks', type: 'boolean' },
      {
        key: 'player-idle-timeout',
        label: 'AFK-таймаут (мин)',
        type: 'number',
        min: 0,
        max: 1440,
        hint: '0 — не кикать игроков за неактивность.'
      },
      { key: 'spawn-protection', label: 'Защита спавна (блоки)', type: 'number', min: 0 }
    ]
  },
  {
    title: 'Мир и производительность',
    description: 'Параметры генерации и дальности прогрузки.',
    fields: [
      { key: 'level-name', label: 'Папка мира', type: 'text', placeholder: 'world' },
      { key: 'level-seed', label: 'Сид мира', type: 'text', placeholder: 'случайный' },
      {
        key: 'level-type',
        label: 'Тип мира',
        type: 'select',
        options: [
          { value: 'minecraft:normal', label: 'Normal' },
          { value: 'minecraft:flat', label: 'Superflat' },
          { value: 'minecraft:large_biomes', label: 'Large biomes' },
          { value: 'minecraft:amplified', label: 'Amplified' }
        ]
      },
      { key: 'generate-structures', label: 'Структуры', type: 'boolean' },
      {
        key: 'max-world-size',
        label: 'Макс. размер мира',
        type: 'number',
        min: 1,
        max: 29999984
      },
      {
        key: 'view-distance',
        label: 'View distance',
        type: 'number',
        min: 2,
        max: 32,
        hint: 'Сильнее всего влияет на нагрузку и трафик.'
      },
      {
        key: 'simulation-distance',
        label: 'Simulation distance',
        type: 'number',
        min: 2,
        max: 32
      },
      { key: 'spawn-monsters', label: 'Спавн монстров', type: 'boolean' },
      { key: 'spawn-animals', label: 'Спавн животных', type: 'boolean' },
      { key: 'spawn-npcs', label: 'Спавн NPC', type: 'boolean' }
    ]
  }
]

export const KNOWN_PROPERTY_KEYS = new Set(
  PROPERTY_SECTIONS.flatMap((section) => section.fields.map((field) => field.key))
)

/**
 * Тот же набор секций, но с подписями и подсказками на нужном языке.
 * Исходные русские строки используются как ключи словаря.
 */
export function propertySections(language: Language): PropertySection[] {
  return PROPERTY_SECTIONS.map((section) => ({
    title: translate(language, section.title),
    description: translate(language, section.description),
    fields: section.fields.map((field) => ({
      ...field,
      label: translate(language, field.label),
      hint: field.hint ? translate(language, field.hint) : undefined,
      placeholder: field.placeholder ? translate(language, field.placeholder) : undefined,
      options: field.options?.map((option) => ({
        ...option,
        label: translate(language, option.label)
      }))
    }))
  }))
}
