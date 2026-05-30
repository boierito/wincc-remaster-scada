import type { Tag } from "@scada/domain";

export interface ScadaConnection {
  id: string;
  name: string;
  provider: "s7" | "opcua" | "mpi-ppi-dp";
  endpoint: string;
  options: Record<string, unknown>;
}

export interface NodeRedNode {
  id: string;
  type: string;
  z?: string;
  name?: string;
  wires?: string[][];
  [key: string]: unknown;
}

export interface NodeRedFlow {
  id: string;
  label: string;
  nodes: NodeRedNode[];
}

export interface PlcSymbol {
  symbolPath: string;
  address: string;
  dataType: Tag["dataType"];
  direction: "read" | "write" | "readWrite";
  structure?: Record<string, unknown>;
}

export function generateNodeRedFlow(connection: ScadaConnection, tags: Tag[]): NodeRedFlow {
  const flowId = `flow_${connection.id.replaceAll("-", "")}`;
  const scopedTags = tags.filter((tag) => tag.connectionId === connection.id);
  const nodes: NodeRedNode[] = [
    { id: flowId, type: "tab", label: `SCADA ${connection.name}` }
  ];

  if (connection.provider === "s7") {
    nodes.push({
      id: `cfg_${connection.id}`,
      type: "s7 endpoint",
      transport: "iso-on-tcp",
      address: connection.endpoint,
      rack: connection.options.rack ?? 0,
      slot: connection.options.slot ?? 1
    });
    for (const tag of scopedTags) {
      nodes.push({
        id: `read_${tag.id}`,
        type: "s7 in",
        z: flowId,
        endpoint: `cfg_${connection.id}`,
        variable: tag.address,
        name: tag.path,
        wires: [[`normalize_${tag.id}`]]
      });
      nodes.push(normalizerNode(flowId, tag));
    }
  }

  if (connection.provider === "opcua") {
    nodes.push({
      id: `cfg_${connection.id}`,
      type: "OpcUa-Endpoint",
      endpoint: connection.endpoint,
      securityPolicy: connection.options.securityPolicy ?? "None",
      securityMode: connection.options.securityMode ?? "None"
    });
    for (const tag of scopedTags) {
      nodes.push({
        id: `mon_${tag.id}`,
        type: "OpcUa-Client",
        z: flowId,
        endpoint: `cfg_${connection.id}`,
        action: "subscribe",
        nodeId: tag.address,
        name: tag.path,
        wires: [[`normalize_${tag.id}`]]
      });
      nodes.push(normalizerNode(flowId, tag));
    }
  }

  return { id: flowId, label: `SCADA ${connection.name}`, nodes };
}

function normalizerNode(flowId: string, tag: Tag): NodeRedNode {
  return {
    id: `normalize_${tag.id}`,
    type: "function",
    z: flowId,
    name: `Normalize ${tag.path}`,
    func: [
      "msg.payload = {",
      `  tagId: "${tag.id}",`,
      `  path: "${tag.path}",`,
      "  value: msg.payload,",
      "  quality: msg.quality || 'good',",
      "  timestamp: new Date().toISOString(),",
      "  source: msg.topic || 'node-red',",
      "  connectionState: 'online'",
      "};",
      "return msg;"
    ].join("\n"),
    wires: [["scada_out"]]
  };
}

export class NodeRedAdminClient {
  constructor(private readonly baseUrl: string, private readonly token?: string) {}

  async deployFlows(flows: NodeRedFlow[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/flows`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
      },
      body: JSON.stringify(flows.flatMap((flow) => flow.nodes))
    });
    if (!response.ok) {
      throw new Error(`Node-RED deploy failed: ${response.status} ${await response.text()}`);
    }
  }
}

export function mockBrowseSymbols(connection: ScadaConnection): PlcSymbol[] {
  if (connection.provider === "s7") {
    return [
      { symbolPath: `${connection.name}.Heartbeat`, address: "DB100,X0.0", dataType: "bool", direction: "read" },
      { symbolPath: `${connection.name}.CommandStart`, address: "DB100,X0.1", dataType: "bool", direction: "readWrite" },
      { symbolPath: `${connection.name}.SpeedSetpoint`, address: "DB100,REAL2", dataType: "float32", direction: "readWrite" }
    ];
  }
  if (connection.provider === "opcua") {
    return [
      { symbolPath: `${connection.name}.Status.Running`, address: `ns=2;s=${connection.name}.Status.Running`, dataType: "bool", direction: "read" },
      { symbolPath: `${connection.name}.Status.Fault`, address: `ns=2;s=${connection.name}.Status.Fault`, dataType: "bool", direction: "read" },
      { symbolPath: `${connection.name}.Process.Speed`, address: `ns=2;s=${connection.name}.Process.Speed`, dataType: "float32", direction: "readWrite" }
    ];
  }
  return [];
}
