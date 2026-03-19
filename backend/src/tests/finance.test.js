const { calculateMonthlyLaborCost, calculateNetProfit, calculateTotalRealized } = require("../utils/finance");

/**
 * ADVANCED FINANCE TEST SUITE
 * 
 * Verifies critical financial logic for labor costs and profitability.
 * How to run: docker exec -it kanban_backend node src/tests/finance.test.js
 * * How to run: docker exec -it kanban_backend node src/tests/finance.test.js
 */

const tests = [
  {
    name: "Internal Employee - Normal Hours",
    fn: () => {
      const result = calculateMonthlyLaborCost({ category: 'internal', hours: 160, annual_gross: 40000 });
      // (40,000 / 2,000) * 160 = 20 * 160 = 3200
      return result === 3200;
    }
  },
  {
    name: "Consultant - Fixed Monthly Cost",
    fn: () => {
      const result = calculateMonthlyLaborCost({ category: 'consultant', hours: 10, annual_gross: 60000 });
      // 60,000 / 12 = 5000 (regardless of hours)
      return result === 5000;
    }
  },
  {
    name: "Internal Employee - Zero Hours",
    fn: () => {
      const result = calculateMonthlyLaborCost({ category: 'internal', hours: 0, annual_gross: 50000 });
      return result === 0;
    }
  },
  {
    name: "Consultant - Zero Hours",
    fn: () => {
      const result = calculateMonthlyLaborCost({ category: 'consultant', hours: 0, annual_gross: 36000 });
      // 36,000 / 12 = 3000 (still paid)
      return result === 3000;
    }
  },
  {
    name: "Zero Gross Salary Case",
    fn: () => {
      const result = calculateMonthlyLaborCost({ category: 'internal', hours: 100, annual_gross: 0 });
      return result === 0;
    }
  },
  {
    name: "Net Profit Calculation",
    fn: () => {
      const result = calculateNetProfit(10000, 4000, 1000);
      // 10,000 - 4,000 - 1,000 = 5,000
      return result === 5000;
    }
  },
  {
    name: "Net Profit - Negative Result (Loss)",
    fn: () => {
      const result = calculateNetProfit(2000, 3000, 500);
      return result === -1500;
    }
  },
  {
    name: "Total Realized - Multiple Entries",
    fn: () => {
      const entries = [{ amount: 1000.50 }, { amount: 500 }, { amount: "200.25" }];
      const result = calculateTotalRealized(entries);
      return result === 1700.75;
    }
  },
  {
    name: "Total Realized - Empty List",
    fn: () => {
      const result = calculateTotalRealized([]);
      return result === 0;
    }
  },
  {
    name: "Total Realized - Null/Invalid Entries",
    fn: () => {
      const entries = [{ amount: 100 }, { amount: null }, { amount: "abc" }];
      const result = calculateTotalRealized(entries);
      return result === 100;
    }
  },
  {
    name: "Total Realized - Floating Point Precision",
    fn: () => {
      const entries = [{ amount: 0.1 }, { amount: 0.2 }];
      const result = calculateTotalRealized(entries);
      // Precision should handle standard JS float issues if we use parseFloat properly
      return Math.abs(result - 0.3) < 0.00001;
    }
  },
  {
    name: "Total Realized - Large Values",
    fn: () => {
      const entries = [{ amount: 1000000000 }, { amount: 500000000 }];
      const result = calculateTotalRealized(entries);
      return result === 1500000000;
    }
  },
  {
    name: "Net Profit - Zero Inputs",
    fn: () => {
      const result = calculateNetProfit(0, 0, 0);
      return result === 0;
    }
  }
];

function runSuite() {
  console.log(" Starting Advanced Finance Test Suite...\n");
  let passed = 0;

  tests.forEach((test, i) => {
    try {
      const success = test.fn();
      if (success) {
        console.log(` [${i + 1}] ${test.name}`);
        passed++;
      } else {
        console.error(` [${i + 1}] ${test.name} - Assertion Failed`);
      }
    } catch (err) {
      console.error(` [${i + 1}] ${test.name} - Error: ${err.message}`);
    }
  });

  console.log(`\n Summary: ${passed}/${tests.length} tests passed.`);
  process.exit(passed === tests.length ? 0 : 1);
}

runSuite();
