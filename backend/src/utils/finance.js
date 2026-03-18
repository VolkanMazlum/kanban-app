/**
 * Finance utilities for the Kanban application.
 * Centralizes complex calculations for labor costs and profitability.
 */

const THEORETICAL_HOURS_PER_YEAR = 2000;

/**
 * Calculates labor cost for a single employee.
 * @param {Object} employee - The employee object from DB
 * @param {number} employee.hours - Logged hours for the period
 * @param {number} employee.annual_gross - Annual gross salary
 * @param {string} employee.category - 'internal' or 'consultant'
 * @returns {number} The calculated monthly cost
 */
function calculateMonthlyLaborCost(employee) {
  const hours = parseFloat(employee.hours || 0);
  const gross = parseFloat(employee.annual_gross || 0);

  if (employee.category === 'consultant') {
    // Consultants have a fixed monthly cost regardless of hours
    return gross / 12;
  }

  // Internal employees: cost depends on hours logged
  // Formula: (Annual Gross / 2000) * hours
  return hours * (gross / THEORETICAL_HOURS_PER_YEAR);
}

/**
 * Calculates net profit for a given period.
 * @param {number} revenue - Total billed revenue
 * @param {number} laborCost - Total labor costs
 * @param {number} overhead - Monthly general expenses
 * @returns {number} The net profit
 */
function calculateNetProfit(revenue, laborCost, overhead) {
  return (parseFloat(revenue) || 0) - (parseFloat(laborCost) || 0) - (parseFloat(overhead) || 0);
}

module.exports = {
  calculateMonthlyLaborCost,
  calculateNetProfit,
  THEORETICAL_HOURS_PER_YEAR
};
