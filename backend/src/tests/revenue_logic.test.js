const { calculateTotalRealized } = require("../utils/finance");

/**
 * REVENUE LOGIC TEST SUITE
 * 
 * Verifies how realized revenue entries are aggregated and mapped to time.
 */

const tests = [
  {
    name: "Aggregation - Multiple Realized Entries for One Line",
    fn: () => {
      const line = {
        realized: [
          { amount: 500, registration_date: '2026-01-10' },
          { amount: 300, registration_date: '2026-01-20' },
          { amount: 200, registration_date: '2026-02-05' }
        ]
      };
      const total = calculateTotalRealized(line.realized);
      return total === 1000;
    }
  },
  {
    name: "Filtering - Monthly Revenue (Simulated logic from kpi.js)",
    fn: () => {
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

      return janTotal === 800 && febTotal === 200;
    }
  },
  {
    name: "Edge Case - Realized entry with zero amount",
    fn: () => {
      const entries = [{ amount: 0 }, { amount: 100 }];
      return calculateTotalRealized(entries) === 100;
    }
  }
];

function runSuite() {
  console.log(" Starting Revenue Logic Logic Test Suite...\n");
  let passed = 0;
  tests.forEach((test, i) => {
    try {
      const success = test.fn();
      if (success) {
        console.log(` [${i+1}] ${test.name}`);
        passed++;
      } else {
        console.error(` [${i+1}] ${test.name} - FAILED`);
      }
    } catch (err) {
      console.error(` [${i+1}] ${test.name} - ERROR: ${err.message}`);
    }
  });
  console.log(`\n Summary: ${passed}/${tests.length} passed.`);
  process.exit(passed === tests.length ? 0 : 1);
}

runSuite();
