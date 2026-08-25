/** A budget/wallet card — either a seeded default or one the user created. */
export interface WalletCard {
  label: string;
  bg: string;
  ink: string;
  sub: string;
  /** Base budget total, formatted e.g. "₹ 2,834". Spend is subtracted from this at render time. */
  amount: string;
  rid: string;
  /** Masked card number, e.g. "*** **** 0334". */
  digits: string;
  /** Reset/expiry label, e.g. "04 / 26". */
  exp: string;
  expLabel?: string;
  artA: string;
  artB: string;
}

/** A single logged spend against a card. */
export interface Expense {
  title: string;
  date: string;
  /** Formatted, signed amount e.g. "-₹150". */
  amt: string;
  /** Icon tile background color. */
  tile: string;
  /** SVG path for the category icon. */
  icon: string;
}
