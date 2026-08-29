import * as React from 'react';
import { ArrowLeftIcon, ServerIcon, NetworkIcon, BellIcon } from 'lucide-react';
import { useStore } from '../store';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const AGENT_URL = import.meta.env.VITE_AGENT_URL;
import { auth } from '../firebase';

async function fetchProxy(path: string): Promise<any> {
  const token = await auth.currentUser?.getIdToken() ?? '';
  const resp = await fetch(`${AGENT_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error(`Request failed (${resp.status})`);
  return resp.json();
}

function useTabData<T>(hostname: string | undefined, path: string, enabled: boolean) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled || !hostname) return;
    setLoading(true);
    setError(null);
    fetchProxy(`/api/librenms/devices/${encodeURIComponent(hostname)}${path}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [hostname, path, enabled]);

  return { data, loading, error };
}

function LoadingRows({ cols }: { cols: number }) {
  return (
    <>
      {[...Array(3)].map((_, i) => (
        <TableRow key={i}>
          {[...Array(cols)].map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ──────────────── Overview Tab ────────────────
function OverviewTab({ hostname }: { hostname: string }) {
  const { data, loading, error } = useTabData<any>(hostname, '/overview', true);

  const device = data?.devices?.[0];

  if (loading) return (
    <div className="flex flex-col gap-3">
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
    </div>
  );

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!device) return <p className="text-sm text-muted-foreground">No data available.</p>;

  const rows: [string, any][] = [
    ['Hostname', device.hostname],
    ['System Name', device.sysName],
    ['OS', device.os],
    ['Hardware', device.hardware],
    ['Version', device.version],
    ['SNMP Version', device.snmpver],
    ['Uptime', device.uptime != null ? `${Math.floor(device.uptime / 86400)}d ${Math.floor((device.uptime % 86400) / 3600)}h` : '-'],
    ['Last Polled', device.last_polled ? new Date(device.last_polled).toLocaleString() : '-'],
    ['Status', device.status ? 'Up' : 'Down'],
    ['Status Reason', device.status_reason || '-'],
    ['Location', device.location || '-'],
    ['Serial', device.serial || '-'],
    ['Description', device.sysDescr || '-'],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ServerIcon className="size-4" /> Device Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableBody>
            {rows.map(([label, value]) => (
              <TableRow key={label}>
                <TableCell className="font-medium text-muted-foreground w-40">{label}</TableCell>
                <TableCell>
                  {label === 'Status'
                    ? <Badge variant={value === 'Up' ? 'default' : 'destructive'}>{value}</Badge>
                    : String(value ?? '-')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ──────────────── Ports Tab ────────────────
function PortsTab({ hostname }: { hostname: string }) {
  const { data, loading, error } = useTabData<any>(hostname, '/ports', true);

  const ports: any[] = data?.ports ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <NetworkIcon className="size-4" /> Ports
        </CardTitle>
        <CardDescription>{ports.length} port{ports.length !== 1 ? 's' : ''} found</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <p className="text-sm text-destructive p-4">{error}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Speed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <LoadingRows cols={4} /> : ports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">No ports found.</TableCell>
                </TableRow>
              ) : ports.map((p: any) => (
                <TableRow key={p.port_id}>
                  <TableCell className="font-mono text-sm">{p.ifName || p.ifDescr}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.ifAlias || '-'}</TableCell>
                  <TableCell className="text-sm">{p.ifSpeed ? `${(p.ifSpeed / 1e6).toFixed(0)} Mbps` : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={p.ifOperStatus === 'up' ? 'default' : 'secondary'}>
                      {p.ifOperStatus ?? '-'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────── Alerts Tab ────────────────
function AlertsTab({ hostname }: { hostname: string }) {
  const { data, loading, error } = useTabData<any>(hostname, '/alerts', true);

  const alerts: any[] = data?.alerts ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BellIcon className="size-4" /> Active Alerts
        </CardTitle>
        <CardDescription>{alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <p className="text-sm text-destructive p-4">{error}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Since</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <LoadingRows cols={4} /> : alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">No active alerts.</TableCell>
                </TableRow>
              ) : alerts.map((a: any, i: number) => (
                <TableRow key={a.id ?? i}>
                  <TableCell className="font-medium text-sm">{a.name}</TableCell>
                  <TableCell>
                    <Badge variant={a.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {a.severity ?? 'unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.alert_since ? new Date(a.alert_since).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.note || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────── Root component ────────────────
export function DeviceDetail() {
  const { selectedDevice, setSelectedDevice } = useStore();

  if (!selectedDevice) return null;

  const hostname = selectedDevice.librenms?.hostname;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-4 p-4 lg:p-6 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDevice(null)}>
          <ArrowLeftIcon className="size-5" />
          <span className="sr-only">Back</span>
        </Button>
        <div className="flex items-center gap-3">
          {selectedDevice.librenms?.icon && (
            <img
              src={`${AGENT_URL.replace('8000', '80')}/${selectedDevice.librenms.icon}`}
              alt="device icon"
              className="size-6 object-contain"
              onError={e => (e.currentTarget.style.display = 'none')}
            />
          )}
          <div>
            <h1 className="text-xl font-bold leading-tight">{selectedDevice.name}</h1>
            {hostname && <p className="text-sm text-muted-foreground">{hostname}</p>}
          </div>
          {selectedDevice.librenms?.os && (
            <Badge variant="outline" className="uppercase text-xs">{selectedDevice.librenms.os}</Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {!hostname ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              This device is not linked to LibreNMS. Re-add it via the Add Device page to enable monitoring data.
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ports">Ports</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <OverviewTab hostname={hostname} />
            </TabsContent>
            <TabsContent value="ports">
              <PortsTab hostname={hostname} />
            </TabsContent>
            <TabsContent value="alerts">
              <AlertsTab hostname={hostname} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
