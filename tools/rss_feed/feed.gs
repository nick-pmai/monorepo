function onOpen() {
  var ui = SpreadsheetApp.getUi();
  // Adds a custom menu to Google Sheets.
  ui.createMenu('PMAI')
      .addItem('Refresh RSS', 'ingestFeeds')
      .addItem('Configure refresh', 'configureRefresh')
      .addToUi();
}

function configureRefresh() {
  const ui   = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    'Feed cadence',
    'Enter minutes (1,5,10,15,30) or H<number> for hours, e.g. H2:',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  const raw = resp.getResponseText().trim();
  installIngestTrigger_(raw, ui);
}

function installIngestTrigger_(cadence, ui) {
  // Remove previous timers for idempotency
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'ingestFeeds')
    .forEach(t => ScriptApp.deleteTrigger(t));     // :contentReference[oaicite:5]{index=5}

  let builder = ScriptApp.newTrigger('ingestFeeds').timeBased();

  if (/^\d+$/.test(cadence)) {                     // minutes
    let n = Number(cadence);
    if (![1,5,10,15,30].includes(n)) {
      ui.alert('Allowed minutes are 1, 5, 10, 15, or 30.'); return;
    }
    builder.everyMinutes(n);
  } else if (/^h\d+$/i.test(cadence)) {           // hours
    builder.everyHours(Number(cadence.slice(1)));
  } else {
    ui.alert('Invalid format.'); return;
  }

  builder.create();                                // installs trigger :contentReference[oaicite:6]{index=6}
  PropertiesService.getDocumentProperties()
                   .setProperty('FEED_CADENCE', cadence); // persist choice
  ui.alert('⏰  Feed refresh set to every ' + cadence + (cadence.match(/^\d+$/)?' minutes.':' hours.'));
}


/**
 * Pull every feed in feed_list!A2:A and paste into data!A:D
 * Columns: Title | Link | PubDate (ISO) | SourceURL
 */
function ingestFeeds() {

  // --- CONFIG ---------------------
  const FEED_SHEET = 'feed_list';   // list of URLs
  const DATA_SHEET = 'data';        // output
  const MAX_ITEMS  = 20;            // per-feed cap
  // --------------------------------

  const ss        = SpreadsheetApp.getActive();
  const feedURLs  = ss.getSheetByName(FEED_SHEET)
                      .getRange('A2:A')
                      .getValues()
                      .flat()
                      .filter(String);            // kill blanks

  const rows = [];

  feedURLs.forEach(url => {
    try {
      const xml = UrlFetchApp.fetch(url).getContentText();          // raw HTTP :contentReference[oaicite:3]{index=3}
      const doc = XmlService.parse(xml);                            // parse XML tree :contentReference[oaicite:4]{index=4}
      const items = doc.getRootElement()
                       .getChild('channel')
                       .getChildren('item')
                       .slice(0, MAX_ITEMS);

      items.forEach(item => rows.push([
        item.getChildText('title'),
        item.getChildText('link'),
        new Date(item.getChildText('pubDate')).toISOString(),
        url
      ]));

    } catch (err) {
      rows.push([`ERROR: ${err.message}`, '', '', url]);
    }
  });

  if (rows.length) {
    const sheet   = SpreadsheetApp.getActive().getSheetByName('data');
    const start   = sheet.getLastRow() + 1;                   // first empty row :contentReference[oaicite:3]{index=3}
    sheet.getRange(start, 1, rows.length, 4)
         .setValues(rows);                                    // no clear(), so it appends
  }
}
