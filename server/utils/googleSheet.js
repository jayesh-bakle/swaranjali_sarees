let google = null; // lazy-loaded only when Sheets is configured (saves ~5s at boot)

/**
 * Google Sheets integration — appends order rows to a Google Sheet.
 *
 * Required env vars:
 *   GOOGLE_SHEET_ID           – the spreadsheet ID from the URL
 *   GOOGLE_SERVICE_ACCOUNT_JSON – the full JSON key (as a single-line string)
 *
 * The sheet must be shared (Editor) with the service account email.
 */

let sheetsClient = null;

/**
 * Build an authenticated Google Sheets API client from env vars.
 */
function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const { GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON } = process.env;
  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.warn('[GoogleSheet] GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON not set — skipping.');
    return null;
  }

  // Lazy-load the googleapis module (saves ~5s at boot when Sheets is unused)
  if (!google) {
    try { google = require('googleapis').google; } catch (_) { return null; }
  }

  try {
    const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    console.log('[GoogleSheet] Authenticated with Google Sheets API.');
    return sheetsClient;
  } catch (err) {
    console.error('[GoogleSheet] Failed to initialise:', err.message);
    return null;
  }
}

/**
 * Append order rows to the Google Sheet.
 *
 * @param {Object}   order        – the order object (from DB)
 * @param {Array}    orderItems   – parsed items array from the order
 * @param {Object}   user         – the user who placed the order { name, email }
 */
async function appendOrderToSheet(order, orderItems, user = {}) {
  const sheets = getSheetsClient();
  if (!sheets) return; // silently skip if not configured

  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  // Sheet name — adjust if you renamed the tab (default is "Sheet1")
  const RANGE = 'Sheet1!A:Q';

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // One row per item in the order
  const rows = orderItems.map((item) => [
    order.id,
    now,
    user.name || '',
    user.email || '',
    order.phone || '',
    order.shipping_address || '',
    item.id || '',
    item.name || '',
    item.fabric || '',
    item.color || '',
    item.quantity || 1,
    item.price || 0,
    (item.price || 0) * (item.quantity || 1),
    order.payment_method || 'cod',
    order.payment_status || 'pending',
    order.status || 'pending',
    order.total || 0,
  ]);

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGE,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });
    console.log(`[GoogleSheet] Appended ${rows.length} row(s) for order #${order.id}`);
  } catch (err) {
    // Log but never let a Sheets failure break the order flow
    console.error('[GoogleSheet] Append failed:', err.message);
  }
}

module.exports = { appendOrderToSheet };