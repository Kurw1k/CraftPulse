# CraftPulse

Cross-platform Minecraft server launcher (Windows / Linux / macOS) built with Electron, TypeScript, React and Vite.

**Developer: Kurw1k**

![status](https://img.shields.io/badge/status-early%20preview-4ade80)

## Features

- **21 server/proxy loaders**: Vanilla, Paper, Purpur, Folia, Spigot, CraftBukkit, Pufferfish, Canvas, Fabric, Forge, NeoForge, ArcLight, Mohist, Banner, Youer, Magma, SpongeVanilla, SpongeForge, Velocity, BungeeCord, Waterfall.
- **Dynamic version lists** from official APIs (Mojang, PaperMC, Purpur, GetBukkit, Jenkins, Fabric Meta, Forge/NeoForge, Mojang CI, Sponge, etc.). Manual refresh supported.
- **Hybrid cores** (Youer: NeoForge + Paper) support both `mods/` and `plugins/` with direct API downloads.
- **One-click installation**: downloads loader, runs `--installServer`, inserts jar into `mods/`. Proxies skip EULA and `server.properties`.
- **Online mode toggle**: "Licensed / Cracked launcher" at server creation, global setting in App Settings, quick disable in server header.
- **One-click restart**: green button sends `stop` and auto-starts after process exit.
- **Java runtime management**: finds system JVMs, downloads Eclipse Temurin JDK 8/17/21/25 into isolated `runtimes/`, auto-selects by Minecraft version.
- **Console** (xterm.js) with ANSI colors, command history, stdin, scrollback preserved across server switches.
- **Real-time metrics** (CPU / RAM / uptime) with sparklines.
- **Modrinth & CurseForge tabs**: tabs adapt to loader (Plugins / Installed Plugins for Paper/Spigot/…, Mods / Installed Mods for Fabric/Forge/NeoForge, Add-ons / Installed for hybrid). Hidden for Vanilla/proxies.
- **Version picker**: strictly filters by Minecraft version and loader; shows warning if none compatible.
- **Installed files list**: all `.jar` files with version, size, date, source, enable/disable (`.jar` ↔ `.jar.disabled`), delete, "Versions" for history/rollback, and bulk update with outdated-file highlighting + "Update all" button.
- **Process kill**: semi-transparent ghost button on second layer, red on hover.
- **server.properties editor**: visual sections + raw editor.
- **EULA**: confirmation at creation and start, auto-writes `eula=true`.
- **Isolated data**: `%APPDATA%/CraftPulse` on Windows, `~/.config/CraftPulse` on Linux/macOS.
- **Release channels**: global checkbox settings (Releases / Betas / Alphas) filter Modrinth/CurseForge search and update checks.

## Stack

| Layer | Technologies |
|-------|-------------|
| Shell / Main | Electron, TypeScript, Node.js |
| Renderer | React, Vite, Tailwind CSS (via shadcn/ui) |
| Console | @xterm/xterm, @xterm/addon-fit |
| APIs | Modrinth v2, CurseForge v1, Mojang, PaperMC, Fabric Meta, Forge/NeoForge Maven |

## Build

```bash
npm ci
npm run build        # build renderer + main bundles
npm run dist:win     # Windows NSIS installer (.exe)
npm run dist:linux   # Linux AppImage + .deb
npm run dist        # all platforms (win/linux/mac)
```

The `release/` folder contains built artifacts.

## License

MIT — Copyright © 2026 Kurw1k
