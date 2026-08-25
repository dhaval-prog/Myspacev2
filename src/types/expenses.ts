/** A budget/wallet card — owned by one account, optionally shared with members. */
export interface WalletCard {
  id: string;
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
  /** True when the signed-in account owns this card (vs. joined as a member). */
  isOwner: boolean;
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
