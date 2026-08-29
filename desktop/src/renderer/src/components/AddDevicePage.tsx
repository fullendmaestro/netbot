import * as React from 'react';
import { ArrowLeftIcon, PlusIcon, Trash2Icon, WifiIcon, TerminalSquareIcon } from 'lucide-react';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

const AGENT_URL = 'http://localhost:8000';

type ConnectionType = 'ssh' | 'telnet' | 'serial';

interface ConnectionForm {
  id: string;
  label: string;
  type: ConnectionType;
  host: string;
  port: string;
  username: string;
  password: string;
  path: string;
  baudRate: string;
  isDefault: boolean;
}

function newConnection(type: ConnectionType = 'ssh', isDefault = false): ConnectionForm {
  return {
    id: crypto.randomUUID(),
    label: '',
    type,
    host: '',
    port: type === 'ssh' ? '22' : type === 'telnet' ? '23' : '',
    username: '',
    password: '',
    path: '',
    baudRate: '9600',
    isDefault,
  };
}

export function AddDevicePage() {
  const { setAddDeviceOpen, selectedProject } = useStore();

  // LibreNMS registration fields
  const [displayName, setDisplayName] = React.useState('');
  const [hostname, setHostname] = React.useState('');
  const [snmpver, setSnmpver] = React.useState<'v1' | 'v2c' | 'v3'>('v2c');
  const [community, setCommunity] = React.useState('');
  const [authlevel, setAuthlevel] = React.useState('');
  const [authname, setAuthname] = React.useState('');
  const [authpass, setAuthpass] = React.useState('');
  const [authalgo, setAuthalgo] = React.useState('MD5');
  const [cryptopass, setCryptopass] = React.useState('');
  const [cryptoalgo, setCryptoalgo] = React.useState('AES');

  // Connection channels
  const [connections, setConnections] = React.useState<ConnectionForm[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  const addConnection = (type: ConnectionType) => {
    const isFirstNetwork = connections.filter(c => c.type !== 'serial').length === 0 && type !== 'serial';
    setConnections(prev => [...prev, newConnection(type, isFirstNetwork)]);
  };

  const removeConnection = (id: string) => {
    setConnections(prev => {
      const filtered = prev.filter(c => c.id !== id);
      // If we removed the default, mark first remaining as default
      if (!filtered.some(c => c.isDefault) && filtered.length > 0) {
        filtered[0].isDefault = true;
      }
      return filtered;
    });
  };

  const updateConnection = (id: string, field: keyof ConnectionForm, value: string | boolean) => {
    setConnections(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [field]: value };
      // Auto-update port when type changes
      if (field === 'type') {
        if (value === 'ssh') updated.port = '22';
        else if (value === 'telnet') updated.port = '23';
        else updated.port = '';
      }
      return updated;
    }));
  };

  const setDefault = (id: string) => {
    setConnections(prev => prev.map(c => ({ ...c, isDefault: c.id === id })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostname.trim()) {
      toast.error('Hostname / IP is required.');
      return;
    }
    if (!selectedProject) {
      toast.error('No active project selected.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        netbotProjectId: selectedProject,
        hostname: hostname.trim(),
        name: displayName.trim() || undefined,
        snmpver,
        connections: connections.map(c => ({
          id: c.id,
          label: c.label || undefined,
          type: c.type,
          isDefault: c.isDefault,
          host: c.host || undefined,
          port: c.port ? parseInt(c.port, 10) : undefined,
          username: c.username || undefined,
          password: c.password || undefined,
          path: c.path || undefined,
          baudRate: c.baudRate ? parseInt(c.baudRate, 10) : undefined,
        })),
      };

      if (snmpver === 'v1' || snmpver === 'v2c') {
        payload.community = community;
      } else {
        payload.authlevel = authlevel;
        payload.authname = authname;
        payload.authpass = authpass;
        payload.authalgo = authalgo;
        payload.cryptopass = cryptopass;
        payload.cryptoalgo = cryptoalgo;
      }

      // Get Firebase auth token
      // @ts-ignore
      const token = await window.api.getAuthToken?.() ?? '';

      const resp = await fetch(`${AGENT_URL}/api/librenms/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Server error (${resp.status})`);
      }

      toast.success('Device added successfully!');
      setAddDeviceOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to add device.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setAddDeviceOpen(false)}>
          <ArrowLeftIcon className="size-5" />
          <span className="sr-only">Back</span>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Add Device</h1>
          <p className="text-sm text-muted-foreground">Register a device with LibreNMS and configure its connection channels.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-8">

          {/* Section 1: LibreNMS Registration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <WifiIcon className="size-4" />
                LibreNMS Registration
              </CardTitle>
              <CardDescription>
                SNMP credentials are used to register the device with LibreNMS for monitoring.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="hostname">Hostname / IP <span className="text-destructive">*</span></Label>
                  <Input
                    id="hostname"
                    placeholder="192.168.1.1"
                    value={hostname}
                    onChange={e => setHostname(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Display Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="displayName"
                    placeholder="Core Router"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>SNMP Version</Label>
                <Select value={snmpver} onValueChange={(v: any) => setSnmpver(v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v1">v1</SelectItem>
                    <SelectItem value="v2c">v2c</SelectItem>
                    <SelectItem value="v3">v3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(snmpver === 'v1' || snmpver === 'v2c') && (
                <div className="space-y-1.5">
                  <Label htmlFor="community">Community String</Label>
                  <Input
                    id="community"
                    placeholder="public"
                    value={community}
                    onChange={e => setCommunity(e.target.value)}
                  />
                </div>
              )}

              {snmpver === 'v3' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Auth Level</Label>
                    <Select value={authlevel} onValueChange={setAuthlevel}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="noAuthNoPriv">noAuthNoPriv</SelectItem>
                        <SelectItem value="authNoPriv">authNoPriv</SelectItem>
                        <SelectItem value="authPriv">authPriv</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="authname">Auth Username</Label>
                    <Input id="authname" value={authname} onChange={e => setAuthname(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="authpass">Auth Password</Label>
                    <Input id="authpass" type="password" value={authpass} onChange={e => setAuthpass(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Auth Algorithm</Label>
                    <Select value={authalgo} onValueChange={setAuthalgo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MD5">MD5</SelectItem>
                        <SelectItem value="SHA">SHA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cryptopass">Crypto Password</Label>
                    <Input id="cryptopass" type="password" value={cryptopass} onChange={e => setCryptopass(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Crypto Algorithm</Label>
                    <Select value={cryptoalgo} onValueChange={setCryptoalgo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AES">AES</SelectItem>
                        <SelectItem value="DES">DES</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Connection Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TerminalSquareIcon className="size-4" />
                Connection Channels
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </CardTitle>
              <CardDescription>
                Add one or more connection channels. The default channel is used by the AI agent for command execution.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {connections.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No connections added. Add SSH or Telnet for agent access.
                </p>
              )}

              {connections.map((conn, idx) => (
                <div key={conn.id} className="relative border rounded-lg p-4 flex flex-col gap-3 bg-muted/30">
                  {/* Connection header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Select
                        value={conn.type}
                        onValueChange={v => updateConnection(conn.id, 'type', v)}
                      >
                        <SelectTrigger className="w-28 h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ssh">SSH</SelectItem>
                          <SelectItem value="telnet">Telnet</SelectItem>
                          <SelectItem value="serial">Serial</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-7 w-40 text-xs"
                        placeholder="Label (e.g. Management)"
                        value={conn.label}
                        onChange={e => updateConnection(conn.id, 'label', e.target.value)}
                      />
                      {conn.isDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!conn.isDefault && conn.type !== 'serial' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setDefault(conn.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeConnection(conn.id)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* SSH / Telnet fields */}
                  {conn.type !== 'serial' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Host / IP</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="192.168.1.1"
                          value={conn.host}
                          onChange={e => updateConnection(conn.id, 'host', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Port</Label>
                        <Input
                          className="h-8 text-sm"
                          type="number"
                          value={conn.port}
                          onChange={e => updateConnection(conn.id, 'port', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Username</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="admin"
                          value={conn.username}
                          onChange={e => updateConnection(conn.id, 'username', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Password</Label>
                        <Input
                          className="h-8 text-sm"
                          type="password"
                          value={conn.password}
                          onChange={e => updateConnection(conn.id, 'password', e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Serial fields */}
                  {conn.type === 'serial' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Serial Path / Port</Label>
                        <Input
                          className="h-8 text-sm"
                          placeholder="COM3 or /dev/ttyUSB0"
                          value={conn.path}
                          onChange={e => updateConnection(conn.id, 'path', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Baud Rate</Label>
                        <Select value={conn.baudRate} onValueChange={v => updateConnection(conn.id, 'baudRate', v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['9600', '19200', '38400', '57600', '115200'].map(b => (
                              <SelectItem key={b} value={b}>{b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add connection buttons */}
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => addConnection('ssh')}>
                  <PlusIcon className="size-3.5 mr-1" />SSH
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addConnection('telnet')}>
                  <PlusIcon className="size-3.5 mr-1" />Telnet
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addConnection('serial')}>
                  <PlusIcon className="size-3.5 mr-1" />Serial
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <Button type="button" variant="outline" onClick={() => setAddDeviceOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding Device...' : 'Add Device'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
