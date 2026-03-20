const { calculateMonthlyLaborCost, calculateNetProfit, calculateTotalRealized } = require("../utils/finance");

describe("Advanced Finance Logic (Unit Tests)", () => {
  test("Internal Employee - Normal Hours", () => {
    const result = calculateMonthlyLaborCost({ category: 'internal', hours: 160, annual_gross: 40000 });
    expect(result).toBe(3200);
  });

  test("Consultant - Fixed Monthly Cost", () => {
    const result = calculateMonthlyLaborCost({ category: 'consultant', hours: 10, annual_gross: 60000 });
    expect(result).toBe(5000);
  });

  test("Internal Employee - Zero Hours", () => {
    const result = calculateMonthlyLaborCost({ category: 'internal', hours: 0, annual_gross: 50000 });
    expect(result).toBe(0);
  });

  test("Consultant - Zero Hours", () => {
    const result = calculateMonthlyLaborCost({ category: 'consultant', hours: 0, annual_gross: 36000 });
    expect(result).toBe(3000);
  });

  test("Zero Gross Salary Case", () => {
    const result = calculateMonthlyLaborCost({ category: 'internal', hours: 100, annual_gross: 0 });
    expect(result).toBe(0);
  });

  test("Net Profit Calculation", () => {
    const result = calculateNetProfit(10000, 4000, 1000);
    expect(result).toBe(5000);
  });

  test("Net Profit - Negative Result (Loss)", () => {
    const result = calculateNetProfit(2000, 3000, 500);
    expect(result).toBe(-1500);
  });

  test("Total Realized - Multiple Entries", () => {
    const entries = [{ amount: 1000.50 }, { amount: 500 }, { amount: "200.25" }];
    const result = calculateTotalRealized(entries);
    expect(result).toBe(1700.75);
  });

  test("Total Realized - Empty List", () => {
    const result = calculateTotalRealized([]);
    expect(result).toBe(0);
  });

  test("Total Realized - Null/Invalid Entries", () => {
    const entries = [{ amount: 100 }, { amount: null }, { amount: "abc" }];
    const result = calculateTotalRealized(entries);
    expect(result).toBe(100);
  });

  test("Total Realized - Floating Point Precision", () => {
    const entries = [{ amount: 0.1 }, { amount: 0.2 }];
    const result = calculateTotalRealized(entries);
    expect(result).toBeCloseTo(0.3, 5);
  });

  test("Total Realized - Large Values", () => {
    const entries = [{ amount: 1000000000 }, { amount: 500000000 }];
    const result = calculateTotalRealized(entries);
    expect(result).toBe(1500000000);
  });

  test("Net Profit - Zero Inputs", () => {
    const result = calculateNetProfit(0, 0, 0);
    expect(result).toBe(0);
  });
});
