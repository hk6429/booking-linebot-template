# 🏫 校園資訊設備與場地借用小幫手 LINE Bot・開源通用範本

> **專為全台各級學校資訊組、設備組、總務處與全校教職員量身打造的 24 小時智慧借用助理！**  
> 每日自動透過學校官方借用系統 API 抓取借用紀錄，結合 Google 試算表與 Gemini 2.5 自然語言 RAG，老師用手機 LINE 隨時查設備、查場地，還能一鍵統計個人本學期借用頻率！

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Google Apps Script](https://img.shields.io/badge/Platform-Google%20Apps%20Script-4285F4.svg?logo=google)](https://script.google.com)
[![LINE Messaging API](https://img.shields.io/badge/LINE-Messaging%20API-00C300.svg?logo=line)](https://developers.line.biz)
[![Gemini 2.5 RAG](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-8E75B2.svg?logo=google-gemini)](https://ai.google.dev)
[![Netlify Status](https://api.netlify.com/api/v1/badges/your-badge/deploy-status)](https://booking-linebot-template.netlify.app)

🌐 **線上互動體驗與參數產生器**：[https://booking-linebot-template.netlify.app](https://booking-linebot-template.netlify.app)

---

## 🌟 核心功能特色

### 1. 🔄 每日定時自動同步校園借用系統 API (Daily Auto-Sync)
- **零人工抄寫維護**：透過 GAS 時間驅動觸發器（每天早上 06:30 或 07:00），自動以 GET 請求抓取學校官方借用系統 API。
- **智能防重複機制**：以複合鍵（日期＋類別＋品項＋借用人＋節次）自動比對，杜絕重複登記。
- **隨選即時同步**：在 LINE 中輸入 `#同步` 或 `#更新借用`，即可強制立即連線校內 API 刷新資料。

### 2. 💻 資訊設備借用查詢
- **涵蓋設備**：iPad 行動學習車、Chromebook 移動車、教師筆電、觸控筆、實物投影機、4K 錄影單眼相機等。
- **即時掌握**：清晰列出借用人、使用節次、借用狀態（借用中 / 已預約登記 / 已歸還）。
- **快捷指令**：
  - `#查設備`：列出今日所有設備預約清單。
  - `#設備 平板車`：篩選特定設備借用狀況。
  - 自然語言詢問：「今天下午第5節有空閒的 iPad 車嗎？」

### 3. 🏛️ 校園場地借用查詢
- **涵蓋場地**：電腦教室(一/二)、創客自造教室、第一會議室、階梯視聽教室、室內體育館等。
- **時段衝突防範**：即時回報衝堂時段與空檔時段，提醒鑰匙借還地點與電源關閉注意事項。
- **快捷指令**：
  - `#查場地`：列出今日各專科教室與會議空間預約排程。
  - `#場地 電腦教室`：指定教室查詢。
  - 自然語言詢問：「明天視聽教室有人登記嗎？」

### 4. 📊 個人學期借用統計報告
- **全台首創功能**：輸入老師姓名，系統以 `SEMESTER_START_DATE` 為基準，自動計算：
  - 📈 本學期累計借用總次數。
  - 📦 借用品項次數排行（如：iPad 車 12次、電腦教室 8次、單眼相機 2次）。
  - 🕒 最近 5 次借用軌跡與狀態。
  - 🔔 今日借用提醒（若當日有預約，貼心提示記得至資訊組領取或使用）。
- **快捷指令**：
  - `#查個人 陳乃誠` 或 `#我的借用 林志強`

### 5. 🤖 Gemini 2.5 自然語言 RAG
- 整合校內管理規章、常見問題 FAQ 與即時借用狀態，老師不用死記特定指令，以自然的口吻打字發問，AI 即刻提供親切、清晰的台灣在地化回答。

---

## 🚀 四步驟極速部署教學 (5 分鐘上線)

### 步驟 1：建立 Google 試算表並貼上程式碼
1. 開啟 [Google 試算表](https://sheets.new)，建立一份新試算表（例如命名為「光明國中-資訊設備與場地借用資料庫」）。
2. 點擊頂端選單 **「擴充功能」➔「Apps Script」**。
3. 清空編輯器預設程式碼，將本專案的 [`Code.gs`](./Code.gs) 複製貼上。
4. 在上方 `CONFIG` 物件中填入您的：
   - `GEMINI_API_KEY`（至 [Google AI Studio](https://aistudio.google.com/) 免費取得）
   - `LINE_ACCESS_TOKEN`（至 [LINE Developers](https://developers.line.biz/) 後台取得）
   - 學校名稱、主管單位、學期起算日與官方 API 網址（若無可留空）。

### 步驟 2：執行一鍵初始化
1. 在 Apps Script 編輯器上方函式選單中選擇 **`initBookingSystemSheet`**。
2. 點擊 **「執行」**（初次執行請授權試算表權限）。
3. 系統將自動為您生成：
   - `借用記錄總表`（含示範種子資料）
   - `設備清單`（設備存放與配件規格）
   - `場地清單`（各專科教室位置與容量）
   - `借用規章與常見問答`（FAQ 知識庫）
   - `查詢與操作紀錄`

### 步驟 3：部署為網頁並設定 LINE Webhook
1. 點擊編輯器右上角 **「部署」➔「新增部署作業」**。
2. 齒輪圖示選擇 **「網頁應用程式 (Web App)」**。
   - 說明：`v1`
   - 執行身分：`我`
   - 誰可以存取：`所有人 (Anyone)`
3. 點擊「部署」，複製產出的 **網頁應用程式網址 (Current web app URL)**。
4. 進入 [LINE Developers Console](https://developers.line.biz/)，點入您的 Messaging API Channel：
   - 將網址貼至 **Webhook URL**。
   - 開啟 **Use webhook** 開關。
   - 點擊 **Verify** 測試連線（顯示 Success 即代表成功！）。

### 步驟 4：設定每日定時自動同步觸發器
1. 在 Apps Script 左側選單點擊鬧鐘圖示 **「觸發條件 (Triggers)」**。
2. 點擊右下角 **「+ 新增觸發條件」**：
   - 選擇要執行的功能：`dailySyncBookingApi`
   - 選擇活動來源：`時間驅動`
   - 選取時間型觸發條件類型：`日計時器`
   - 選取時段：`早上 6 點到 7 點`（或 7 點到 8 點）
3. 點擊儲存，大功告成！系統每日清晨將自動抓取學校最新借用排程。

---

## 🛠️ 專案檔案架構

```
booking-linebot-template/
├── Code.gs             # Google Apps Script 後端核心（API同步、設備查詢、場地查詢、個人統計、Gemini RAG）
├── gas_index.html      # 內建 GAS Web 資訊看板儀表板 (doGet 渲染)
├── build_site.py       # 獨立 Landing Page 靜態網站生成器
├── index.html          # 線上展示頁與即時程式碼產生器 (Tailwind CSS)
├── README.md           # 專案中文說明文件
└── LICENSE             # MIT 開源授權條款
```

---

## 📄 授權條款 (License)

本專案採用 [MIT License](LICENSE) 開源授權，歡迎全台各級學校、教育夥伴、資訊教師與志工團隊自由採用、修改與二次開發。
