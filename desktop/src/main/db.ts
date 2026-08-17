import { Database } from "bun:sqlite";
import { app } from "electron";
import { join } from "path";
import type { DeviceConfig } from "../shared/types";

// Get user data path for the database
const dbPath = join(app.getPath("userData"), "netbot_devices.sqlite");

export class DeviceDatabase {
  private db: Database;

  constructor() {
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.run(`
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
    const rows = this.db.query("SELECT * FROM devices").all() as any[];
    return rows.map(row => ({
      ...row,
      connectionStatus: 'Offline' // Default status when loaded
    }));
  }

  addDevice(device: DeviceConfig) {
    const query = this.db.prepare(`
      INSERT INTO devices (id, name, type, host, port, username, authType, password, privateKey, path, baudRate)
      VALUES ($id, $name, $type, $host, $port, $username, $authType, $password, $privateKey, $path, $baudRate)
    `);
    query.run({
      $id: device.id,
      $name: device.name,
      $type: device.type,
      $host: device.host || null,
      $port: device.port || null,
      $username: device.username || null,
      $authType: device.authType || null,
      $password: device.password || null,
      $privateKey: device.privateKey || null,
      $path: device.path || null,
      $baudRate: device.baudRate || null,
    });
  }

  removeDevice(id: string) {
    this.db.run("DELETE FROM devices WHERE id = ?", [id]);
  }
}
