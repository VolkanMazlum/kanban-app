const { calculateTotalRealized } = require("../utils/finance");

describe("Revenue Logic Logic (Unit Tests)", () => {
  test("Aggregation - Multiple Realized Entries for One Line", () => {
    const line = {
      realized: [
        { amount: 500, registration_date: '2026-01-10' },
        { amount: 300, registration_date: '2026-01-20' },
        { amount: 200, registration_date: '2026-02-05' }
      ]
    };
    const total = calculateTotalRealized(line.realized);
    expect(total).toBe(1000);
  });

  test("Filtering - Monthly Revenue (Simulated logic from kpi.js)", () => {
    const allRealized = [
      { amount: 500, registration_date: '2026-01-10' },
      { amount: 300, registration_date: '2026-01-20' },
      { amount: 200, registration_date: '2026-02-05' }
    ];
    
    const filterMonth = (entries, year, month) => {
      return entries.filter(e => {
        const d = new Date(e.registration_date);
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      });
    };

    const janEntries = filterMonth(allRealized, 2026, 1);
    const febEntries = filterMonth(allRealized, 2026, 2);
    
    const janTotal = janEntries.reduce((s, e) => s + e.amount, 0);
    const febTotal = febEntries.reduce((s, e) => s + e.amount, 0);

    expect(janTotal).toBe(800);
    expect(febTotal).toBe(200);
  });

  test("Edge Case - Realized entry with zero amount", () => {
    const entries = [{ amount: 0 }, { amount: 100 }];
    expect(calculateTotalRealized(entries)).toBe(100);
  });
});
