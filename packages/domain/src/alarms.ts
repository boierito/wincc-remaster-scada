export interface AlarmCondition {
  operator: "equals" | "notEquals" | "greaterThan" | "greaterThanOrEqual" | "lessThan" | "lessThanOrEqual";
  value: unknown;
}

export function evaluateAlarmCondition(condition: AlarmCondition, value: unknown): boolean {
  switch (condition.operator) {
    case "equals":
      return value === condition.value;
    case "notEquals":
      return value !== condition.value;
    case "greaterThan":
      return Number(value) > Number(condition.value);
    case "greaterThanOrEqual":
      return Number(value) >= Number(condition.value);
    case "lessThan":
      return Number(value) < Number(condition.value);
    case "lessThanOrEqual":
      return Number(value) <= Number(condition.value);
  }
}
