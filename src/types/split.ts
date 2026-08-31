/** A shared expense space — "Trip to Goa", "Prabhat Flat" — joined via an 11-digit rid. */
export interface SplitGroup {
  id: string;
  name: string;
  description: string;
  category: string;
  currency: string;
  splitMode: 'equal' | 'percentage' | 'custom' | 'shares';
  whoCanAdd: 'anyone' | 'owner';
  remindSettlements: boolean;
  rid: string;
  isOwner: boolean;
}

/** A group member, resolved against `profiles` for display. */
export interface SplitMember {
  userId: string;
  name: string;
}

/** A single logged spend against a group. */
export interface SplitExpense {
  id: string;
  groupId: string;
  paidBy: string;
  title: string;
  amount: number;
  category: string;
  splitMode: 'equal' | 'items';
  createdAt: string;
  shares: ExpenseShare[];
}

export interface ExpenseShare {
  userId: string;
  amount: number;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  createdAt: string;
  source: 'manual' | 'upi';
  paymentAttemptId: string | null;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  userId: string;
  text: string;
  createdAt: string;
}

/** One member's net position in a group: positive = owed to them, negative = they owe. */
export interface Balance {
  userId: string;
  name: string;
  net: number;
}
