import * as React from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type Row,
  type SortingState,
} from "@tanstack/react-table"

import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Input } from "./ui/input"

import { Label } from "./ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"
import { GripVerticalIcon, CircleCheckIcon, LoaderIcon, EllipsisVerticalIcon, Columns3Icon, ChevronDownIcon, PlusIcon, ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon, TerminalSquareIcon } from "lucide-react"

import type { DeviceConfig } from "../../../shared/types"

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
})

const columnHelper = createColumnHelper<
  typeof features,
  DeviceConfig
>()

function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({ id })
  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <GripVerticalIcon className="size-3 text-muted-foreground" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

const columns = columnHelper.columns([
  columnHelper.display({
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  }),
  columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.accessor("name", {
    header: "Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  }),
  columnHelper.display({
    id: "address",
    header: "Address / Path",
    cell: ({ row }) => <span className="font-mono text-sm">{row.original.type === 'ssh' ? row.original.host : row.original.path}</span>,
  }),
  columnHelper.accessor("type", {
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground uppercase">
        {row.original.type}
      </Badge>
    ),
  }),
  columnHelper.accessor("connectionStatus", {
    header: "Connection",
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {row.original.connectionStatus === "Connected" ? (
          <CircleCheckIcon className="fill-green-500 dark:fill-green-400 size-4 mr-1" />
        ) : row.original.connectionStatus === "Connecting" ? (
          <LoaderIcon className="size-4 mr-1 animate-spin" />
        ) : (
          <CircleCheckIcon className="fill-gray-500 dark:fill-gray-600 size-4 mr-1" />
        )}
        {row.original.connectionStatus}
      </Badge>
    ),
  }),
  columnHelper.display({
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="flex size-8 text-muted-foreground"
              size="icon"
            >
              <EllipsisVerticalIcon className="size-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={async () => {
            const sessionId = await (window as any).api.connectDevice(row.original);
            window.dispatchEvent(new CustomEvent('open-terminal-tab', { detail: { sessionId, device: row.original } }));
          }}>
            <TerminalSquareIcon className="size-4 mr-2" />
            Open Terminal
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => (window as any).api.connectDevice(row.original)}>
            Connect
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => (window as any).api.disconnectDevice()}>
            Disconnect
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => (window as any).api.removeDevice(row.original.id)}>
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }),
])

function DraggableRow({
  row,
}: {
  row: Row<typeof features, DeviceConfig>
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })
  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          <FlexRender cell={cell} />
        </TableCell>
      ))}
    </TableRow>
  )
}

export function DeviceTable() {
  const [data, setData] = React.useState<DeviceConfig[]>([])
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // Add Device form state
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [deviceName, setDeviceName] = React.useState("");
  const [sshHost, setSshHost] = React.useState("");
  const [sshUser, setSshUser] = React.useState("");
  const [sshPass, setSshPass] = React.useState("");
  const [serialPath, setSerialPath] = React.useState("");
  const [serialBaud, setSerialBaud] = React.useState("9600");
  const [addTab, setAddTab] = React.useState("ssh");
  const [serialPorts, setSerialPorts] = React.useState<any[]>([]);

  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )
  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  React.useEffect(() => {
    // Load initial devices
    (window as any).api.getDevices().then(setData);

    // Listen for updates
    (window as any).api.onDevicesUpdated((devices: DeviceConfig[]) => {
      setData(devices);
    });

    (window as any).api.onDeviceStatus((update: { id: string, status: string }) => {
      setData(prev => prev.map(d => d.id === update.id ? { ...d, connectionStatus: update.status as any } : d));
    });
  }, []);

  const handleAddDevice = () => {
    const newDevice: DeviceConfig = {
      id: crypto.randomUUID(),
      name: deviceName || (addTab === 'ssh' ? sshHost : serialPath),
      type: addTab as 'ssh' | 'serial',
      connectionStatus: 'Offline',
      ...(addTab === 'ssh' ? {
        host: sshHost,
        username: sshUser,
        password: sshPass,
        authType: 'password',
        port: 22
      } : {
        path: serialPath,
        baudRate: parseInt(serialBaud, 10)
      })
    };
    (window as any).api.addDevice(newDevice);
    setIsAddOpen(false);
    // reset form
    setDeviceName(""); setSshHost(""); setSshUser(""); setSshPass(""); setSerialPath("");
  };

  const handleFetchPorts = async () => {
    const ports = await (window as any).api.getSerialPorts();
    setSerialPorts(ports);
    if (ports.length > 0 && !serialPath) {
      setSerialPath(ports[0].path);
    }
  };

  const table = useTable({
    features,
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  return (
    <div className="w-full flex-col justify-start gap-6 flex">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <h2 className="text-lg font-semibold">Managed Devices</h2>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <Columns3Icon className="mr-2 size-4" />
                  Columns
                  <ChevronDownIcon className="ml-2 size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-32">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={
              <Button variant="outline" size="sm">
                <PlusIcon className="mr-2 size-4" />
                <span className="hidden lg:inline">Add Device</span>
              </Button>
            } />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Device</DialogTitle>
                <DialogDescription>
                  Configure a new SSH or Serial device connection.
                </DialogDescription>
              </DialogHeader>
              <Tabs value={addTab} onValueChange={setAddTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="ssh">SSH</TabsTrigger>
                  <TabsTrigger value="serial">Serial</TabsTrigger>
                </TabsList>
                <div className="py-4 space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="name">Display Name (Optional)</Label>
                    <Input id="name" value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="My Router" />
                  </div>
                  
                  <TabsContent value="ssh" className="space-y-4 mt-0">
                    <div className="space-y-1">
                      <Label htmlFor="host">Host / IP</Label>
                      <Input id="host" value={sshHost} onChange={e => setSshHost(e.target.value)} placeholder="192.168.1.1" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="user">Username</Label>
                      <Input id="user" value={sshUser} onChange={e => setSshUser(e.target.value)} placeholder="admin" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pass">Password</Label>
                      <Input id="pass" type="password" value={sshPass} onChange={e => setSshPass(e.target.value)} />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="serial" className="space-y-4 mt-0">
                    <div className="space-y-1">
                      <Label htmlFor="path">Port / Path</Label>
                      <div className="flex gap-2">
                        <Select value={serialPath} onValueChange={(val) => val && setSerialPath(val)}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select a port" />
                          </SelectTrigger>
                          <SelectContent>
                            {serialPorts.length === 0 && <SelectItem value="none" disabled>No ports found</SelectItem>}
                            {serialPorts.map(p => (
                              <SelectItem key={p.path} value={p.path}>{p.path}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={handleFetchPorts}>Refresh</Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="baud">Baud Rate</Label>
                      <Select value={serialBaud} onValueChange={(val) => val && setSerialBaud(val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="9600">9600</SelectItem>
                          <SelectItem value="19200">19200</SelectItem>
                          <SelectItem value="38400">38400</SelectItem>
                          <SelectItem value="57600">57600</SelectItem>
                          <SelectItem value="115200">115200</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAddDevice}>Save Device</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>
      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder ? null : (
                            <FlexRender header={header} />
                          )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No devices found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between pb-6">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.state.pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue placeholder={table.state.pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectGroup>
                    {[10, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.state.pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeftIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRightIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex p-0"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
