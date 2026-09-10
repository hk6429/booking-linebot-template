/**
 * ============================================================================
 * 🏫 全國校園資訊設備與場地借用小幫手 LINE Bot・通用開源範本 (GAS + Gemini RAG)
 * ============================================================================
 * 專為全台各級學校（國小、國中、高中職、大專院校）資訊組、設備組、總務處與全校教職員設計！
 * 
 * 核心功能：
 * 1. 🔄 每日自動同步校園借用 API：定時排程定時抓取學校借用系統紀錄，匯入 Google 試算表。
 * 2. 💻 資訊設備借用查詢：即時掌握平板車 (iPad/Chromebook)、筆電、觸控筆、實物投影機等借用現況。
 * 3. 🏛️ 校園場地借用查詢：電腦教室、會議室、創客教室、視聽教室、活動中心等時段排程一目了然。
 * 4. 📊 個人學期借用次數與品項統計：老師輸入姓名即可查詢本學期借用總次數、各設備品項借用分佈與近期紀錄。
 * 5. 🤖 Gemini 2.5 自然語言 RAG：支援自然對話（例如「今天下午第三節有人借電腦教室一嗎？」）與精準指令雙軌並行。
 * 6. 📱 內建 WebApp 借用資訊看板：提供校內儀表板即時展示今日借用動態。
 * ============================================================================
 */

const CONFIG = {
  // --------------------------------------------------------------------------
  // 1. 必填金鑰 (請至 Google AI Studio 與 LINE Developers 後台取得)
  // --------------------------------------------------------------------------
  GEMINI_API_KEY: '填入您的_GEMINI_API_KEY',
  LINE_ACCESS_TOKEN: '填入您的_LINE_CHANNEL_ACCESS_TOKEN',

  // --------------------------------------------------------------------------
  // 2. 學校基本設定與學期起始日
  // --------------------------------------------------------------------------
  SCHOOL_NAME: '光明國民中學',                       // 學校名稱（例：竹光國中、光明國中）
  UNIT_NAME: '教務處資訊組',                         // 主管單位（資訊組 / 設備組 / 總務處）
  BOT_NAME: '校園借用小幫手',                        // 機器人名稱
  ADMIN_CONTACT: '資訊組分機 215 / 設備組分機 214',   // 管理單位聯絡電話或分機
  SEMESTER_START_DATE: '2026-08-30',               // 本學期起算日 (YYYY-MM-DD)，用於計算個人本學期借用統計

  // --------------------------------------------------------------------------
  // 3. 校園借用系統 API 串接設定
  // --------------------------------------------------------------------------
  // 學校線上借用系統 API 網址 (GET 請求，系統支援 ?date=YYYY-MM-DD 參數)
  // 若學校尚未開放 API，可留空，系統將自動以 Google 試算表作為主要資料庫並提供模擬展示資料
  BOOKING_API_URL: '',                             // 例: https://your-school.edu.tw/api/bookings
  BOOKING_WEB_URL: '',                             // 學校官方借用系統登入網址 (供 LINE 提供超連結)

  // --------------------------------------------------------------------------
  // 4. 工作表名稱設定
  // --------------------------------------------------------------------------
  SHEET_BOOKINGS: '借用記錄總表',                   // 歷史與今日借用記錄總表
  SHEET_EQUIPMENT: '設備清單',                     // 設備類別、編號與數量設定
  SHEET_VENUES: '場地清單',                       // 場地名稱、容納人數與位置
  SHEET_FAQ: '借用規章與常見問答',                  // 借用辦法、領取時間、賠償規範等知識庫
  SHEET_LOGS: '查詢與操作紀錄',                     // 查詢提問與日誌記錄表
  ADMIN_PASSWORD: ''                              // 手動同步密碼（留空即允許群組管理員直接觸發）
};

// ============================================================================
// 🤖 動態組裝借用管理員 AI 人設 Prompt (System Instruction)
// ============================================================================
function getSystemInstruction() {
  return `你是「${CONFIG.SCHOOL_NAME} ${CONFIG.UNIT_NAME}」的 AI 借用管理助理兼諮詢小幫手「${CONFIG.BOT_NAME}」。

你的職責：
1. 為全校教職員提供親切、準確、即時的「資訊設備」與「場地空間」借用狀態查詢。
2. 協助老師查詢「個人本學期借用紀錄與次數統計」，幫助老師掌握教學資源使用狀況。
3. 解答校內設備借用流程、歸還規範、教室鑰匙借還時間及注意事項。

回覆規範：
• 語言風格：親切有禮、條理分明、精準清晰（繁體中文／台灣習慣用詞）。
• 資訊呈現：善用條列點與 emoji（如 💻 設備、🏛️ 場地、📊 統計、🕒 時段、⚠️ 注意事項）。
• 查詢比對：根據提供的最新即時借用資料與知識庫回答。若時段已有預約，務必提醒借用人與節次；若無人預約，告知該時段目前尚有空檔。
• 節次習慣：台灣校園節次通常為：第1節(08:20~09:05)、第2節(09:15~10:00)、第3節(10:15~11:00)、第4節(11:10~11:55)、第5節(13:10~13:55)、第6節(14:05~14:50)、第7節(15:05~15:50)、第8節/課後輔導(16:00~16:45)。
• 當老師問到無法確認的特殊需求（如跨日外借、大批借用、設備故障報修），請引導洽詢「${CONFIG.ADMIN_CONTACT}」。`;
}

// ============================================================================
// 🌐 Web 儀表板與狀態檢查 (doGet)
// ============================================================================
function doGet(e) {
  const action = (e && e.parameter) ? e.parameter.action : '';
  
  // 提供外部或 Cron 呼叫同步 API
  if (action === 'sync') {
    const result = dailySyncBookingApi();
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  // 預設渲染儀表板 HTML
  try {
    const template = HtmlService.createTemplateFromFile('gas_index');
    template.schoolName = CONFIG.SCHOOL_NAME;
    template.unitName = CONFIG.UNIT_NAME;
    template.botName = CONFIG.BOT_NAME;
    template.todayStr = formatDateStr(getTwNow());
    return template.evaluate()
      .setTitle(`${CONFIG.SCHOOL_NAME} - ${CONFIG.BOT_NAME} 資訊看板`)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return ContentService.createTextOutput(`【${CONFIG.SCHOOL_NAME} ${CONFIG.BOT_NAME} 系統運行中】\n目前時間：${new Date().toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}\n狀態：正常連線`);
  }
}

// ============================================================================
// 📩 LINE Webhook 處理核心 (doPost)
// ============================================================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput('No post data');
    }

    const data = JSON.parse(e.postData.contents);
    const events = data.events;
    if (!events || events.length === 0) {
      return ContentService.createTextOutput('No events');
    }

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.type !== 'message' || event.message.type !== 'text') {
        continue;
      }

      const replyToken = event.replyToken;
      const userMessage = event.message.text.trim();
      const userId = event.source.userId || 'anonymous';
      const sourceType = event.source.type; // user, group, room
      const chatId = (sourceType === 'user') ? userId : (event.source.groupId || event.source.roomId);

      // 群組防打擾過濾：在群組中必須提到機器人名稱或以 # 開頭
      if (sourceType !== 'user') {
        const botTriggerRegex = new RegExp(`(@${escapeRegExp(CONFIG.BOT_NAME)}|#|借用|查詢)`, 'i');
        if (!botTriggerRegex.test(userMessage)) {
          continue;
        }
      }

      // 清理群組標記文字
      const cleanMessage = userMessage.replace(new RegExp(`@${escapeRegExp(CONFIG.BOT_NAME)}\\s*`, 'g'), '').trim();
      if (!cleanMessage) continue;

      // 觸發 LINE 原生「輸入中」動畫 (Chat Loading Indicator)
      if (chatId) {
        showLineLoading(chatId);
      }

      // 1. 快速指令路由：手動觸發 API 同步
      if (/^(#同步|#更新借用|#sync)$/i.test(cleanMessage)) {
        const syncRes = dailySyncBookingApi();
        sendLineReply(replyToken, `🔄 【借用資料同步完成】\n• 成功更新筆數：${syncRes.count} 筆\n• 抓取來源：${syncRes.source}\n• 更新時間：${formatDateTimeStr(getTwNow())}\n\n您現在可輸入「#查設備」或「#查場地」查看最新預約狀態！`);
        continue;
      }

      // 2. 快速指令路由：說明選單
      if (/^(#說明|#功能|#選單|help|\?|說明)$/i.test(cleanMessage)) {
        const helpText = `📋 【${CONFIG.BOT_NAME} 快捷查詢導覽】\n\n` +
          `🔹 資訊設備查詢：\n` +
          `• 輸入「#查設備」或「今天有什麼設備被借了？」\n` +
          `• 輸入「#設備 平板車」或「明天有人借 iPad 車嗎？」\n\n` +
          `🔹 校園場地查詢：\n` +
          `• 輸入「#查場地」或「今天電腦教室借用狀況」\n` +
          `• 輸入「#場地 會議室」或「明天活動中心第3節有空嗎？」\n\n` +
          `🔹 個人學期借用統計：\n` +
          `• 輸入「#查個人 [姓名]」或「#我的借用 [姓名]」\n` +
          `  （例：#查個人 陳乃誠）\n` +
          `  系統將為您統計本學期借用總次數與品項分佈！\n\n` +
          `🔹 借用系統更新：\n` +
          `• 輸入「#同步」立即強制比對校內借用系統。\n\n` +
          `💬 您也可以直接打字提問，AI 助理 24 小時隨時為您解答！`;
        sendLineReply(replyToken, helpText);
        continue;
      }

      // 3. 快速指令路由：查詢資訊設備
      if (/^(#查設備|#設備)(\s*(.*))?$/i.test(cleanMessage)) {
        const match = cleanMessage.match(/^(#查設備|#設備)(\s*(.*))?$/i);
        const subQuery = match && match[3] ? match[3].trim() : '';
        const replyText = handleEquipmentQuery(subQuery);
        sendLineReply(replyToken, replyText);
        logConversation(cleanMessage, replyText, userId);
        continue;
      }

      // 4. 快速指令路由：查詢校園場地
      if (/^(#查場地|#場地)(\s*(.*))?$/i.test(cleanMessage)) {
        const match = cleanMessage.match(/^(#查場地|#場地)(\s*(.*))?$/i);
        const subQuery = match && match[3] ? match[3].trim() : '';
        const replyText = handleVenueQuery(subQuery);
        sendLineReply(replyToken, replyText);
        logConversation(cleanMessage, replyText, userId);
        continue;
      }

      // 5. 快速指令路由：查詢個人學期借用統計
      if (/^(#查個人|#我的借用|#個人借用)(\s*(.*))?$/i.test(cleanMessage)) {
        const match = cleanMessage.match(/^(#查個人|#我的借用|#個人借用)(\s*(.*))?$/i);
        const teacherName = match && match[3] ? match[3].trim() : '';
        if (!teacherName) {
          sendLineReply(replyToken, `請在指令後方加上您的姓名，例如：\n「#查個人 陳乃誠」或「#我的借用 王小明」`);
          continue;
        }
        const replyText = handleTeacherStatsQuery(teacherName);
        sendLineReply(replyToken, replyText);
        logConversation(cleanMessage, replyText, userId);
        continue;
      }

      // 6. 自然語言提問：走 RAG + Gemini AI 智慧理解
      const aiResponse = generateAiResponse(cleanMessage, userId);
      sendLineReply(replyToken, aiResponse);
      logConversation(cleanMessage, aiResponse, userId);
    }

    return ContentService.createTextOutput('OK');
  } catch (err) {
    console.error('doPost Error:', err);
    return ContentService.createTextOutput('Error: ' + err.toString());
  }
}

// ============================================================================
// 🔄 每日定時自動同步 API 核心 (Time-driven Trigger Target)
// ============================================================================
/**
 * 每日自動執行：抓取學校借用系統 API 並更新至 Google 試算表。
 * 建議設定定時觸發器：每天早上 06:30 或 07:00 執行一次。
 */
function dailySyncBookingApi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_BOOKINGS);
  if (!sheet) {
    initBookingSystemSheet();
    sheet = ss.getSheetByName(CONFIG.SHEET_BOOKINGS);
  }

  let fetchedList = [];
  let sourceName = '校園借用系統 API';

  // 1. 若有設定 API URL，發送 HTTP GET 請求
  if (CONFIG.BOOKING_API_URL && CONFIG.BOOKING_API_URL.trim() !== '') {
    try {
      const todayStr = formatDateStr(getTwNow());
      const urlWithParams = CONFIG.BOOKING_API_URL.includes('?') 
        ? `${CONFIG.BOOKING_API_URL}&date=${todayStr}` 
        : `${CONFIG.BOOKING_API_URL}?date=${todayStr}`;
      
      const response = UrlFetchApp.fetch(urlWithParams, {
        muteHttpExceptions: true,
        headers: { 'Accept': 'application/json' }
      });

      if (response.getResponseCode() === 200) {
        const json = JSON.parse(response.getContentText());
        fetchedList = normalizeApiBookingData(json);
      } else {
        console.warn('API returned non-200 status:', response.getResponseCode());
      }
    } catch (e) {
      console.error('dailySyncBookingApi fetch error:', e);
    }
  }

  // 2. 若未設定 API 或 API 無回傳，檢查是否有現有資料；若試算表空白則載入示範種子資料
  if (fetchedList.length === 0) {
    const existingRows = sheet.getLastRow();
    if (existingRows <= 1) {
      fetchedList = getSampleBookingSeedData();
      sourceName = '內建標準測試資料（請於 CONFIG 填入學校 API 網址）';
    } else {
      sourceName = '本地試算表資料庫 (API 無新異動)';
      return { success: true, count: existingRows - 1, source: sourceName };
    }
  }

  // 3. 匯入試算表（依據 複合鍵 進行防重複比對）
  const updatedCount = mergeBookingsIntoSheet(sheet, fetchedList);

  return {
    success: true,
    count: updatedCount,
    source: sourceName,
    time: formatDateTimeStr(getTwNow())
  };
}

/**
 * 彈性適配各種學校借用系統的 JSON 格式
 */
function normalizeApiBookingData(json) {
  const result = [];
  let rawItems = [];

  if (Array.isArray(json)) {
    rawItems = json;
  } else if (json && Array.isArray(json.bookings)) {
    rawItems = json.bookings;
  } else if (json && Array.isArray(json.data)) {
    rawItems = json.data;
  } else if (json && (json.tablets || json.venues || json.equipment)) {
    rawItems = [
      ...(json.tablets || []).map(x => ({ ...x, category: '資訊設備' })),
      ...(json.equipment || []).map(x => ({ ...x, category: '資訊設備' })),
      ...(json.venues || []).map(x => ({ ...x, category: '校園場地' }))
    ];
  }

  rawItems.forEach(item => {
    const date = item.date || item.day || item.booking_date || formatDateStr(getTwNow());
    const category = item.category || (isVenueName(item.item || item.name || '') ? '校園場地' : '資訊設備');
    const itemName = item.item || item.name || item.title || item.equipment_name || item.venue_name || '未註明項目';
    const teacher = item.teacher || item.user || item.applicant || item.borrower || item.name || '未具名教席';
    
    let periods = item.periods || item.period || item.time || item.section || '全日';
    if (Array.isArray(periods)) {
      periods = periods.join('、');
    }

    const regTime = item.reg_time || item.created_at || formatDateTimeStr(getTwNow());
    const status = item.status || item.return_status || '已預約登記';
    const note = item.note || item.memo || '';

    result.push([date, category, itemName, teacher, periods, status, regTime, note]);
  });

  return result;
}

/**
 * 合併寫入試算表，避免重複插入相同資料
 */
function mergeBookingsIntoSheet(sheet, rows) {
  if (!rows || rows.length === 0) return 0;

  const lastRow = sheet.getLastRow();
  let existingKeys = new Set();

  if (lastRow > 1) {
    const existingData = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    existingData.forEach(r => {
      // 複合鍵: 日期_類別_品項_借用人_節次
      const key = `${r[0]}_${r[1]}_${r[2]}_${r[3]}_${r[4]}`;
      existingKeys.add(key);
    });
  }

  const newRows = [];
  rows.forEach(r => {
    const key = `${r[0]}_${r[1]}_${r[2]}_${r[3]}_${r[4]}`;
    if (!existingKeys.has(key)) {
      newRows.push(r);
      existingKeys.add(key);
    }
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  }

  return newRows.length;
}

// ============================================================================
// 🔍 核心查詢模組 1：資訊設備借用查詢
// ============================================================================
function handleEquipmentQuery(subQuery) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_BOOKINGS);
  if (!sheet || sheet.getLastRow() <= 1) {
    return `💻 【資訊設備借用現況】\n目前系統中尚無設備借用紀錄。若需預約請洽資訊組！`;
  }

  const data = sheet.getDataRange().getValues();
  const todayStr = formatDateStr(getTwNow());
  const tomorrowStr = formatDateStr(new Date(getTwNow().getTime() + 24 * 3600 * 1000));

  let targetDate = todayStr;
  let targetDateLabel = '今日';
  if (subQuery && (subQuery.includes('明天') || subQuery.includes('明日'))) {
    targetDate = tomorrowStr;
    targetDateLabel = '明日';
  }

  const matches = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rDate = String(row[0]).trim();
    const rCat = String(row[1]).trim();
    const rItem = String(row[2]).trim();
    const rTeacher = String(row[3]).trim();
    const rPeriods = String(row[4]).trim();
    const rStatus = String(row[5]).trim();

    if (rCat === '資訊設備') {
      const matchDate = (rDate === targetDate);
      const matchItem = !subQuery || rItem.toLowerCase().includes(subQuery.toLowerCase()) || subQuery.includes(rItem);

      if (matchDate && matchItem) {
        matches.push({ item: rItem, teacher: rTeacher, periods: rPeriods, status: rStatus });
      }
    }
  }

  let reply = `💻 【${targetDateLabel} (${targetDate}) 資訊設備借用明細】\n`;
  if (matches.length === 0) {
    reply += `目前此時段尚無人預約借用設備，若需使用歡迎及早登記！\n`;
  } else {
    reply += `共 ${matches.length} 筆借用預約：\n\n`;
    matches.forEach((m, idx) => {
      reply += `${idx + 1}. 【${m.item}】\n   👤 借用老師：${m.teacher}\n   🕒 借用節次：${m.periods}\n   📌 狀態：${m.status}\n\n`;
    });
  }

  reply += `💡 溫馨提醒：課堂使用完畢請協助清點配件（充電線、觸控筆），並於放學前歸還至資訊組充電。`;
  if (CONFIG.BOOKING_WEB_URL) {
    reply += `\n🔗 線上借用登記系統：${CONFIG.BOOKING_WEB_URL}`;
  }
  return reply.trim();
}

// ============================================================================
// 🔍 核心查詢模組 2：校園場地借用查詢
// ============================================================================
function handleVenueQuery(subQuery) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_BOOKINGS);
  if (!sheet || sheet.getLastRow() <= 1) {
    return `🏛️ 【校園場地借用現況】\n目前系統中尚無場地借用紀錄。若需預約請洽主管單位登記！`;
  }

  const data = sheet.getDataRange().getValues();
  const todayStr = formatDateStr(getTwNow());
  const tomorrowStr = formatDateStr(new Date(getTwNow().getTime() + 24 * 3600 * 1000));

  let targetDate = todayStr;
  let targetDateLabel = '今日';
  if (subQuery && (subQuery.includes('明天') || subQuery.includes('明日'))) {
    targetDate = tomorrowStr;
    targetDateLabel = '明日';
  }

  const matches = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rDate = String(row[0]).trim();
    const rCat = String(row[1]).trim();
    const rItem = String(row[2]).trim();
    const rTeacher = String(row[3]).trim();
    const rPeriods = String(row[4]).trim();
    const rStatus = String(row[5]).trim();

    if (rCat === '校園場地') {
      const matchDate = (rDate === targetDate);
      const matchItem = !subQuery || rItem.toLowerCase().includes(subQuery.toLowerCase()) || subQuery.includes(rItem);

      if (matchDate && matchItem) {
        matches.push({ venue: rItem, teacher: rTeacher, periods: rPeriods, status: rStatus });
      }
    }
  }

  let reply = `🏛️ 【${targetDateLabel} (${targetDate}) 校園場地預約排程】\n`;
  if (matches.length === 0) {
    reply += `今日校園各專科教室與會議場地目前均無登記借用，尚有充裕空檔！\n`;
  } else {
    reply += `共 ${matches.length} 筆場地登記：\n\n`;
    matches.forEach((m, idx) => {
      reply += `${idx + 1}. 【${m.venue}】\n   👤 使用人：${m.teacher}\n   🕒 時段：${m.periods}\n   📌 狀態：${m.status}\n\n`;
    });
  }

  reply += `💡 提醒：借用電腦教室、創客教室請於前一日領取鑰匙；使用後請務必關閉冷氣電源並上鎖。`;
  return reply.trim();
}

// ============================================================================
// 🔍 核心查詢模組 3：個人借用紀錄與學期次數統計
// ============================================================================
function handleTeacherStatsQuery(teacherName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_BOOKINGS);
  if (!sheet || sheet.getLastRow() <= 1) {
    return `📊 查無借用資料庫記錄。`;
  }

  const data = sheet.getDataRange().getValues();
  const semesterStart = CONFIG.SEMESTER_START_DATE || '2026-08-01';

  let totalCount = 0;
  const itemFrequency = {};
  const recentRecords = [];
  const todayStr = formatDateStr(getTwNow());
  const todayBookings = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rDate = String(row[0]).trim();
    const rCat = String(row[1]).trim();
    const rItem = String(row[2]).trim();
    const rTeacher = String(row[3]).trim();
    const rPeriods = String(row[4]).trim();
    const rStatus = String(row[5]).trim();

    // 比對老師姓名（支援模糊匹配或包含關係）
    if (rTeacher.includes(teacherName) || teacherName.includes(rTeacher)) {
      // 判斷是否落在本學期範圍
      if (rDate >= semesterStart) {
        totalCount++;
        itemFrequency[rItem] = (itemFrequency[rItem] || 0) + 1;

        recentRecords.push({
          date: rDate,
          cat: rCat,
          item: rItem,
          periods: rPeriods,
          status: rStatus
        });

        if (rDate === todayStr) {
          todayBookings.push({ item: rItem, periods: rPeriods });
        }
      }
    }
  }

  if (totalCount === 0) {
    return `📊 【個人借用紀錄查詢・${teacherName} 老師】\n\n自本學期起 (${semesterStart})，查無 ${teacherName} 老師的設備或場地借用紀錄。\n\n若您有借用需求，可隨時洽詢資訊組或至線上系統登記！`;
  }

  // 排序借用頻率最高的品項
  const sortedItems = Object.entries(itemFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `• ${name}：共借用 ${count} 次`);

  // 取最近 5 筆借用
  recentRecords.sort((a, b) => b.date.localeCompare(a.date));
  const top5Records = recentRecords.slice(0, 5);

  let reply = `📊 【個人借用紀錄統計報告】\n👤 查詢教席：${teacherName} 老師\n📅 統計區間：本學期 (${semesterStart} 至今)\n\n` +
    `📈 【學期借用總計】：共 ${totalCount} 次\n\n` +
    `📦 【借用品項與次數排行】：\n${sortedItems.join('\n')}\n\n` +
    `🕒 【最近 5 次借用軌跡】：\n`;

  top5Records.forEach(r => {
    reply += `• ${r.date}（${r.periods}）：${r.item} [${r.status}]\n`;
  });

  if (todayBookings.length > 0) {
    reply += `\n🔔 【今日預約提醒】：\n您今天有預約「${todayBookings.map(b => b.item + ' (' + b.periods + ')').join('、')}」，請記得至資訊組領取或按時前往使用喔！`;
  }

  return reply.trim();
}

// ============================================================================
// 🧠 Gemini 自然語言 RAG 生成回覆
// ============================================================================
function generateAiResponse(userQuery, userId) {
  if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY.includes('填入您的')) {
    return `⚠️ 尚未完成 Gemini API Key 設定，請至程式碼 CONFIG 中填入金鑰。\n您仍可使用「#查設備」、「#查場地」、「#查個人 [姓名]」進行快速查詢！`;
  }

  // 1. 抓取近期即時借用狀態作為 Prompt 上下文
  const liveBookingsContext = getLiveBookingsSummaryContext();
  // 2. 抓取常見問題 FAQ 與規範
  const faqContext = getFaqKnowledgeBaseContext();

  const fullPrompt = `${getSystemInstruction()}

【即時借用系統現況（今日與近期預約）】：
${liveBookingsContext}

【校內設備與場地管理規範 FAQ】：
${faqContext}

【老師目前提問】：
${userQuery}

請根據以上即時資料與管理規範，以溫暖、清晰且專業的繁體中文口吻回答老師：`;

  // 呼叫 Gemini API
  const authorizedModels = getAuthorizedGoogleModels(CONFIG.GEMINI_API_KEY);
  let lastError = null;

  for (let i = 0; i < authorizedModels.length; i++) {
    const modelName = authorizedModels[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
      const payload = {
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 900
        }
      };

      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      if (response.getResponseCode() === 200) {
        const resJson = JSON.parse(response.getContentText());
        if (resJson.candidates && resJson.candidates.length > 0) {
          const rawText = resJson.candidates[0].content.parts[0].text;
          return sanitizeLineFormat(rawText);
        }
      } else {
        lastError = response.getContentText();
      }
    } catch (e) {
      lastError = e.toString();
    }
  }

  console.error('Gemini API Error:', lastError);
  return `抱歉，AI 系統連線稍有延遲。您可以直接輸入「#查設備」或「#查場地」查看今日預約狀況，或洽詢 ${CONFIG.ADMIN_CONTACT}！`;
}

function getLiveBookingsSummaryContext() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_BOOKINGS);
  if (!sheet || sheet.getLastRow() <= 1) {
    return '（目前借用總表中暫無預約登記）';
  }

  const data = sheet.getDataRange().getValues();
  const todayStr = formatDateStr(getTwNow());
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rDate = String(row[0]).trim();
    if (rDate >= todayStr) {
      rows.push(`- 日期: ${rDate} | 類別: ${row[1]} | 項目: ${row[2]} | 借用人: ${row[3]} | 節次: ${row[4]} | 狀態: ${row[5]}`);
    }
  }

  return rows.length > 0 ? rows.slice(0, 30).join('\n') : '（今日與後續日期目前皆尚無登記紀錄）';
}

function getFaqKnowledgeBaseContext() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_FAQ);
  if (!sheet || sheet.getLastRow() <= 1) {
    return '（若無明載規範，以資訊組日常借用辦法為準）';
  }

  const data = sheet.getDataRange().getValues();
  const faqs = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][1]) {
      faqs.push(`Q: ${data[i][0]}\nA: ${data[i][1]}`);
    }
  }
  return faqs.join('\n\n');
}

// ============================================================================
// 📱 LINE 通訊輔助工具 (Reply / Loading Animation / Sanitizer)
// ============================================================================
function sendLineReply(replyToken, messageText) {
  if (!CONFIG.LINE_ACCESS_TOKEN || CONFIG.LINE_ACCESS_TOKEN.includes('填入您的')) {
    console.warn('LINE_ACCESS_TOKEN not configured.');
    return;
  }

  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = {
    replyToken: replyToken,
    messages: [{
      type: 'text',
      text: messageText
    }]
  };

  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.LINE_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function showLineLoading(chatId) {
  if (!CONFIG.LINE_ACCESS_TOKEN || CONFIG.LINE_ACCESS_TOKEN.includes('填入您的') || !chatId) return;
  try {
    const url = 'https://api.line.me/v2/bot/chat/loading/start';
    UrlFetchApp.fetch(url, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CONFIG.LINE_ACCESS_TOKEN
      },
      payload: JSON.stringify({ chatId: chatId, loadingSeconds: 15 }),
      muteHttpExceptions: true
    });
  } catch (e) {
    // 略過 loading 失敗例外
  }
}

function sanitizeLineFormat(text) {
  if (!text) return '';
  return text.replace(/\*\*(.*?)\*\*/g, '「$1」').trim();
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTwNow() {
  const now = new Date();
  return new Date(now.getTime() + (8 * 3600 * 1000) + (now.getTimezoneOffset() * 60000));
}

function formatDateStr(date) {
  const y = date.getFullYear();
  const m = ('0' + (date.getMonth() + 1)).slice(-2);
  const d = ('0' + date.getDate()).slice(-2);
  return `${y}-${m}-${d}`;
}

function formatDateTimeStr(date) {
  const timeStr = date.toTimeString().split(' ')[0];
  return `${formatDateStr(date)} ${timeStr}`;
}

function isVenueName(name) {
  return /(教室|中心|會議室|館|室|講堂|球場|操場|舞台)/i.test(name);
}

function getAuthorizedGoogleModels(apiKey) {
  return ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
}

function logConversation(query, reply, userId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName(CONFIG.SHEET_LOGS);
    if (!logSheet) {
      logSheet = ss.insertSheet(CONFIG.SHEET_LOGS);
      logSheet.appendRow(['紀錄時間', '使用者ID', '查詢內容', '回覆摘要']);
    }
    logSheet.appendRow([formatDateTimeStr(getTwNow()), userId, query, reply.substring(0, 150)]);
  } catch (e) {
    console.error('logConversation error:', e);
  }
}

// ============================================================================
// 🚀 一鍵初始化試算表與種子資料 (initBookingSystemSheet)
// ============================================================================
function initBookingSystemSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. 建立「借用記錄總表」
  let bSheet = ss.getSheetByName(CONFIG.SHEET_BOOKINGS);
  if (!bSheet) {
    bSheet = ss.insertSheet(CONFIG.SHEET_BOOKINGS);
    bSheet.appendRow(['借用日期', '類別', '品項/場地名稱', '借用人', '借用節次', '借用狀態', '登記時間', '備註說明']);
    bSheet.getRange('A1:H1').setBackground('#0284c7').setFontColor('#ffffff').setFontWeight('bold');
    
    // 注入完整示範種子資料
    const seedData = getSampleBookingSeedData();
    bSheet.getRange(2, 1, seedData.length, seedData[0].length).setValues(seedData);
  }

  // 2. 建立「設備清單」
  let eqSheet = ss.getSheetByName(CONFIG.SHEET_EQUIPMENT);
  if (!eqSheet) {
    eqSheet = ss.insertSheet(CONFIG.SHEET_EQUIPMENT);
    eqSheet.appendRow(['設備名稱', '總數量', '存放地點', '配件說明', '借用限制']);
    eqSheet.getRange('A1:E1').setBackground('#0284c7').setFontColor('#ffffff').setFontWeight('bold');
    eqSheet.appendRow(['iPad 行動學習車 A', '30 台', '資訊組', '附專用充電線與多孔充電車', '限校內上課使用']);
    eqSheet.appendRow(['iPad 行動學習車 B', '30 台', '資訊組', '附專用充電線與多孔充電車', '限校內上課使用']);
    eqSheet.appendRow(['Chromebook 移動車', '30 台', '教務處', '專用變壓器與車箱', '提供 Google Classroom 課程']);
    eqSheet.appendRow(['教師教學筆記型電腦', '15 台', '資訊組', '附滑鼠與電源線', '當日歸還']);
    eqSheet.appendRow(['Apple Pencil 觸控筆組', '30 支', '資訊組', '筆尖防磨套', '隨車或單獨借用']);
    eqSheet.appendRow(['高畫質實物投影機', '4 台', '設備組', '附 HDMI 線', '隨借隨還']);
    eqSheet.appendRow(['4K 活動錄影單眼相機', '2 組', '資訊組', '含腳架與麥克風', '大型活動請提前三日預約']);
  }

  // 3. 建立「場地清單」
  let vSheet = ss.getSheetByName(CONFIG.SHEET_VENUES);
  if (!vSheet) {
    vSheet = ss.insertSheet(CONFIG.SHEET_VENUES);
    vSheet.appendRow(['場地名稱', '容納人數', '所在位置', '場地設備', '負責單位']);
    vSheet.getRange('A1:E1').setBackground('#0284c7').setFontColor('#ffffff').setFontWeight('bold');
    vSheet.appendRow(['電腦教室 (一)', '45 人', '圖資大樓 3F', '40台PC、電子白板、廣播系統', '資訊組']);
    vSheet.appendRow(['電腦教室 (二)', '45 人', '圖資大樓 3F', '40台PC、高畫質投影機', '資訊組']);
    vSheet.appendRow(['創客自造教室', '36 人', '工藝大樓 1F', '3D列印機、雷雕機、手工具', '設備組']);
    vSheet.appendRow(['第一會議室', '30 人', '行政大樓 2F', '視訊會議設備、大型投影幕', '總務處']);
    vSheet.appendRow(['階梯視聽教室', '120 人', '學生活動中心 2F', '專業音響、雙投影布幕、無線麥克風', '學務處']);
    vSheet.appendRow(['室內活動中心體育館', '800 人', '活動中心 1F', '籃球場、羽球場、音響控制台', '體育組']);
  }

  // 4. 建立「借用規章與常見問答 FAQ」
  let faqSheet = ss.getSheetByName(CONFIG.SHEET_FAQ);
  if (!faqSheet) {
    faqSheet = ss.insertSheet(CONFIG.SHEET_FAQ);
    faqSheet.appendRow(['問題或規範主題', '詳細內容說明', '主管分機']);
    faqSheet.getRange('A1:C1').setBackground('#0284c7').setFontColor('#ffffff').setFontWeight('bold');
    faqSheet.appendRow(['平板車借用與領取時間', '請於上課前 10 分鐘至資訊組簽名領取，課後放學前（16:30前）全數清點插電歸還。', '資訊組分機 215']);
    faqSheet.appendRow(['電腦教室使用守則', '教室內全面禁止攜帶開水以外之飲食；下課前請引導學生正常關機並將鍵盤滑鼠歸位。', '資訊組分機 215']);
    faqSheet.appendRow(['場地鑰匙借還規定', '專科教室與會議室鑰匙請於使用當天至守衛室或總務處領取，使用完畢確認門窗電源後立即交回。', '總務處分機 231']);
    faqSheet.appendRow(['設備若有故障如何報修', '請於還件時向管理人員說明異常狀況，或至校內智慧報修系統填報財產編號。', '資訊組分機 215']);
    faqSheet.appendRow(['跨日或週末借用辦法', '如因校隊集訓或校外競賽需跨週末借用，需事先簽會相關處室主任核准。', '教務處分機 211']);
  }

  // 5. 建立「查詢與操作紀錄」
  let logSheet = ss.getSheetByName(CONFIG.SHEET_LOGS);
  if (!logSheet) {
    logSheet = ss.insertSheet(CONFIG.SHEET_LOGS);
    logSheet.appendRow(['紀錄時間', '使用者ID', '查詢內容', '回覆摘要']);
    logSheet.getRange('A1:D1').setBackground('#64748b').setFontColor('#ffffff').setFontWeight('bold');
  }

  return '✅ 借用系統試算表結構與示範資料庫已成功初始化完成！';
}

/**
 * 取得示範借用記錄種子資料
 */
function getSampleBookingSeedData() {
  const todayStr = formatDateStr(getTwNow());
  const tomorrowStr = formatDateStr(new Date(getTwNow().getTime() + 24 * 3600 * 1000));
  const yesterdayStr = formatDateStr(new Date(getTwNow().getTime() - 24 * 3600 * 1000));
  const pastWeekStr = formatDateStr(new Date(getTwNow().getTime() - 7 * 24 * 3600 * 1000));

  return [
    [todayStr, '資訊設備', 'iPad 行動學習車 A', '陳乃誠', '第 1、2 節', '借用中', todayStr + ' 07:45', '國文科數位閱讀評量'],
    [todayStr, '校園場地', '電腦教室 (一)', '林志強', '第 3、4 節', '已預約登記', todayStr + ' 08:10', '七年級資訊科技課'],
    [todayStr, '資訊設備', 'Chromebook 移動車', '張雅晴', '第 5、6 節', '已預約登記', todayStr + ' 08:30', '八年級社會領域探究實作'],
    [todayStr, '校園場地', '第一會議室', '教務主任', '第 7 節', '已預約登記', todayStr + ' 09:00', '領域召集人行政工作會議'],
    [tomorrowStr, '校園場地', '階梯視聽教室', '學務處訓育組', '第 3、4 節', '已預約登記', todayStr + ' 09:30', '全校法治教育專題講座'],
    [tomorrowStr, '資訊設備', '4K 活動錄影單眼相機', '陳乃誠', '第 3、4 節', '已預約登記', todayStr + ' 10:15', '支援視聽教室講座側錄紀錄'],
    [yesterdayStr, '資訊設備', 'iPad 行動學習車 A', '陳乃誠', '第 5、6 節', '已歸還', yesterdayStr + ' 08:00', '國文課Padlet小組討論'],
    [yesterdayStr, '校園場地', '電腦教室 (一)', '陳乃誠', '第 7 節', '已歸還', yesterdayStr + ' 08:00', '資訊科技自主學習'],
    [pastWeekStr, '資訊設備', 'iPad 行動學習車 A', '陳乃誠', '第 2、3 節', '已歸還', pastWeekStr + ' 08:00', '閱讀素養評量'],
    [pastWeekStr, '校園場地', '創客自造教室', '王建華', '第 5、6 節', '已歸還', pastWeekStr + ' 08:00', '生科雷射雕刻實作']
  ];
}
