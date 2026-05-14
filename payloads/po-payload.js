export const poPayload = {
  person1_name: "Jack",
  person1_age: 38,
  person1_retirement_age: 60,
  person1_salary: 110000,
  is_couple: true,
  person2_name: "Jill",
  person2_age: 41,
  person2_retirement_age: 60,
  person2_salary: 90000,
  super_rate: 0.12,
  primary_loan_amount: 700000,
  primary_interest_rate: 0.06,
  primary_loan_term_months: 360,
  primary_property_value: 950000,
  primary_offset_balance: 20000,
  has_investment_property: false,
  monthly_expenses: 4500,
  has_children: false,
  has_novated_lease: false,
  savings_allocation: {
    phase1: { asx: 0.3, sp500: 0.2, crypto: 0.1, hisa: 0.4 },
    phase2: { asx: 0.4, sp500: 0.2, crypto: 0.1, hisa: 0.3 },
    phase3: { asx: 0.4, sp500: 0.2, crypto: 0.2, hisa: 0.2 },
    phase4: { asx: 0.4, sp500: 0.2, crypto: 0.2, hisa: 0.2 }
  },
  assumptions: {
    super_return_accumulation: 0.07,
    super_return_pension: 0.045,
    property_growth: 0.04,
    asx_return: 0.09,
    sp500_return: 0.10,
    crypto_return: 0.15,
    hisa_return: 0.045,
    cpi: 0.025,
    super_drawdown_target_age: 92
  }
};