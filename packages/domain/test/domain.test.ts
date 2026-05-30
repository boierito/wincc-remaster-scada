import { describe, expect, it } from "vitest";
import { alignObjects, assignSequentialZ, evaluateAlarmCondition, findCrossReferences, findTagReferences, propagateFaceplateType, resolveTagReference, translateWinccLikeScript } from "../src/index.js";

describe("prefix compatibility", () => {
  it("applies inherited prefixes and supports @NOTP", () => {
    expect(resolveTagReference("Speed", { inheritedPrefix: "Motor01" })).toBe("Motor01.Speed");
    expect(resolveTagReference("@PREFIX::Speed", { localPrefix: "Valve01" })).toBe("Valve01.Speed");
    expect(resolveTagReference("@NOTP::Plant.Common.Reset", { inheritedPrefix: "Motor01" })).toBe("Plant.Common.Reset");
  });
});

describe("faceplate propagation", () => {
  it("updates type version while preserving valid overrides", () => {
    const result = propagateFaceplateType(
      {
        id: "00000000-0000-0000-0000-000000000001",
        projectId: "00000000-0000-0000-0000-000000000002",
        typeId: "00000000-0000-0000-0000-000000000003",
        typeVersion: 1,
        name: "Motor01Fp",
        tagBindings: { speed: "Motor01.Speed", removed: "Motor01.Legacy" },
        propertyOverrides: {},
        eventOverrides: {}
      },
      {
        id: "00000000-0000-0000-0000-000000000003",
        projectId: "00000000-0000-0000-0000-000000000002",
        name: "Motor",
        version: 2,
        interface: {
          tags: [{ name: "speed", dataType: "float32", required: true }],
          properties: [],
          commands: [],
          events: []
        },
        composition: []
      }
    );

    expect(result.instance.typeVersion).toBe(2);
    expect(result.instance.tagBindings).toEqual({ speed: "Motor01.Speed" });
    expect(result.removedBindings).toEqual(["removed"]);
    expect(result.missingRequiredBindings).toEqual([]);
  });
});

describe("cross reference", () => {
  it("finds tag references in objects, faceplates and scripts", () => {
    const hits = findTagReferences({
      tags: [{
        id: "00000000-0000-0000-0000-000000000004",
        projectId: "00000000-0000-0000-0000-000000000002",
        name: "Speed",
        path: "Motor01.Speed",
        dataType: "float32",
        scope: "external",
        properties: {}
      }],
      objects: [{
        id: "00000000-0000-0000-0000-000000000005",
        screenId: "00000000-0000-0000-0000-000000000006",
        type: "text",
        name: "SpeedText",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        zIndex: 0,
        properties: {},
        bindings: { text: "Motor01.Speed" },
        events: {}
      }],
      faceplateInstances: [{
        id: "00000000-0000-0000-0000-000000000007",
        projectId: "00000000-0000-0000-0000-000000000002",
        typeId: "00000000-0000-0000-0000-000000000003",
        typeVersion: 1,
        name: "MotorFp",
        tagBindings: { speed: "Motor01.Speed" },
        propertyOverrides: {},
        eventOverrides: {}
      }],
      scripts: [{ id: "00000000-0000-0000-0000-000000000008", source: "HMIRuntime.Tags(\"Motor01.Speed\").Read()" }]
    });

    expect(hits).toHaveLength(3);
  });

  it("finds screen, alarm, historian and list references", () => {
    const hits = findCrossReferences({
      tags: [{ path: "Motor01.Fault" }],
      screens: [{ id: "00000000-0000-0000-0000-000000000021", name: "Popup" }],
      objects: [{
        id: "00000000-0000-0000-0000-000000000022",
        screenId: "00000000-0000-0000-0000-000000000023",
        type: "pictureWindow",
        name: "Window",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        zIndex: 0,
        properties: { screen: "Popup", tag: "Motor01.Fault" },
        bindings: {},
        events: {}
      }],
      alarms: [{ id: "00000000-0000-0000-0000-000000000024", sourceTagPath: "Motor01.Fault" }],
      historianArchives: [{ id: "00000000-0000-0000-0000-000000000025", name: "Fault archive", tagPath: "Motor01.Fault" }],
      textItems: [{ id: "00000000-0000-0000-0000-000000000026", listName: "State", key: "fault", text: "Fault" }],
      graphicItems: [{ id: "00000000-0000-0000-0000-000000000027", key: "fault", assetRef: "assets/fault.svg" }]
    });

    expect(hits.some((hit) => hit.referenceKind === "screen" && hit.reference === "Popup")).toBe(true);
    expect(hits.some((hit) => hit.kind === "alarm" && hit.reference === "Motor01.Fault")).toBe(true);
    expect(hits.some((hit) => hit.kind === "historianArchive" && hit.reference === "Motor01.Fault")).toBe(true);
    expect(hits.some((hit) => hit.kind === "textList" && hit.reference === "State")).toBe(true);
    expect(hits.some((hit) => hit.kind === "graphicList" && hit.reference === "assets/fault.svg")).toBe(true);
  });
});

describe("script compatibility", () => {
  it("translates common WinCC-like tag calls", () => {
    expect(translateWinccLikeScript('HMIRuntime.Tags("Motor01.Speed").Read()')).toBe('api.readTag("Motor01.Speed")');
    expect(translateWinccLikeScript('HMIRuntime.Tags("Motor01.Speed").Write(42)')).toBe('api.writeTag("Motor01.Speed", 42)');
    expect(translateWinccLikeScript('OpenPicture("EquipmentPopup", "Motor01")')).toBe('api.openPicture("EquipmentPopup", "Motor01")');
  });
});

describe("alarm evaluation", () => {
  it("evaluates boolean and numeric alarm conditions", () => {
    expect(evaluateAlarmCondition({ operator: "equals", value: true }, true)).toBe(true);
    expect(evaluateAlarmCondition({ operator: "greaterThan", value: 10 }, 12)).toBe(true);
    expect(evaluateAlarmCondition({ operator: "lessThanOrEqual", value: 5 }, 7)).toBe(false);
  });
});

describe("graphics designer helpers", () => {
  const objects = [
    { id: "00000000-0000-0000-0000-000000000101", screenId: "00000000-0000-0000-0000-000000000201", type: "rect" as const, name: "B", x: 40, y: 10, width: 20, height: 20, zIndex: 5, properties: {}, bindings: {}, events: {} },
    { id: "00000000-0000-0000-0000-000000000102", screenId: "00000000-0000-0000-0000-000000000201", type: "rect" as const, name: "A", x: 10, y: 30, width: 20, height: 20, zIndex: 2, properties: {}, bindings: {}, events: {} }
  ];

  it("aligns selected objects to the same edge", () => {
    expect(alignObjects(objects, "left").map((object) => object.x)).toEqual([10, 10]);
  });

  it("normalizes z-order predictably", () => {
    expect(assignSequentialZ(objects, 10).map((object) => [object.name, object.zIndex])).toEqual([["A", 10], ["B", 11]]);
  });
});
