/**
 * Локализация CraftPulse.
 *
 * Русские строки интерфейса используются как идентификаторы сообщений
 * (подход gettext): для русского языка возвращается исходная строка,
 * для английского — перевод из словаря EN. Если перевода нет, строка
 * остаётся русской — это лучше, чем пустой интерфейс.
 *
 * Параметры подставляются через `{name}`:
 *   translate(lang, 'Сервер «{name}» запущен', { name: 'paper-26-3' })
 */

export type Language = 'en' | 'ru'

export const LANGUAGES: Array<{ id: Language; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'ru', label: 'Русский' }
]

export const DEFAULT_LANGUAGE: Language = 'en'

/** Первый запуск: русская система → ru, всё остальное → en. */
export function detectLanguage(locale?: string | null): Language {
  if (!locale) return DEFAULT_LANGUAGE
  return locale.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'ru'
}

const EN: Record<string, string> = {
  // ── Ядра и группы ───────────────────────────────────────────────────────
  'Официальное серверное ядро Mojang. Максимальная совместимость.':
    'Official Mojang server core. Maximum compatibility.',
  'Высокопроизводительный форк Spigot с поддержкой плагинов.':
    'High-performance Spigot fork with plugin support.',
  'Форк Paper с расширенными настройками и оптимизациями.':
    'Paper fork with extended settings and optimizations.',
  'Многопоточный форк Paper для больших серверов с плагинами.':
    'Multithreaded Paper fork for large plugin servers.',
  'Классический форк Bukkit с плагинами и стабильными сборками.':
    'Classic Bukkit fork with plugins and stable builds.',
  'Оригинальное Bukkit-ядро для классических плагинов.':
    'Original Bukkit core for classic plugins.',
  'Высокопроизводительный форк Paper с оптимизациями для крупных серверов.':
    'High-performance Paper fork optimized for large servers.',
  'Форк Folia с исправлениями region-потоков и оптимизациями (Java 25).':
    'Folia fork with region-thread fixes and optimizations (Java 25).',
  'Лёгкий загрузчик модов с быстрым обновлением под новые версии.':
    'Lightweight mod loader with fast updates for new versions.',
  'Классический загрузчик модов с крупнейшей экосистемой.':
    'Classic mod loader with the largest ecosystem.',
  'Современный форк Forge для Minecraft 1.20.2 и новее.':
    'Modern Forge fork for Minecraft 1.20.2 and newer.',
  'Forge + Bukkit API: моды и плагины на одном сервере.':
    'Forge + Bukkit API: mods and plugins on one server.',
  'Forge + Bukkit: популярный гибрид для модов и плагинов.':
    'Forge + Bukkit: a popular hybrid for mods and plugins.',
  'Fabric + Bukkit от MohistMC: моды Fabric и плагины.':
    'Fabric + Bukkit by MohistMC: Fabric mods and plugins.',
  'NeoForge + Paper/Purpur API от MohistMC: моды и плагины вместе.':
    'NeoForge + Paper/Purpur API by MohistMC: mods and plugins together.',
  'Forge + Bukkit для 1.12.2 и 1.21.1. Гибридный сервер.':
    'Forge + Bukkit for 1.12.2 and 1.21.1. Hybrid server.',
  'Sponge API поверх Vanilla: плагины без модов.':
    'Sponge API on top of Vanilla: plugins without mods.',
  'Sponge API поверх Forge: плагины вместе с модами.':
    'Sponge API on top of Forge: plugins alongside mods.',
  'Современный высокопроизводительный прокси для сети серверов.':
    'Modern high-performance proxy for server networks.',
  'Классический прокси SpigotMC. Последняя сборка с CI.':
    'Classic SpigotMC proxy. Latest CI build.',
  'Форк BungeeCord от PaperMC. Поддержка завершена (EOL).':
    'BungeeCord fork by PaperMC. Support ended (EOL).',

  'Базовые': 'Base',
  'Плагины': 'Plugins',
  'Моды': 'Mods',
  'Гибриды · моды + плагины': 'Hybrids · mods + plugins',
  'Прокси': 'Proxies',

  'Остановлен': 'Stopped',
  'Запускается': 'Starting',
  'Работает': 'Running',
  'Останавливается': 'Stopping',
  'Упал': 'Crashed',

  // ── Словарь контента (modVocabulary) ────────────────────────────────────
  'Установленные плагины': 'Installed plugins',
  'Каталог плагинов': 'Plugin catalog',
  'плагин': 'plugin',
  'плагины': 'plugins',
  'Установленные моды': 'Installed mods',
  'Каталог модов': 'Mod catalog',
  'мод': 'mod',
  'моды': 'mods',
  'Дополнения': 'Add-ons',
  'Установленное': 'Installed',
  'Каталог дополнений': 'Add-on catalog',
  'дополнение': 'add-on',
  'дополнения': 'add-ons',
  'Моды и плагины': 'Mods and plugins',
  'Каталог модов и плагинов': 'Mod and plugin catalog',
  'файл': 'file',
  'файлы': 'files',

  // ── Интерфейс: общие строки ─────────────────────────────────────────────
  ' · включено {on} · отключено {off}': ' · enabled {on} · disabled {off}',
  '(код {code})': '(code {code})',
  '(сигнал {signal})': '(signal {signal})',
  '0 — не кикать игроков за неактивность.': '0 — do not kick players for inactivity.',
  '100% = 1 ядро': '100% = 1 core',
  'ArcLight не поддерживает Minecraft {version} ({flavor})':
    'ArcLight does not support Minecraft {version} ({flavor})',
  'CPU процесса': 'Process CPU',
  'CURSEFORGE_KEY_REQUIRED:Для загрузки с CurseForge добавьте API-ключ в настройках приложения':
    'CURSEFORGE_KEY_REQUIRED:To download from CurseForge, add an API key in the app settings',
  'CURSEFORGE_KEY_REQUIRED:Для поиска на CurseForge добавьте API-ключ в настройках приложения':
    'CURSEFORGE_KEY_REQUIRED:To search on CurseForge, add an API key in the app settings',
  'Canvas не публикует сборки для Minecraft {version}':
    'Canvas does not publish builds for Minecraft {version}',
  'CraftPulse определяет системные JVM и умеет скачивать Eclipse Temurin в папку runtimes.':
    'CraftPulse detects system JVMs and can download Eclipse Temurin into the runtimes folder.',
  'CraftPulse — лаунчер и менеджер Minecraft-серверов.':
    'CraftPulse — a Minecraft server launcher and manager.',
  'CraftPulse — локальный менеджер Minecraft-серверов.':
    'CraftPulse — a local Minecraft server manager.',
  'CurseForge требует API-ключ — добавьте его в настройках приложения.':
    'CurseForge requires an API key — add it in the app settings.',
  'DOWNLOAD_UNAVAILABLE:Автор мода запретил стороннее скачивание на CurseForge — установите файл вручную':
    'DOWNLOAD_UNAVAILABLE:The mod author disabled third-party downloads on CurseForge — install the file manually',
  'DOWNLOAD_UNAVAILABLE:Автор мода запретил стороннее скачивание этой версии на CurseForge — установите файл вручную':
    'DOWNLOAD_UNAVAILABLE:The mod author disabled third-party downloads for this version on CurseForge — install the file manually',
  'EULA принят — можно запускать сервер': 'EULA accepted — the server can start',
  'EULA_REQUIRED:Для запуска сервера нужно принять Minecraft EULA. Подтвердите согласие в лаунчере.':
    'EULA_REQUIRED:You must accept the Minecraft EULA to start the server. Confirm your acceptance in the launcher.',
  'Eclipse Temurin {major} установлена': 'Eclipse Temurin {major} installed',
  'Eclipse Temurin {major} установлена. Сохраните настройки сервера.':
    'Eclipse Temurin {major} installed. Save the server settings.',
  'Fabric не поддерживает Minecraft {version}': 'Fabric does not support Minecraft {version}',
  'Forge не поддерживает Minecraft {version}': 'Forge does not support Minecraft {version}',
  'Forge установлен, но не найден файл запуска (args.txt / forge jar). Проверьте вывод установщика.':
    'Forge is installed, but the launch file was not found (args.txt / forge jar). Check the installer output.',
  'JAVA_REQUIRED:{major}:Для Minecraft {version} нужна Java {major}. Установите её во вкладке настроек сервера.':
    'JAVA_REQUIRED:{major}:Minecraft {version} requires Java {major}. Install it in the server settings tab.',
  'Java / ядро': 'Java / core',
  'Java {major} не найдена. Загружаем Eclipse Temurin JDK {major}…':
    'Java {major} not found. Downloading Eclipse Temurin JDK {major}…',
  'Java {major} уже установлена: {path}': 'Java {major} is already installed: {path}',
  'Java {major} установлена': 'Java {major} installed',
  'Java авто': 'Java auto',
  'Java в один клик': 'Java in one click',
  'Java и сборка': 'Java and build',
  'Java не найдена.': 'Java not found.',
  'Java не найдена. Установите Temurin кнопкой выше.':
    'Java not found. Install Temurin with the button above.',
  'Java не определена': 'Java not detected',
  'Java по умолчанию': 'Default Java',
  'MODS_UNSUPPORTED:Это ядро не поддерживает моды. Выберите Fabric, Forge, NeoForge, Paper или гибридное ядро.':
    'MODS_UNSUPPORTED:This core does not support mods. Choose Fabric, Forge, NeoForge, Paper, or a hybrid core.',
  'Magma {version} не предоставила launcher.jar':
    'Magma {version} did not provide launcher.jar',
  'Magma не поддерживает Minecraft {version}': 'Magma does not support Minecraft {version}',
  'Minecraft EULA ещё не принят. Сервер не запустится, пока вы не подтвердите согласие.':
    'The Minecraft EULA has not been accepted yet. The server will not start until you confirm.',
  'Minecraft EULA принят': 'Minecraft EULA accepted',
  'Modrinth и CurseForge': 'Modrinth and CurseForge',
  'Modrinth работает без ключа. Для CurseForge нужен личный API-ключ.':
    'Modrinth works without a key. CurseForge requires a personal API key.',
  'Каналы обновлений модов и плагинов': 'Mod and plugin update channels',
  'Какие типы версий предлагать при поиске и обновлении модов/плагинов (Modrinth, CurseForge).':
    'Which version types to offer when searching and updating mods/plugins (Modrinth, CurseForge).',
  'Релизы': 'Releases',
  'Беты': 'Betas',
  'Альфы': 'Alphas',
  'Стабильные версии': 'Stable versions',
  'Бета-версии': 'Beta versions',
  'Альфа-версии': 'Alpha versions',
  'online-mode по умолчанию': 'Default online-mode',
  'Значение online-mode в server.properties для новых серверов. Можно изменить для каждого сервера отдельно в его настройках.':
    'The online-mode value in server.properties for new servers. Can be changed per server in its settings.',
  'Лицензия (online-mode=true)': 'Licensed (online-mode=true)',
  'Только лицензионные клиенты могут подключиться. Рекомендуется для публичных серверов.':
    'Only licensed clients can connect. Recommended for public servers.',
  'Пиратский лаунчер (online-mode=false)': 'Cracked launcher (online-mode=false)',
  'Пиратские клиенты смогут подключиться. Не используйте на публичных серверах.':
    'Cracked clients will be able to connect. Do not use on public servers.',
  'Mojang не публикует server.jar для версии {version}':
    'Mojang does not publish server.jar for version {version}',
  'NO_COMPATIBLE_FILE:Нет сборки «{name}» для Minecraft {version} ({loader})':
    'NO_COMPATIBLE_FILE:No build of “{name}” for Minecraft {version} ({loader})',
  'NO_SOURCE:Для этого файла нет данных об источнике — обновите его вручную':
    'NO_SOURCE:No source data for this file — update it manually',
  'NeoForge не поддерживает Minecraft {version}': 'NeoForge does not support Minecraft {version}',
  'NeoForge установлен, но файл запуска не найден. Проверьте вывод установщика.':
    'NeoForge is installed, but the launch file was not found. Check the installer output.',
  'Online mode включён — только лицензионные клиенты':
    'Online mode enabled — licensed clients only',
  'Online mode включён.': 'Online mode enabled.',
  'Online mode отключён — пиратские клиенты смогут подключиться':
    'Online mode disabled — pirated clients will be able to connect',
  'PORT_IN_USE:Порт {port} уже занят другим сервером':
    'PORT_IN_USE:Port {port} is already in use by another server',
  'PORT_IN_USE:Порт {port} уже занят другим сервером CraftPulse':
    'PORT_IN_USE:Port {port} is already in use by another CraftPulse server',
  'Paper, Purpur, Folia, Fabric, Forge, NeoForge, Mohist, Banner, Magma, Sponge или прокси Velocity / BungeeCord / Waterfall — выберите ядро, версию и CraftPulse установит всё сам.':
    'Paper, Purpur, Folia, Fabric, Forge, NeoForge, Mohist, Banner, Magma, Sponge, or a Velocity / BungeeCord / Waterfall proxy — pick a core and version, and CraftPulse will set up everything.',
  'Pufferfish не публикует сборки для Minecraft {version}':
    'Pufferfish does not publish builds for Minecraft {version}',
  'SpongeForge {version} не содержит версию Forge':
    'SpongeForge {version} does not include a Forge version',
  'Youer не публикует сборки для Minecraft {version}':
    'Youer does not publish builds for Minecraft {version}',
  'server-port должен быть целым числом от 1 до 65535':
    'server-port must be an integer from 1 to 65535',
  'server.properties сохранён': 'server.properties saved',
  'xterm-консоль': 'xterm console',
  '{count} ключей': '{count} keys',
  '{count} файл(ов)': '{count} file(s)',
  '{label} не вернул ссылку на сборку': '{label} did not return a build link',
  '{label} не публикует сборки для Minecraft {version}':
    '{label} does not publish builds for Minecraft {version}',
  '{label} — {size} МБ': '{label} — {size} MB',
  '{loader} не поддерживает Minecraft {version}': '{loader} does not support Minecraft {version}',
  '{loader} не публикует jar для Minecraft {version}':
    '{loader} does not publish a jar for Minecraft {version}',
  '{percent}% от Xmx': '{percent}% of Xmx',
  '{value} (текущее)': '{value} (current)',
  '«{name}» удалён': '“{name}” deleted',
  '«{name}» удалён ({count} файла)': '“{name}” deleted ({count} files)',
  '«{name}» установлен: {file}': '“{name}” installed: {file}',
  'AFK-таймаут (мин)': 'AFK timeout (min)',
  'mods/ и plugins/': 'mods/ and plugins/',
  'Скачано с Modrinth': 'Downloaded from Modrinth',
  'Скачано с CurseForge': 'Downloaded from CurseForge',
  'Добавлено пользователем': 'Added by user',
  'Аварийно снять процесс сервера (Force Kill)': 'Force-kill the server process (Force Kill)',
  'Авто · по версии Minecraft': 'Auto · by Minecraft version',
  'Авто · подобрать по версии ядра': 'Auto · match by core version',
  'Авто · последняя сборка': 'Auto · latest build',
  'Автор запретил стороннее скачивание': 'The author disabled third-party downloads',
  'Автор запретил стороннее скачивание этой версии':
    'The author disabled third-party downloads for this version',
  'Автоскачивание ядра': 'Auto-download core',
  'Актуально': 'Up to date',
  'Аптайм': 'Uptime',
  'Архив Java распакован, но исполняемый файл java не найден':
    'The Java archive was extracted, but the java executable was not found',
  'Без описания': 'No description',
  'Без проверки лицензии любой игрок сможет представиться чужим ником. Не используйте этот режим на публичном сервере.':
    'Without license verification, any player can impersonate another nickname. Do not use this mode on a public server.',
  'Белый список': 'Whitelist',
  'В папке': 'In folder',
  'Введите команду и нажмите Enter…': 'Enter a command and press Enter…',
  'Введите название сервера': 'Enter the server name',
  'Версии': 'Versions',
  'Версии и файлы: {kind} · {source} · {loader} {version}':
    'Versions and files: {kind} · {source} · {loader} {version}',
  'Версии не найдены.': 'No versions found.',
  'Версия': 'Version',
  'Версия Minecraft': 'Minecraft version',
  'Версия не совпадает с текущими Minecraft и ядром сервера':
    'The version does not match the current Minecraft and server core',
  'Версия прокси': 'Proxy version',
  'Включить RCON': 'Enable RCON',
  'Включить файл': 'Enable file',
  'Все {noun} актуальны': 'All {noun} are up to date',
  'Все изменения сохранены': 'All changes saved',
  'Все ключи файла покрыты редактором выше.': 'All file keys are covered by the editor above.',
  'Все файлы CraftPulse хранятся изолированно от других лаунчеров и Minecraft.':
    'All CraftPulse files are stored separately from other launchers and Minecraft.',
  'Вы используете пиратский лаунчер?': 'Are you using a pirated launcher?',
  'Выберите версию Minecraft': 'Select a Minecraft version',
  'Выберите версию из списка': 'Select a version from the list',
  'Выберите сервер в списке слева или создайте новый.':
    'Select a server on the left or create a new one.',
  'Выберите ядро, версию и параметры — CraftPulse скачает и настроит всё сам.':
    'Choose a core, version, and options — CraftPulse will download and configure everything.',
  'Выбранная версия не принадлежит этому проекту':
    'The selected version does not belong to this project',
  'Выбранное ядро не поддерживает моды': 'The selected core does not support mods',
  'Выбранное ядро не поддерживает плагины': 'The selected core does not support plugins',
  'Выбрано:': 'Selected:',
  'Выбрать другую версию файла': 'Choose another file version',
  'Геймплей': 'Gameplay',
  'Готово — сервер установлен': 'Done — the server is installed',
  'Да, пиратский лаунчер': 'Yes, pirated launcher',
  'Да, удалить сервер': 'Yes, delete the server',
  'Данные: {path}': 'Data: {path}',
  'Действие необратимо. Если сервер запущен, он будет принудительно остановлен.':
    'This action cannot be undone. If the server is running, it will be forcibly stopped.',
  'Для Minecraft {version} нужна Java {major} или новее.':
    'Minecraft {version} requires Java {major} or newer.',
  'Для этого ядра сборка определяется автоматически.':
    'For this core, the build is selected automatically.',
  'До 2000 символов, хранится только в CraftPulse.':
    'Up to 2000 characters, stored only in CraftPulse.',

  'Добавить': 'Add',
  'Добавить параметр': 'Add property',
  'Дополнительные параметры': 'Additional properties',
  'Доступно {count} Java: {versions}': '{count} Java runtimes available: {versions}',
  'Доступны обновления: {count}': 'Updates available: {count}',
  'Если вы играете через пиратский лаунчер, отключите online mode — иначе подключение будет отклонено.':
    'If you play through a pirated launcher, disable online mode — otherwise the connection will be rejected.',
  'Если для версии Minecraft нет подходящей JVM, CraftPulse загрузит Temurin.':
    'If no suitable JVM is available for the Minecraft version, CraftPulse will download Temurin.',
  'Есть запущенные серверы Minecraft.': 'There are running Minecraft servers.',
  'Есть несохранённые изменения': 'There are unsaved changes',
  'Журнал установки': 'Installation log',
  'Загрузка CraftPulse…': 'Loading CraftPulse…',
  'Загрузка версий {loader}…': 'Loading {loader} versions…',
  'Загрузка версий из {source}…': 'Loading versions from {source}…',
  'Загрузка каталога {source}…': 'Loading the {source} catalog…',
  'Загрузка настроек…': 'Loading settings…',
  'Загрузка списка версий…': 'Loading the version list…',
  'Закрыть': 'Close',
  'Закрыть вкладку': 'Close tab',
  'Закрыть уведомление': 'Dismiss notification',
  'Заметки': 'Notes',
  'Записывается в server-port при сохранении.': 'Written to server-port when saved.',
  'Запуск: {loader} {version}, память {min}–{max} МБ':
    'Launch: {loader} {version}, memory {min}–{max} MB',
  'Запустить': 'Start',
  'Запущенные серверы': 'Running servers',
  'Защита спавна (блоки)': 'Spawn protection (blocks)',
  'Значение -Xmx для новых серверов. Можно изменить для каждого сервера отдельно.':
    'The -Xmx value for new servers. Can be changed per server.',
  'Игроки с пиратских клиентов не смогут подключиться к серверу. Отключите проверку лицензии, если используете неофициальный лаунчер.':
    'Players with pirated clients will not be able to connect. Disable license verification if you use an unofficial launcher.',
  'Интерфейс': 'Interface',
  'История версий: обновить или откатить файл': 'Version history: update or roll back a file',
  'Источник вернул некорректную ссылку на файл': 'The source returned an invalid file link',
  'Итоговые флаги:': 'Final flags:',
  'Ключ может содержать только латиницу, цифры, точку, дефис и подчёркивание':
    'A key may contain only Latin letters, digits, a dot, a hyphen, and an underscore',
  'Ключ хранится локально в settings.json и отправляется только на api.curseforge.com.':
    'The key is stored locally in settings.json and sent only to api.curseforge.com.',
  'Ключи, которых нет в визуальном редакторе: параметры плагинов, модов и новых версий Minecraft.':
    'Keys not present in the visual editor: plugin, mod, and new Minecraft version options.',
  'Консоль': 'Console',
  'Консоль сервера (stdout/stderr). Вводите команды без слэша: stop, say hello, op Nick.':
    'Server console (stdout/stderr). Enter commands without a slash: stop, say hello, op Nick.',
  'Корень данных': 'Data root',
  'Кэш': 'Cache',
  'Кэш версий': 'Version cache',
  'Лицензия Minecraft': 'Minecraft license',
  'Лицензия и online mode': 'License and online mode',
  'Логи': 'Logs',
  'МБ': 'MB',
  'Макс. размер мира': 'Max world size',
  'Максимум · -Xmx': 'Maximum · -Xmx',
  'Максимум {memory}: 1/8 ОЗУ всегда остаётся системе.':
    'Maximum {memory}: 1/8 of RAM always stays for the system.',
  'Максимум игроков': 'Max players',
  'Максимум, МБ': 'Maximum, MB',
  'Минимальный объём памяти не может превышать максимальный':
    'Minimum memory cannot exceed the maximum',
  'Минимум · -Xms': 'Minimum · -Xms',
  'Минимум, МБ': 'Minimum, MB',
  'Мир и производительность': 'World and performance',
  'Название сервера': 'Server name',
  'Название сервера не должно превышать 64 символа':
    'The server name must not exceed 64 characters',
  'Название сервера не может быть пустым': 'The server name cannot be empty',
  'Название, заметки и сетевой порт. Изменения применяются при следующем запуске.':
    'Name, notes, and network port. Changes apply on the next start.',
  'Например, Дружеский ванильный': 'For example, Friendly Vanilla',
  'Настройки': 'Settings',
  'Настройки приложения': 'App settings',
  'Настройки сервера сохранены': 'Server settings saved',
  'Настройки сохранены': 'Settings saved',
  'Настройку можно изменить позже.': 'You can change this setting later.',
  'Настройте': 'Configure',
  'Не найден universal-jar Sponge {version}': 'Sponge universal-jar {version} not found',
  'Не удалось загрузить список серверов: {error}': 'Failed to load the server list: {error}',
  'Не удалось запустить Java: {error}': 'Failed to start Java: {error}',
  'Не удалось найти Eclipse Temurin JDK {major} для {os}/{arch}':
    'Could not find Eclipse Temurin JDK {major} for {os}/{arch}',
  'Не удалось определить Java: {error}': 'Failed to detect Java: {error}',
  'Не удалось определить версию установщика Fabric':
    'Could not determine the Fabric installer version',
  'Не удалось определить имя файла мода': 'Could not determine the mod file name',
  'Не удалось отправить команду в stdin сервера':
    'Failed to send a command to the server stdin',
  'Не удалось перезапустить: {error}': 'Failed to restart: {error}',
  'Не удалось проверить': 'Could not check',
  'Не удалось проверить файлов: {count}': 'Could not check files: {count}',
  'Не удалось прочитать папку модов: {error}': 'Failed to read the mods folder: {error}',
  'Не удалось создать уникальный идентификатор сервера':
    'Could not create a unique server identifier',
  'Недопустимый путь': 'Invalid path',
  'Неизвестно': 'Unknown',
  'Неизвестный проект PaperMC: {loader}': 'Unknown PaperMC project: {loader}',
  'Неизвестных ключей нет.': 'No unknown keys.',
  'Некорректная версия Minecraft': 'Invalid Minecraft version',
  'Некорректное имя файла': 'Invalid file name',
  'Некорректный путь к файлу мода': 'Invalid mod file path',
  'Нет, лицензия': 'No, license',
  'Ничего не найдено.': 'Nothing found.',
  'Ничего не найдено. Попробуйте изменить запрос или источник.':
    'Nothing found. Try changing the query or source.',
  'Новый сервер': 'New server',
  'О приложении': 'About',
  'Обновить': 'Update',
  'Обновить все ({count})': 'Update all ({count})',
  'Обновить все файлы, для которых найдены новые версии':
    'Update all files with new versions available',
  'Обновить до версии {version}': 'Update to version {version}',
  'Обновить список': 'Refresh list',
  'Обновить файл': 'Update file',
  'Обновлено файлов: {count}': 'Files updated: {count}',
  'Обновлено: {name}{version}': 'Updated: {name}{version}',
  'Обновлено: {updated}, ошибок: {failed} — {first}':
    'Updated: {updated}, errors: {failed} — {first}',
  'Общие параметры CraftPulse, одинаковые для всех серверов.':
    'Shared CraftPulse options that apply to all servers.',
  'Ожидание…': 'Waiting…',
  'Опасная зона': 'Danger zone',
  'Оперативная память': 'RAM',
  'Определение подходящей версии Java…': 'Detecting a suitable Java version…',
  'Основные параметры': 'Basic settings',
  'Оставьте пустым, чтобы CraftPulse выбрал свободный порт начиная с 25565.':
    'Leave empty to let CraftPulse choose a free port starting at 25565.',
  'Оставьте пустым, чтобы слушать все интерфейсы.': 'Leave empty to listen on all interfaces.',
  'Останавливается…': 'Stopping…',
  'Остановить': 'Stop',
  'Остановить и выйти': 'Stop and exit',
  'От этого зависит параметр': 'Depends on the property',
  'Отключаем…': 'Disabling…',
  'Отключить online mode': 'Disable online mode',
  'Отключить файл': 'Disable file',
  'Отключён': 'Disabled',
  'Откройте «{tab}» и установите {noun} — CraftPulse запомнит источник и версию. Вручную добавленные .jar тоже появятся здесь.':
    'Open “{tab}” and install {noun} — CraftPulse will remember the source and version. Manually added .jar files will also appear here.',
  'Открыть': 'Open',
  'Открыть Minecraft EULA в браузере': 'Open the Minecraft EULA in a browser',
  'Открыть «{name}»': 'Open “{name}”',
  'Открыть папку сервера': 'Open server folder',
  'Открыть текст EULA': 'Open EULA text',
  'Отмена': 'Cancel',
  'Отправить': 'Send',
  'Отправить stop и запустить сервер снова': 'Send stop and start the server again',
  'Отправка команды stop…': 'Sending the stop command…',
  'Официальное лицензионное соглашение Mojang, обязательное для запуска сервера.':
    'The official Mojang license agreement required to start the server.',

  'Официальное ядро Mojang не загружает сторонний контент. Создайте сервер на Fabric, Forge, NeoForge, Paper или гибридном ядре — и менеджер модов станет доступен.':
    'The official Mojang core does not download third-party content. Create a server on Fabric, Forge, NeoForge, Paper, or a hybrid core — and the mod manager will become available.',
  'Официальный файл конфигурации Minecraft. Перезапустите сервер, чтобы применить изменения.':
    'The official Minecraft configuration file. Restart the server to apply changes.',
  'Очистить': 'Clear',
  'Ошибка': 'Error',
  'Ошибка инициализации: {error}': 'Initialization error: {error}',
  'Ошибка процесса: {error}': 'Process error: {error}',
  'Ошибка: {message}': 'Error: {message}',
  'Память и сеть': 'Memory and network',
  'Память по умолчанию': 'Default memory',
  'Папка': 'Folder',
  'Папка мира': 'World folder',
  'Папка сервера': 'Server folder',
  'Параметр «{key}» уже существует': 'Property “{key}” already exists',
  'Параметры генерации и дальности прогрузки.':
    'World generation and view distance options.',
  'Пароль RCON': 'RCON password',
  'Перед запуском «{name}» нужно принять EULA Mojang.':
    'You must accept the Mojang EULA before starting “{name}”.',
  'Перезапуск сервера…': 'Restarting the server…',
  'Перезапустите сервер, чтобы применить настройку':
    'Restart the server to apply the setting',
  'Перезапустить': 'Restart',
  'Переопределить установленные Java': 'Override installed Java',
  'Перечитать': 'Reload',
  'Пиратские клиенты не смогут подключиться к серверу.':
    'Pirated clients will not be able to connect to the server.',
  'Плагины, пароли, договорённости с игроками…': 'Plugins, passwords, agreements with players…',
  'Платформа': 'Platform',
  'По умолчанию выбирается последняя стабильная сборка.':
    'The latest stable build is selected by default.',
  'Повреждённый файл конфигурации сервера: {id}': 'Corrupted server configuration file: {id}',
  'Повторить': 'Retry',
  'Подготовка Java {major}…': 'Preparing Java {major}…',
  'Подготовка «{name}» {version}…': 'Preparing “{name}” {version}…',
  'Подготовка «{name}»…': 'Preparing “{name}”…',
  'Подготовка сервера «{name}»…': 'Preparing server “{name}”…',
  'Подставляется автоматически по ядру и версии. Можно изменить — кириллица поддерживается.':
    'Filled in automatically based on the core and version. You can change it — Cyrillic is supported.',
  'Подтвердите согласие — CraftPulse запишет': 'Confirm your acceptance — CraftPulse will write',
  'Подходящая Java не найдена — CraftPulse скачает её автоматически при запуске.':
    'No suitable Java found — CraftPulse will download it automatically on start.',
  'Подходящая Java не найдена — она будет скачана автоматически.':
    'No suitable Java found — it will be downloaded automatically.',
  'Подходящая Java не найдена, а автозагрузка отключена. Установите её ниже.':
    'No suitable Java found, and auto-download is disabled. Install it below.',
  'Подходящая Java не найдена. Включите автозагрузку в настройках приложения.':
    'No suitable Java found. Enable auto-download in the app settings.',
  'Поиск Eclipse Temurin JDK {major}…': 'Searching for Eclipse Temurin JDK {major}…',
  'Поиск модов…': 'Searching for mods…',
  'Поиск плагинов…': 'Searching for plugins…',
  'Поиск сборки ArcLight…': 'Searching for an ArcLight build…',
  'Поиск серверов…': 'Searching servers…',
  'Пока нет серверов. Создайте первый — это займёт пару минут.':
    'No servers yet. Create your first one — it takes a couple of minutes.',
  'Пока ничего не установлено.': 'Nothing installed yet.',
  'Показаны только файлы, у которых совпадают версия Minecraft и загрузчик. Попробуйте другой источник, ядро или версию сервера.':
    'Only files matching the Minecraft version and loader are shown. Try another source, core, or server version.',
  'Показать ({count})': 'Show ({count})',
  'Показать ключ': 'Show key',
  'Ползунок ограничен {memory}: минимум 1/8 ОЗУ ({total}) всегда остаётся системе.':
    'The slider is capped at {memory}: at least 1/8 of RAM ({total}) always stays for the system.',
  'Получить ключ': 'Get key',
  'Порог сжатия сети': 'Network compression threshold',
  'Порт': 'Port',
  'Порт RCON': 'RCON port',
  'Порт {port} уже занят другим сервером CraftPulse':
    'Port {port} is already in use by another CraftPulse server',
  'Порт должен быть в диапазоне 1–65535': 'Port must be in the range 1–65535',
  'Порт должен быть целым числом от 1 до 65535':
    'Port must be an integer from 1 to 65535',
  'Порт сервера': 'Server port',
  'Порт, MOTD и параметры подключения игроков.':
    'Port, MOTD, and player connection options.',
  'После этого сервер можно запускать без дополнительных подтверждений.':
    'After that, the server can be started without additional confirmations.',
  'Последняя сборка': 'Latest build',
  'При выходе все Java-процессы будут принудительно завершены. Несохранённый прогресс мира может быть потерян.':
    'On exit, all Java processes will be forcibly terminated. Unsaved world progress may be lost.',
  'Привязать к IP': 'Bind to IP',
  'Применяется после сохранения и сразу переключает весь интерфейс.':
    'Applies after saving and switches the entire interface immediately.',
  'Применяется сразу и сохраняется в настройках приложения.':
    'Applies immediately and is saved in the app settings.',
  'Принудительный режим': 'Forced mode',
  'Принять EULA': 'Accept EULA',
  'Принять и запустить': 'Accept and start',
  'Проект': 'Project',
  'Проверить обновления': 'Check for updates',
  'Проверка лицензии Mojang. Отключайте только для пиратских клиентов.':
    'Mojang license verification. Disable only for pirated clients.',
  'Проверка лицензии Mojang. Отключение опасно для публичного сервера.':
    'Mojang license verification. Disabling is dangerous for a public server.',
  'Проверять лицензию игроков': 'Verify player licenses',
  'Прокси не использует server.properties': 'The proxy does not use server.properties',
  'Прокси не проверяет лицензию игроков — этот параметр задаётся на backend-серверах сети.':
    'The proxy does not verify player licenses — this setting is configured on the network\'s backend servers.',
  'Прокси не проверяет лицензию игроков: online-mode настраивается на backend-серверах сети, а не на прокси.':
    'The proxy does not verify player licenses: online-mode is configured on the network\'s backend servers, not on the proxy.',
  'Процесс завершился с кодом {code}': 'The process exited with code {code}',
  'Прочитайте текст лицензии на официальном сайте Mojang.':
    'Read the license text on the official Mojang website.',
  'Пустые значения записываются как есть — проверяйте синтаксис.':
    'Empty values are written as-is — check the syntax.',
  'Пути данных': 'Data paths',
  'Пути данных, Java, память по умолчанию и интеграции.':
    'Data paths, Java, default memory, and integrations.',
  'Путь не существует': 'Path does not exist',
  'Разработчик': 'Developer',
  'Разработчик: Kurw1k': 'Developer: Kurw1k',
  'Разрешает вход только игрокам из whitelist.json.':
    'Allows only players from whitelist.json to join.',
  'Разрешены только http(s)-ссылки': 'Only http(s) links are allowed',
  'Разрешить Нижний мир': 'Allow the Nether',
  'Разрешить полёт': 'Allow flight',
  'Распаковка архива…': 'Extracting the archive…',
  'Рекомендуется {memory} — 25% от {total} ОЗУ.':
    'Recommended: {memory} — 25% of {total} RAM.',
  'Режим игры': 'Game mode',
  'Режим игры, сложность и правила выживания.':
    'Game mode, difficulty, and survival rules.',
  'Релиз: {date}': 'Release: {date}',
  'Сборка {label} {version} не найдена': 'Build {label} {version} not found',
  'Сборка ядра': 'Core build',
  'Сбросить': 'Reset',
  'Свернуть': 'Collapse',
  'Сервер Minecraft распространяется по лицензии Mojang. Приняв соглашение, вы подтверждаете, что ознакомились с его условиями и согласны с ними.':
    'Minecraft server software is distributed under the Mojang license. By accepting the agreement, you confirm that you have read its terms and agree to them.',
  'Сервер «{name}» готов': 'Server “{name}” is ready',
  'Сервер «{name}» запущен': 'Server “{name}” started',
  'Сервер «{name}» удалён': 'Server “{name}” deleted',
  'Сервер аварийно завершился{suffix}': 'The server crashed{suffix}',
  'Сервер готов к запуску': 'The server is ready to start',
  'Сервер запущен. Большинство параметров server.properties применяются только после перезапуска.':
    'The server is running. Most server.properties settings apply only after a restart.',
  'Сервер не выбран': 'No server selected',
  'Сервер не запущен': 'The server is not running',
  'Сервер не остановился за 20 секунд — принудительное завершение':
    'The server did not stop within 20 seconds — forced termination',
  'Сервер останавливается…': 'The server is stopping…',
  'Сервер остановлен — запустите его': 'The server is stopped — start it',
  'Сервер остановлен{suffix}': 'The server has stopped{suffix}',
  'Сервер перезапустится сразу после запуска…':
    'The server will restart right after startup…',
  'Сервер принимает клиенты без лицензии. Любой игрок может выдать себя за другого.':
    'The server accepts clients without a license. Any player can impersonate another.',
  'Сервер удалён': 'Server deleted',
  'Серверы': 'Servers',
  'Серверы · {count}': 'Servers · {count}',
  'Сеть и доступ': 'Network and access',
  'Сид мира': 'World seed',
  'Сильнее всего влияет на нагрузку и трафик.': 'Affects load and traffic the most.',
  'Скачанная Java не запускается — проверьте архив или права доступа':
    'The downloaded Java does not start — check the archive or access permissions',
  'Скачивание ArcLight {version}': 'Downloading ArcLight {version}',
  'Скачивание Canvas #{build} ({version})': 'Downloading Canvas #{build} ({version})',
  'Скачивание Fabric {version}': 'Downloading Fabric {version}',
  'Скачивание Forge {version}': 'Downloading Forge {version}',
  'Скачивание Forge {version}…': 'Downloading Forge {version}…',
  'Скачивание Magma {version}': 'Downloading Magma {version}',
  'Скачивание NeoForge {version}': 'Downloading NeoForge {version}',
  'Скачивание Pufferfish #{build} ({version})':
    'Downloading Pufferfish #{build} ({version})',
  'Скачивание Purpur {build}': 'Downloading Purpur {build}',
  'Скачивание SpongeForge {version}': 'Downloading SpongeForge {version}',
  'Скачивание SpongeVanilla {version}': 'Downloading SpongeVanilla {version}',
  'Скачивание Vanilla server.jar': 'Downloading Vanilla server.jar',
  'Скачивание Youer #{build}{neoforge}': 'Downloading Youer #{build}{neoforge}',
  'Скачивание {file}: {size} МБ': 'Downloading {file}: {size} MB',
  'Скачивание {file}…': 'Downloading {file}…',
  'Скачивание {label} #{build}': 'Downloading {label} #{build}',
  'Скачивание {label} {version}': 'Downloading {label} {version}',
  'Скачивание последней сборки BungeeCord': 'Downloading the latest BungeeCord build',
  'Скачивать Java автоматически': 'Download Java automatically',
  'Скрыто ключей: {count}. Разверните, чтобы редактировать любые параметры вручную.':
    'Hidden keys: {count}. Expand to edit any properties manually.',
  'Скрыть ключ': 'Hide key',
  'Сложность': 'Difficulty',
  'Снять процесс': 'Kill process',
  'Соберите свой Minecraft-сервер': 'Build your own Minecraft server',
  'Совместимых версий для {loader} {version} не найдено':
    'No compatible versions found for {loader} {version}',
  'Совместимых версий: {count} · показаны только файлы для {loader} {version}':
    'Compatible versions: {count} · only files for {loader} {version} are shown',
  'Совместимых файлов нет': 'No compatible files',
  'Создание «{name}» · {loader} {version}…': 'Creating “{name}” · {loader} {version}…',
  'Создать сервер': 'Create server',
  'Сохранение…': 'Saving…',
  'Сохранить': 'Save',
  'Сохранить настройки': 'Save settings',
  'Сохранить файл': 'Save file',
  'Спавн NPC': 'NPC spawning',
  'Спавн животных': 'Animal spawning',
  'Спавн монстров': 'Monster spawning',
  'Список загружен из официальных API · {count} версий':
    'List loaded from official APIs · {count} versions',
  'Список сборок загрузится после выбора версии.':
    'The build list will load after you select a version.',
  'Среда выполнения': 'Runtime',
  'Среда выполнения Java': 'Java runtime',
  'Среда выполнения для серверного ядра.': 'Runtime for the server core.',
  'Строгий whitelist': 'Strict whitelist',
  'Структуры': 'Structures',
  'Текущая версия': 'Current version',
  'Текущий · {path}': 'Current · {path}',
  'Текущий путь · {path}': 'Current path · {path}',
  'Тип мира': 'World type',
  'Только релизы': 'Releases only',
  'У выбранной версии нет доступного файла для скачивания':
    'The selected version has no file available for download',
  'У проекта нет доступного файла для скачивания':
    'The project has no file available for download',
  'Удаление стирает папку сервера: мир, конфигурации, моды и логи CraftPulse для этого сервера.':
    'Deletion erases the server folder: the world, configs, mods, and CraftPulse logs for this server.',
  'Удалить': 'Delete',
  'Удалить «{name}» навсегда?': 'Delete “{name}” permanently?',
  'Удалить сервер': 'Delete server',
  'Удалить файл': 'Delete file',
  'Укажите название сервера': 'Enter the server name',
  'Устанавливаем…': 'Installing…',
  'Установите Java {major} через настройки приложения или разрешите автозагрузку. Иначе создание сервера завершится ошибкой JAVA_REQUIRED.':
    'Install Java {major} via the app settings or enable auto-download. Otherwise server creation will fail with error JAVA_REQUIRED.',
  'Установить': 'Install',
  'Установить Temurin JDK': 'Install Temurin JDK',
  'Установить выбранную': 'Install selected',
  'Установить заново': 'Reinstall',
  'Установка Forge (может занять несколько минут)…':
    'Installing Forge (may take a few minutes)…',
  'Установка NeoForge (может занять несколько минут)…':
    'Installing NeoForge (may take a few minutes)…',
  'Установка…': 'Installing…',
  'Установленные файлы появятся здесь для Fabric, Forge, NeoForge, Paper, гибридных ядер и прокси. Для Vanilla сторонний контент не загружается.':
    'Installed files will appear here for Fabric, Forge, NeoForge, Paper, hybrid cores, and proxies. Vanilla does not download third-party content.',
  'Установлено': 'Installed',
  'Установлено: «{name}» {version} ({file})':
    'Installed: “{name}” {version} ({file})',
  'Установщик завершился с кодом {code}.\n{tail}':
    'The installer exited with code {code}.\n{tail}',
  'Файл {file} включён': 'File {file} enabled',
  'Файл {file} не найден': 'File {file} not found',
  'Файл {file} отключён — сервер не будет его загружать':
    'File {file} disabled — the server will not load it',
  'Файл {file} удалён': 'File {file} deleted',
  'Файл {file} уже существует': 'File {file} already exists',
  'Файл {file} уже существует — удалите дубликат':
    'File {file} already exists — delete the duplicate',
  'Файл добавлен вручную — нет данных об источнике':
    'File added manually — no source data',
  'Файл запуска не найден: {file}. Переустановите ядро сервера.':
    'Launch file not found: {file}. Reinstall the server core.',
  'Файл конфигурации сервера не найден: {id}':
    'Server configuration file not found: {id}',
  'Файлы скачиваются с Modrinth и сразу попадают в папку сервера.':
    'Files are downloaded from Modrinth and go straight into the server folder.',
  'Флаги -Xms и -Xmx для JVM. Не выделяйте больше, чем позволяет свободная RAM.':
    '-Xms and -Xmx flags for the JVM. Do not allocate more than free RAM allows.',
  'Чтение server.properties…': 'Reading server.properties…',
  'Чтение {folders}…': 'Reading {folders}…',
  'Это ядро не поддерживает моды и плагины':
    'This core does not support mods and plugins',
  'Я прочитал(а) и принимаю Minecraft End User License Agreement, а также подтверждаю, что несу ответственность за работу этого сервера.':
    'I have read and accept the Minecraft End User License Agreement, and I confirm that I am responsible for running this server.',
  'Ядро сервера': 'Server core',
  'Язык': 'Language',
  'Язык интерфейса': 'Interface language',
  'авто': 'auto',
  'без модов': 'without mods',
  'без ограничений': 'unlimited',
  'в eula.txt.': 'in eula.txt.',
  'в server.properties каждого сервера, к которому подключается прокси.':
    'in each server\'s server.properties that the proxy connects to.',
  'версия неизвестна': 'version unknown',
  'выбрана Java {major}': 'Java {major} selected',
  'дата неизвестна': 'date unknown',
  'доступна v{version}': 'v{version} available',
  'другая версия': 'another version',
  'другие версии': 'other versions',
  'значение': 'value',
  'ключ': 'key',
  'моды + плагины': 'mods + plugins',
  'не для текущего сервера': 'not for the current server',
  'не принят': 'not accepted',
  'не сохранено': 'not saved',
  'недоступно': 'unavailable',
  'нужна Java {major}': 'requires Java {major}',
  'порт :{port}': 'port :{port}',
  'принят': 'accepted',
  'секрет': 'secret',
  'синхронизировано': 'synced',
  'система': 'system',
  'случайный': 'random',
  'создан {date}': 'created {date}',
  'уже установлено': 'already installed',
  'файл не указан': 'file not specified',
  '— пиратские клиенты смогут подключиться.':
    '— pirated clients will be able to connect.',
  '— подключаются только лицензионные клиенты.':
    '— only licensed clients can connect.'
}

/** Английские переводы для проверки покрытия (используется в тестах/скриптах). */
export const ENGLISH_DICTIONARY: Readonly<Record<string, string>> = EN

export function translate(
  language: Language,
  message: string,
  params?: Record<string, string | number>
): string {
  const template = language === 'ru' ? message : EN[message] ?? message
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  )
}
