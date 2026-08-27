# Netbot Desktop App

The frontend application for Netbot, built with Electron, React, TypeScript, and TailwindCSS.

## Overview

The desktop app serves two primary purposes:
1. **User Interface**: Provides the chat interface to interact with the Netbot AI assistant and view managed devices.
2. **Local Execution Engine**: Maintains physical and network connectivity (Serial, SSH, Telnet) to your infrastructure devices from your local machine.

When the agent needs to execute a command on a device, it writes the command to a Firebase Firestore database. The desktop app continuously listens to this database, securely executes the requested command on the target device via the user's local network/hardware, and returns the output to Firestore for the agent to process.

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
