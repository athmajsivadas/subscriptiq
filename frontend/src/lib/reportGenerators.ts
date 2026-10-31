import { exportToCSV, exportToExcel, exportToPDF, formatCurrencyForExport, formatDateForExport } from './exportUtils';

interface FinancialData {
  metrics?: any[];
  revenueSources?: any[];
  expenseCategories?: any[];
}

// Profit & Loss Report
export const generateProfitLossReport = (
  data: FinancialData,
  format: 'csv' | 'excel' | 'pdf',
  currency: string = 'USD'
) => {
  const revenue = data.metrics?.find(m => m.metric_type === 'revenue');
  
  // Calculate total expenses from expense categories
  const totalExpenses = data.expenseCategories?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
  
  // Calculate net profit
  const revenueAmount = revenue?.amount || 0;
  const netProfit = revenueAmount - totalExpenses;

  const reportData = [
    { Category: 'Revenue', Amount: formatCurrencyForExport(revenueAmount, currency) },
    { Category: 'Expenses', Amount: formatCurrencyForExport(totalExpenses, currency) },
    { Category: 'Net Profit', Amount: formatCurrencyForExport(netProfit, currency) },
  ];

  // Add revenue breakdown
  if (data.revenueSources) {
    reportData.push({ Category: '', Amount: '' });
    reportData.push({ Category: 'Revenue Sources:', Amount: '' });
    data.revenueSources.forEach(source => {
      reportData.push({
        Category: `  ${source.name}`,
        Amount: formatCurrencyForExport(source.amount, currency)
      });
    });
  }

  // Add expense breakdown
  if (data.expenseCategories) {
    reportData.push({ Category: '', Amount: '' });
    reportData.push({ Category: 'Expense Categories:', Amount: '' });
    data.expenseCategories.forEach(exp => {
      reportData.push({
        Category: `  ${exp.name}`,
        Amount: formatCurrencyForExport(exp.amount, currency)
      });
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `Profit_Loss_Statement_${timestamp}`;

  if (format === 'csv') {
    exportToCSV(reportData, filename);
  } else if (format === 'excel') {
    exportToExcel(reportData, filename, 'P&L Statement');
  } else if (format === 'pdf') {
    const tableData = reportData.map(row => [row.Category, row.Amount]);
    exportToPDF('Profit & Loss Statement', ['Category', 'Amount'], tableData, filename);
  }
};

// Balance Sheet Report
export const generateBalanceSheetReport = (
  data: FinancialData,
  format: 'csv' | 'excel' | 'pdf',
  currency: string = 'USD'
) => {
  const revenue = data.metrics?.find(m => m.metric_type === 'revenue');
  const cashFlow = data.metrics?.find(m => m.metric_type === 'cash_flow');
  
  // Calculate total expenses from expense categories
  const totalExpenses = data.expenseCategories?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
  const revenueAmount = revenue?.amount || 0;

  const reportData = [
    { Section: 'Assets', Item: 'Current Assets', Amount: formatCurrencyForExport(revenueAmount, currency) },
    { Section: 'Assets', Item: 'Cash & Equivalents', Amount: formatCurrencyForExport(Math.abs(cashFlow?.amount || 0), currency) },
    { Section: '', Item: '', Amount: '' },
    { Section: 'Liabilities', Item: 'Current Liabilities', Amount: formatCurrencyForExport(totalExpenses, currency) },
    { Section: '', Item: '', Amount: '' },
    { Section: 'Equity', Item: 'Retained Earnings', Amount: formatCurrencyForExport(revenueAmount - totalExpenses, currency) },
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `Balance_Sheet_${timestamp}`;

  if (format === 'csv') {
    exportToCSV(reportData, filename);
  } else if (format === 'excel') {
    exportToExcel(reportData, filename, 'Balance Sheet');
  } else if (format === 'pdf') {
    const tableData = reportData.map(row => [row.Section, row.Item, row.Amount]);
    exportToPDF('Balance Sheet', ['Section', 'Item', 'Amount'], tableData, filename);
  }
};

// Cash Flow Report
export const generateCashFlowReport = (
  data: FinancialData,
  format: 'csv' | 'excel' | 'pdf',
  currency: string = 'USD'
) => {
  const revenue = data.metrics?.find(m => m.metric_type === 'revenue');
  const cashFlow = data.metrics?.find(m => m.metric_type === 'cash_flow');
  
  // Calculate total expenses from expense categories
  const totalExpenses = data.expenseCategories?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
  const revenueAmount = revenue?.amount || 0;

  const reportData = [
    { Activity: 'Operating Activities', Item: 'Net Income', Amount: formatCurrencyForExport(revenueAmount - totalExpenses, currency) },
    { Activity: 'Operating Activities', Item: 'Adjustments', Amount: formatCurrencyForExport(0, currency) },
    { Activity: '', Item: '', Amount: '' },
    { Activity: 'Investing Activities', Item: 'Capital Expenditures', Amount: formatCurrencyForExport(0, currency) },
    { Activity: '', Item: '', Amount: '' },
    { Activity: 'Financing Activities', Item: 'Net Borrowing', Amount: formatCurrencyForExport(0, currency) },
    { Activity: '', Item: '', Amount: '' },
    { Activity: 'Net Cash Flow', Item: '', Amount: formatCurrencyForExport(cashFlow?.amount || 0, currency) },
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `Cash_Flow_Statement_${timestamp}`;

  if (format === 'csv') {
    exportToCSV(reportData, filename);
  } else if (format === 'excel') {
    exportToExcel(reportData, filename, 'Cash Flow');
  } else if (format === 'pdf') {
    const tableData = reportData.map(row => [row.Activity, row.Item, row.Amount]);
    exportToPDF('Cash Flow Statement', ['Activity', 'Item', 'Amount'], tableData, filename);
  }
};

// Tax Summary Report
export const generateTaxSummaryReport = (
  data: FinancialData,
  format: 'csv' | 'excel' | 'pdf',
  currency: string = 'USD'
) => {
  const revenue = data.metrics?.find(m => m.metric_type === 'revenue');
  
  // Calculate total expenses from expense categories
  const totalExpenses = data.expenseCategories?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
  const revenueAmount = revenue?.amount || 0;
  const netIncome = revenueAmount - totalExpenses;
  const estimatedTax = netIncome * 0.21; // Simplified 21% corporate tax rate

  const reportData = [
    { Category: 'Gross Revenue', Amount: formatCurrencyForExport(revenueAmount, currency) },
    { Category: 'Total Deductions', Amount: formatCurrencyForExport(totalExpenses, currency) },
    { Category: 'Taxable Income', Amount: formatCurrencyForExport(netIncome, currency) },
    { Category: 'Estimated Tax (21%)', Amount: formatCurrencyForExport(estimatedTax, currency) },
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `Tax_Summary_${timestamp}`;

  if (format === 'csv') {
    exportToCSV(reportData, filename);
  } else if (format === 'excel') {
    exportToExcel(reportData, filename, 'Tax Summary');
  } else if (format === 'pdf') {
    const tableData = reportData.map(row => [row.Category, row.Amount]);
    exportToPDF('Tax Summary Report', ['Category', 'Amount'], tableData, filename);
  }
};

// Bulk Export - Generate all reports
export const generateBulkExport = (
  data: FinancialData,
  format: 'csv' | 'excel' | 'pdf',
  currency: string = 'USD'
) => {
  generateProfitLossReport(data, format, currency);
  setTimeout(() => generateBalanceSheetReport(data, format, currency), 100);
  setTimeout(() => generateCashFlowReport(data, format, currency), 200);
  setTimeout(() => generateTaxSummaryReport(data, format, currency), 300);
};
