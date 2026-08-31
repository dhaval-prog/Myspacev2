import { Linking, Platform } from 'react-native';

export interface UpiPaymentParams {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  reference: string;
  note: string;
}

export interface UpiApp {
  id: string;
  label: string;
  /** iOS custom URL scheme prefix this app registers, e.g. "tez://upi/pay?". */
  iosScheme: string;
}

/** The apps we offer on iOS, where there's no OS-level chooser and we detect + list installed apps ourselves. */
export const UPI_APPS: UpiApp[] = [
  { id: 'gpay', label: 'Google Pay', iosScheme: 'tez://upi/pay?' },
  { id: 'phonepe', label: 'PhonePe', iosScheme: 'phonepe://pay?' },
  { id: 'paytm', label: 'Paytm', iosScheme: 'paytmmp://pay?' },
  { id: 'bhim', label: 'BHIM', iosScheme: 'bhim://pay?' },
];

function upiQuery({ payeeVpa, payeeName, amount, reference, note }: UpiPaymentParams): string {
  const params = new URLSearchParams({
    pa: payeeVpa,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: 'INR',
    tr: reference,
    tn: note,
  });
  return params.toString();
}

/** The generic `upi://pay` deep link — on Android, opening this triggers the native app chooser automatically. */
export function buildUpiUri(params: UpiPaymentParams): string {
  return `upi://pay?${upiQuery(params)}`;
}

/**
 * iOS has no OS-level UPI chooser, so we probe each known app's custom scheme via `canOpenURL`
 * (requires the schemes to be declared in app.json's `ios.infoPlist.LSApplicationQueriesSchemes`)
 * and only offer the ones actually installed. Not meaningful on Android, which gets the native
 * chooser for free from the generic `upi://` intent.
 */
export async function getAvailableUpiApps(params: UpiPaymentParams): Promise<UpiApp[]> {
  if (Platform.OS !== 'ios') return [];
  const query = upiQuery(params);
  const checks = await Promise.all(
    UPI_APPS.map(async (app) => {
      try {
        return await Linking.canOpenURL(`${app.iosScheme}${query}`);
      } catch {
        return false;
      }
    }),
  );
  return UPI_APPS.filter((_, i) => checks[i]);
}

/**
 * Launches a UPI app to complete the payment. Pass a specific `app` (from `getAvailableUpiApps`,
 * iOS only) to open that app directly, or omit it for the generic `upi://pay` link — the path
 * used on Android, where the OS presents its own chooser.
 * Returns false if no UPI app could be opened (e.g. none installed), rather than throwing.
 */
export async function launchUpiPayment(params: UpiPaymentParams, app?: UpiApp): Promise<boolean> {
  const uri = app ? `${app.iosScheme}${upiQuery(params)}` : buildUpiUri(params);
  try {
    const canOpen = await Linking.canOpenURL(uri);
    if (!canOpen) return false;
    await Linking.openURL(uri);
    return true;
  } catch {
    return false;
  }
}
