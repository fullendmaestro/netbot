export interface DeviceConfig {
  id: string; // we'll use string ids (UUID) going forward
  name: string;
  type: 'ssh' | 'serial';
  connectionStatus: 'Connected' | 'Offline' | 'Connecting';
  
  // SSH fields
  host?: string;
  port?: number;
  username?: string;
  authType?: 'password' | 'key';
  password?: string;
  privateKey?: string;

  // Serial fields
  path?: string; // COM port or /dev/tty*
  baudRate?: number;
}
