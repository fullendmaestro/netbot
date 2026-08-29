# Netbot Desktop App

The frontend application for Netbot, built with Electron, React, TypeScript, and TailwindCSS.

## Overview

The desktop app serves two primary purposes:
1. **User Interface**: Provides the chat interface to interact with the Netbot AI assistant and view managed devices.
2. **Terminal Manager**: Maintains physical and network connectivity (Serial, SSH, Telnet) for manual interactions with your infrastructure devices from your local machine.

The desktop app communicates with the Python agent via API endpoints to proxy LibreNMS monitoring data and orchestrate device registration. Unlike earlier versions, the desktop app does *not* execute commands on behalf of the agent; the agent connects to devices directly.

## Tech Stack
- Electron
- React (via Vite)
- TailwindCSS
- Firebase Firestore (for syncing state with the Python agent)
- xterm.js (for terminal rendering)

## Setup and Development

### Install Dependencies

```bash
bun install
```

### Start Development Server

```bash
bun run dev
```

### Build for Production

```bash
# For Windows
bun run build:win

# For macOS
bun run build:mac

# For Linux
bun run build:linux
```
