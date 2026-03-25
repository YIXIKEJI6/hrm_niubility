// 个人所得税累计预扣法 (2024年税率表)
const TAX_BRACKETS = [
  { limit: 36000, rate: 0.03, deduction: 0 },
  { limit: 144000, rate: 0.10, deduction: 2520 },
  { limit: 300000, rate: 0.20, deduction: 16920 },
  { limit: 420000, rate: 0.25, deduction: 31920 },
  { limit: 660000, rate: 0.30, deduction: 52920 },
  { limit: 960000, rate: 0.35, deduction: 85920 },
  { limit: Infinity, rate: 0.45, deduction: 181920 },
];

// 免征额
const TAX_THRESHOLD = 5000;

// 计算个税 (简化版，单月)
export function calculateTax(taxableIncome: number): number {
  const monthlyTaxable = taxableIncome - TAX_THRESHOLD;
  if (monthlyTaxable <= 0) return 0;

  // 换算为年度累计收入来查找税率
  const annualTaxable = monthlyTaxable * 12;
  for (const bracket of TAX_BRACKETS) {
    if (annualTaxable <= bracket.limit) {
      return Math.max(0, monthlyTaxable * bracket.rate - bracket.deduction / 12);
    }
  }
  return 0;
}

// 计算社保扣除 (简化: 个人部分约占工资的10.5%)
export function calculateSocialInsurance(baseSalary: number): number {
  // 养老8% + 医疗2% + 失业0.5%
  return Math.round(baseSalary * 0.105 * 100) / 100;
}

// 计算公积金 (个人部分, 默认12%)
export function calculateHousingFund(baseSalary: number, rate: number = 0.12): number {
  return Math.round(baseSalary * rate * 100) / 100;
}

// 计算净工资
export function calculateNetPay(row: {
  base_salary: number;
  perf_bonus: number;
  attendance_bonus: number;
  overtime_pay: number;
  other_income: number;
  social_insurance: number;
  housing_fund: number;
  other_deduction: number;
}): { gross_pay: number; tax: number; net_pay: number } {
  const grossPay = row.base_salary + row.perf_bonus + row.attendance_bonus + row.overtime_pay + row.other_income;
  const taxableIncome = grossPay - row.social_insurance - row.housing_fund;
  const tax = calculateTax(taxableIncome);
  const netPay = grossPay - row.social_insurance - row.housing_fund - tax - row.other_deduction;

  return {
    gross_pay: Math.round(grossPay * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    net_pay: Math.round(netPay * 100) / 100,
  };
}
