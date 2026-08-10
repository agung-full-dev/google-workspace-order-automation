const CONFIG = {
  orderSheet: 'All Orders',
  logSheet: 'Sync Log',
  calendarId: 'primary',
  headers: {
    orderId: 'ORDER ID',
    customer: 'CUSTOMER',
    event: 'EVENT',
    cakeType: 'CAKE TYPE',
    size: 'SIZE',
    dueDate: 'DUE DATE',
    fulfillment: 'FULFILLMENT',
    total: 'TOTAL',
    balance: 'BALANCE',
    status: 'STATUS',
    address: 'ADDRESS',
    notes: 'NOTES',
    calendarEventId: 'CALENDAR EVENT ID',
    lastSynced: 'LAST SYNCED'
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Cake Orders')
    .addItem('Sync selected order', 'syncSelectedOrder')
    .addItem('Sync all confirmed orders', 'syncAllConfirmedOrders')
    .addToUi();
}

function syncSelectedOrder() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== CONFIG.orderSheet) {
    throw new Error(`Open the "${CONFIG.orderSheet}" sheet first.`);
  }
  syncOrderRow_(sheet, sheet.getActiveRange().getRow());
}

function syncAllConfirmedOrders() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.orderSheet);
  if (!sheet) throw new Error(`Missing sheet: ${CONFIG.orderSheet}`);

  const headers = getHeaderMap_(sheet);
  for (let row = 2; row <= sheet.getLastRow(); row += 1) {
    const status = valueAt_(sheet, row, headers, CONFIG.headers.status);
    if (String(status).toLowerCase() === 'confirmed') syncOrderRow_(sheet, row);
  }
}

function syncOrderRow_(sheet, row) {
  if (row < 2) return;

  const headers = getHeaderMap_(sheet);
  const order = readOrder_(sheet, row, headers);
  validateOrder_(order);

  if (String(order.status).toLowerCase() !== 'confirmed') {
    log_(order.orderId, 'SKIPPED', 'Order is not confirmed.');
    return;
  }

  const calendar = CalendarApp.getCalendarById(CONFIG.calendarId);
  const title = `${order.fulfillment} · ${order.orderId} · ${order.customer}`;
  const description = [
    `${order.event}: ${order.cakeType} (${order.size})`,
    `Total: ${order.total} | Balance: ${order.balance}`,
    order.address ? `Address: ${order.address}` : '',
    order.notes ? `Notes: ${order.notes}` : ''
  ].filter(Boolean).join('\n');

  let event = order.calendarEventId
    ? calendar.getEventById(order.calendarEventId)
    : null;
  const wasExisting = Boolean(event);

  if (event) {
    event.setTitle(title)
      .setTime(order.dueDate, new Date(order.dueDate.getTime() + 60 * 60 * 1000))
      .setDescription(description);
    if (order.address) event.setLocation(order.address);
  } else {
    event = calendar.createEvent(
      title,
      order.dueDate,
      new Date(order.dueDate.getTime() + 60 * 60 * 1000),
      { description, location: order.address || '' }
    );
  }

  setValue_(sheet, row, headers, CONFIG.headers.calendarEventId, event.getId());
  setValue_(sheet, row, headers, CONFIG.headers.lastSynced, new Date());
  log_(order.orderId, wasExisting ? 'UPDATED' : 'CREATED', event.getId());
}

function readOrder_(sheet, row, headers) {
  const result = {};
  Object.entries(CONFIG.headers).forEach(([key, header]) => {
    result[key] = valueAt_(sheet, row, headers, header);
  });
  return result;
}

function validateOrder_(order) {
  const required = ['orderId', 'customer', 'dueDate', 'fulfillment', 'status'];
  const missing = required.filter(key => !order[key]);
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(', ')}`);
  if (!(order.dueDate instanceof Date) || Number.isNaN(order.dueDate.getTime())) {
    throw new Error('DUE DATE must be a valid date and time.');
  }
}

function getHeaderMap_(sheet) {
  const values = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return values.reduce((map, value, index) => {
    map[String(value).trim().toUpperCase()] = index + 1;
    return map;
  }, {});
}

function valueAt_(sheet, row, headers, header) {
  const column = headers[header];
  return column ? sheet.getRange(row, column).getValue() : '';
}

function setValue_(sheet, row, headers, header, value) {
  const column = headers[header];
  if (!column) throw new Error(`Missing required column: ${header}`);
  sheet.getRange(row, column).setValue(value);
}

function log_(orderId, result, detail) {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet.getSheetByName(CONFIG.logSheet)
    || spreadsheet.insertSheet(CONFIG.logSheet);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['TIMESTAMP', 'ORDER ID', 'RESULT', 'DETAIL']);
  }
  sheet.appendRow([new Date(), orderId, result, detail]);
}
