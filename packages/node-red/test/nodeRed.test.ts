import { describe, expect, it } from "vitest";
import { generateNodeRedFlow, mockBrowseSymbols } from "../src/index.js";

describe("Node-RED flow generation", () => {
  it("creates S7 read and normalization nodes from canonical tags", () => {
    const flow = generateNodeRedFlow(
      { id: "11111111-1111-1111-1111-111111111111", name: "PLC1", provider: "s7", endpoint: "192.168.0.10", options: { rack: 0, slot: 1 } },
      [{
        id: "22222222-2222-2222-2222-222222222222",
        projectId: "33333333-3333-3333-3333-333333333333",
        name: "Running",
        path: "Motor01.Running",
        dataType: "bool",
        scope: "external",
        connectionId: "11111111-1111-1111-1111-111111111111",
        address: "DB1,X0.0",
        properties: {}
      }]
    );

    expect(flow.nodes.some((node) => node.type === "s7 in")).toBe(true);
    expect(flow.nodes.some((node) => node.id === "normalize_22222222-2222-2222-2222-222222222222")).toBe(true);
  });

  it("creates OPC UA monitor nodes from canonical tags", () => {
    const flow = generateNodeRedFlow(
      { id: "11111111-1111-1111-1111-111111111112", name: "OPCUA1", provider: "opcua", endpoint: "opc.tcp://127.0.0.1:4840", options: {} },
      [{
        id: "22222222-2222-2222-2222-222222222223",
        projectId: "33333333-3333-3333-3333-333333333333",
        name: "Speed",
        path: "Conveyor01.Speed",
        dataType: "float32",
        scope: "external",
        connectionId: "11111111-1111-1111-1111-111111111112",
        address: "ns=2;s=Conveyor01.Speed",
        properties: {}
      }]
    );

    expect(flow.nodes.some((node) => node.type === "OpcUa-Client")).toBe(true);
    expect(flow.nodes.some((node) => node.id === "normalize_22222222-2222-2222-2222-222222222223")).toBe(true);
  });

  it("provides deterministic mock browse symbols for connector engineering", () => {
    const symbols = mockBrowseSymbols({ id: "11111111-1111-1111-1111-111111111111", name: "PLC_Main", provider: "s7", endpoint: "192.168.0.10", options: {} });
    expect(symbols.map((symbol) => symbol.symbolPath)).toContain("PLC_Main.Heartbeat");
  });
});
