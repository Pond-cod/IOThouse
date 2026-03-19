// ============================================================
// Google Apps Script – IOT_HOUSE  (Code.gs)
// Sheet: SmartHome_Logs → Tab: ชีต1
// Columns: Timestamp | Zone | Light | Action | Duration (Hours) | Cost (Baht)
// ============================================================

var SHEET_NAME = "ชีต1";        // ชื่อ tab ที่เก็บ log
var RATE_PER_HOUR = 5;           // อัตราค่าไฟ ฿ ต่อชั่วโมง

// ── doPost: รับข้อมูล toggle จาก frontend ────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    var timestamp = new Date();
    var zone = data.zone || "";
    var light = data.light || "";
    var action = (data.action || "").toUpperCase();

    var duration = "";
    var cost = "";

    // ถ้า action = OFF → คำนวณ Duration จาก ON ก่อนหน้า
    if (action === "OFF" && zone !== "All") {
      var rows = sheet.getDataRange().getValues();
      // หา ON ล่าสุดของ zone+light นี้
      for (var i = rows.length - 1; i >= 1; i--) {
        var rowZone = String(rows[i][1]);
        var rowLight = String(rows[i][2]);
        var rowAction = String(rows[i][3]).toUpperCase();
        if (rowZone === zone && rowLight === light && rowAction === "ON") {
          var onTime = new Date(rows[i][0]);
          var diffMs = timestamp.getTime() - onTime.getTime();
          var diffHrs = diffMs / (1000 * 60 * 60);
          if (diffHrs > 0 && diffHrs < 24) {
            duration = diffHrs;
            cost = diffHrs * RATE_PER_HOUR;
          }
          break;
        }
      }
    }

    sheet.appendRow([timestamp, zone, light, action, duration, cost]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── doGet: ส่งข้อมูลสรุป + รายงาน ──────────────────────────
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    var rows = sheet.getDataRange().getValues();
    var dataRows = rows.slice(1); // ข้าม header

    var individual = {};   // key: "zone_light" → { hours, cost }
    var dailyMap = {};     // key: "YYYY-MM-DD" → totalHours
    var monthlyMap = {};   // key: "YYYY-MM" → totalHours

    for (var i = 0; i < dataRows.length; i++) {
      var ts = new Date(dataRows[i][0]);
      var zone = String(dataRows[i][1]);
      var light = String(dataRows[i][2]);
      var action = String(dataRows[i][3]).toUpperCase();
      var durVal = dataRows[i][4];
      var costVal = dataRows[i][5];

      // ใช้ค่า Duration/Cost จากคอลัมน์ E, F (คำนวณไว้ตอน OFF)
      if (action === "OFF" && zone !== "All" && durVal !== "" && durVal > 0) {
        var hrs = parseFloat(durVal);
        var cst = parseFloat(costVal) || hrs * RATE_PER_HOUR;
        var key = zone + "_" + light;

        if (!individual[key]) {
          individual[key] = { hours: 0, cost: 0 };
        }
        individual[key].hours += hrs;
        individual[key].cost += cst;

        // Daily
        var dayKey = Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyy-MM-dd");
        dailyMap[dayKey] = (dailyMap[dayKey] || 0) + hrs;

        // Monthly
        var monthKey = Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyy-MM");
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + hrs;
      }
    }

    // รวม totalHours, totalCost
    var totalHours = 0;
    var totalCost = 0;
    for (var k in individual) {
      individual[k].hours = parseFloat(individual[k].hours.toFixed(4));
      individual[k].cost = parseFloat(individual[k].cost.toFixed(4));
      totalHours += individual[k].hours;
      totalCost += individual[k].cost;
    }

    // Daily Report (เรียงวันล่าสุดก่อน)
    var dailyReport = [];
    for (var d in dailyMap) {
      dailyReport.push({
        date: d,
        hours: parseFloat(dailyMap[d].toFixed(2)),
        cost: parseFloat((dailyMap[d] * RATE_PER_HOUR).toFixed(2))
      });
    }
    dailyReport.sort(function (a, b) { return b.date.localeCompare(a.date); });

    // Monthly Report (เรียงเดือนล่าสุดก่อน)
    var monthlyReport = [];
    for (var m in monthlyMap) {
      monthlyReport.push({
        month: m,
        hours: parseFloat(monthlyMap[m].toFixed(2)),
        cost: parseFloat((monthlyMap[m] * RATE_PER_HOUR).toFixed(2))
      });
    }
    monthlyReport.sort(function (a, b) { return b.month.localeCompare(a.month); });

    var result = {
      totalHours: parseFloat(totalHours.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      individual: individual,
      dailyReport: dailyReport,
      monthlyReport: monthlyReport
    };

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        totalHours: 0, totalCost: 0,
        individual: {}, dailyReport: [], monthlyReport: [],
        error: err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
