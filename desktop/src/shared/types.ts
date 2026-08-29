export interface DeviceConnection {
  id: string;
  label?: string;          // e.g. "Management", "OOB"
  type: 'ssh' | 'telnet' | 'serial';
  isDefault: boolean;

  // SSH & Telnet
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  authType?: 'password' | 'key';
  privateKey?: string;

  // Serial only
  path?: string;           // COM port or /dev/tty*
  baudRate?: number;
}

export interface DeviceConfig {
  id: string;
  name: string;
  connections: DeviceConnection[];

  // LibreNMS snapshot stored in Firestore for LLM context
  librenms?: {
    device_id: number;
    hostname: string;
    sysName?: string;
    sysDescr?: string;
    hardware?: string;
    os?: string;
    icon?: string;
  };
}
