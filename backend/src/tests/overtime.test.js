const { updateMonthlyOvertime } = require("../utils/overtime");

describe("Overtime Logic (Unit Tests)", () => {
  test("Overhead correctly calculated as 12.5h", async () => {
    // 1. Mock Query Function
    const mockQuery = async (sql, params) => {
      // If it's the calculation query
      if (sql.includes("SUM(daily_overtime)")) {
        return { rows: [{ total_overtime: "12.5" }] };
      }
      // If it's the insert query
      if (sql.includes("INSERT INTO employee_overtime_costs")) {
        return { rows: [] };
      }
      return { rows: [] };
    };

    // 2. Execute the function under test
    const result = await updateMonthlyOvertime(mockQuery, 1, 2026, 3);

    // 3. Assertion
    expect(result).toBe(12.5);
  });
});
