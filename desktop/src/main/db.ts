import { DatabaseSync } from "node:sqlite";
import { app } from "electron";
import { join } from "path";
import type { DeviceConfig } from "../shared/types";

// Get user data path for the database
const dbPath = join(app.getPath("userData"), "netbot_devices.sqlite");

export class DeviceDatabase {
  private db: DatabaseSync;

  constructor() {
    this.db = new DatabaseSync(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        host TEXT,
        port INTEGER,
        username TEXT,
        authType TEXT,
        password TEXT,
        privateKey TEXT,
        path TEXT,
        baudRate INTEGER
      )
    `);
  }

  getDevices(): DeviceConfig[] {
    const query = this.db.prepare("SELECT * FROM devices");
    const rows = query.all() as any[];
    return rows.map(row => ({
      ...row,
      connectionStatus: 'Offline' // Default status when loaded
    }));
  }

  addDevice(device: DeviceConfig) {
    const query = this.db.prepare(`
      INSERT INTO devices (id, name, type, host, port, username, authType, password, privateKey, path, baudRate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    query.run(
      device.id,
      device.name,
      device.type,
      device.host || null,
      device.port || null,
      device.username || null,
      device.authType || null,
      device.password || null,
      device.privateKey || null,
      device.path || null,
      device.baudRate || null
    );
  }

  removeDevice(id: string) {
    const query = this.db.prepare("DELETE FROM devices WHERE id = ?");
    query.run(id);
  }
}
