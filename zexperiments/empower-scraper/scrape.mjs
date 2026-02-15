import WebSocket from "ws";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CDP_URL = "http://localhost:9222";
const OUTPUT_DIR = path.join(__dirname, "output");

// --- CDP helpers ---

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
      res.on("error", reject);
    });
  });
}

function connectTab(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let msgId = 0;
    const pending = new Map();

    ws.on("open", () => resolve({ ws, send }));
    ws.on("error", reject);
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    });

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = ++msgId;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }
  });
}

async function evaluate(send, expression) {
  const res = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return res.result?.result?.value;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Scraping logic ---

async function getPageTabs() {
  const tabs = await httpGet(`${CDP_URL}/json/list`);
  return tabs.filter((t) => t.type === "page" && t.url.includes("empower"));
}

async function waitForContent(send, testExpr, maxWait = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const val = await evaluate(send, testExpr);
    if (val) return val;
    await sleep(500);
  }
  return null;
}

async function scrapeAllAccounts(send) {
  // Step 1: Make sure we're on the home/overview page
  const currentUrl = await evaluate(send, "window.location.href");
  console.log("Current URL:", currentUrl);

  if (!currentUrl.includes("/user/home")) {
    console.log("Navigating to home page...");
    await evaluate(
      send,
      `window.location.href = "https://participant.empower-retirement.com/dashboard/#/user/home"`
    );
    await sleep(3000);
  }

  // Step 2: Parse all accounts from the sidebar
  const accounts = await evaluate(
    send,
    `
    (() => {
      const buttons = document.querySelectorAll('button');
      const accounts = [];
      for (const btn of buttons) {
        const text = btn.textContent.trim();
        // Match account rows: they contain a 4-digit number pattern and currency
        const match = text.match(/(\\d{4})\\s*•\\s*(\\d+[mhd]?)\\s*ago/);
        if (match) {
          // Extract institution name and account number
          const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
          const institution = lines[0] || '';
          const accountNum = match[1];
          const balanceMatch = text.match(/\\$([\\d,]+(?:\\.\\d{2})?)/);
          const balance = balanceMatch ? balanceMatch[0] : '$0';

          accounts.push({
            institution,
            accountNum,
            balance,
            identifier: accountNum, // used to find and click
            fullText: text.substring(0, 100)
          });
        }
      }
      return JSON.stringify(accounts);
    })()
  `
  );

  const accountList = JSON.parse(accounts || "[]");
  console.log(`\nFound ${accountList.length} accounts:`);
  for (const a of accountList) {
    console.log(`  - ${a.institution} ...${a.accountNum} (${a.balance})`);
  }

  return accountList;
}

async function scrapeAccountDetail(send, account) {
  console.log(
    `\nScraping: ${account.institution} ...${account.accountNum}...`
  );

  // Click on the account
  const clicked = await evaluate(
    send,
    `
    (() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.includes('${account.accountNum}') && btn.textContent.includes('ago')) {
          btn.click();
          return true;
        }
      }
      return false;
    })()
  `
  );

  if (!clicked) {
    console.log(`  Could not find button for ${account.accountNum}, skipping`);
    return null;
  }

  // Wait for detail panel to load
  await sleep(3000);

  // Extract account detail and transactions
  const detail = await evaluate(
    send,
    `
    (() => {
      const body = document.body.innerText;

      // Find the detail section - look for "Balance" after the account identifier
      const detailStart = body.indexOf('${account.accountNum}');
      if (detailStart === -1) return JSON.stringify({ error: 'Detail not found' });

      const detailText = body.substring(detailStart);

      // Extract account name
      const nameMatch = detailText.match(/(?:Ending in ${account.accountNum}|${account.accountNum})[\\s\\S]*?Balance\\s+\\$([\\d,]+\\.?\\d*)/);
      const balance = nameMatch ? nameMatch[1] : '';

      // Extract transactions - look for date patterns
      const transactions = [];
      const lines = detailText.split('\\n').map(l => l.trim()).filter(Boolean);

      let i = 0;
      while (i < lines.length) {
        // Match date pattern MM/DD/YYYY
        const dateMatch = lines[i].match(/^(\\d{1,2}\\/\\d{1,2}\\/\\d{4})$/);
        if (dateMatch) {
          const date = dateMatch[1];
          const action = lines[i + 1] || '';
          const description = lines[i + 2] || '';
          const category = lines[i + 3] || '';

          // Look for amount - could be a few lines ahead
          let amount = '';
          for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
            const amtMatch = lines[j].match(/^-?\\$[\\d,]+\\.\\d{2}$/);
            if (amtMatch) {
              amount = amtMatch[0];
            }
          }

          // For checking accounts, format is: Date, Description, Category, Tags, Amount
          // For investment accounts: Date, Action, Description, Category, Quantity, Price, Tags, Amount
          transactions.push({ date, action, description, category, amount });
          i += 2;
        } else {
          i++;
        }
      }

      return JSON.stringify({ balance, transactions });
    })()
  `
  );

  return JSON.parse(detail || "{}");
}

// Better transaction parser that uses the DOM structure
async function scrapeTransactionsFromDOM(send, account) {
  console.log(
    `\nScraping: ${account.institution} ...${account.accountNum}...`
  );

  // Click on the account
  const clicked = await evaluate(
    send,
    `
    (() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.includes('${account.accountNum}') && btn.textContent.includes('ago')) {
          btn.click();
          return true;
        }
      }
      return false;
    })()
  `
  );

  if (!clicked) {
    console.log(`  Could not find button for ${account.accountNum}, skipping`);
    return null;
  }

  await sleep(3000);

  // Get account title/type
  const accountTitle = await evaluate(
    send,
    `
    (() => {
      // The account detail shows something like "Total Checking - Ending in 4824" or "Self Directed - Ending in 4348"
      const text = document.body.innerText;
      const match = text.match(/([\\w\\s]+ - Ending in ${account.accountNum})/);
      return match ? match[1] : '${account.institution} ${account.accountNum}';
    })()
  `
  );

  // Get the full text between "Search transactions" and "Total" or "Legal disclosures"
  const rawTransactions = await evaluate(
    send,
    `
    (() => {
      const text = document.body.innerText;

      // Find transaction section
      const searchIdx = text.indexOf('Search transactions');
      const totalIdx = text.indexOf('\\nTotal\\n', searchIdx);
      const legalIdx = text.indexOf('Legal disclosures');
      const endIdx = totalIdx !== -1 ? totalIdx : legalIdx;

      if (searchIdx === -1) return JSON.stringify({ accountTitle: '', headers: [], rows: [] });

      const section = text.substring(searchIdx, endIdx !== -1 ? endIdx + 50 : searchIdx + 5000);
      return section.substring(0, 8000);
    })()
  `
  );

  // Parse the raw text into structured transactions
  const transactions = parseTransactionText(rawTransactions, accountTitle);
  return { accountTitle, transactions };
}

function parseTransactionText(rawText, accountTitle) {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const transactions = [];

  // Detect if this is a checking/savings account or investment account
  const isInvestment = lines.some(
    (l) => l === "Action" || l === "Quantity" || l === "Price"
  );

  // Find header row to determine columns
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "Date") {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) return transactions;

  // Count header columns
  const headers = [];
  for (let i = headerIdx; i < lines.length; i++) {
    if (lines[i].match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) break;
    headers.push(lines[i]);
  }

  console.log(`  Headers: ${headers.join(", ")}`);
  const colCount = headers.length;

  // Parse data rows
  let i = headerIdx + colCount;
  while (i < lines.length) {
    const dateMatch = lines[i].match(/^(\d{1,2}\/\d{1,2}\/\d{4})$/);
    if (dateMatch) {
      const row = { date: dateMatch[1] };

      if (isInvestment) {
        // Investment: Date, Action, Description, Category, Quantity, Price, Tags, Amount
        row.action = lines[i + 1] || "";
        row.description = lines[i + 2] || "";
        row.category = lines[i + 3] || "";
        row.quantity = lines[i + 4] || "";
        row.price = lines[i + 5] || "";
        // Tags might be empty, amount is last
        const remaining = [];
        for (let j = i + 6; j < Math.min(i + 9, lines.length); j++) {
          if (lines[j].match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) break;
          if (lines[j] === "Total") break;
          remaining.push(lines[j]);
        }
        row.amount = remaining[remaining.length - 1] || "";
        i += colCount;
      } else {
        // Checking: Date, Description, Category, Tags, Amount
        row.description = lines[i + 1] || "";
        row.category = lines[i + 2] || "";
        // Tags might be empty, amount is the last $ value before next date
        const remaining = [];
        for (let j = i + 3; j < Math.min(i + 6, lines.length); j++) {
          if (lines[j].match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) break;
          if (lines[j] === "Total") break;
          remaining.push(lines[j]);
        }
        row.amount = remaining[remaining.length - 1] || "";
        i += Math.max(colCount, 4);
      }

      transactions.push(row);
    } else if (lines[i] === "Total") {
      break;
    } else {
      i++;
    }
  }

  return transactions;
}

function toCsv(transactions, isInvestment) {
  if (!transactions.length) return "";

  const headers = isInvestment
    ? ["date", "action", "description", "category", "quantity", "price", "amount"]
    : ["date", "description", "category", "amount"];

  const escape = (val) => {
    const s = String(val || "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = [headers.join(",")];
  for (const t of transactions) {
    rows.push(headers.map((h) => escape(t[h])).join(","));
  }
  return rows.join("\n");
}

// --- Main ---

async function main() {
  console.log("Empower Retirement Scraper");
  console.log("=========================\n");

  // Ensure output dir
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Find the Empower tab
  const tabs = await getPageTabs();
  if (!tabs.length) {
    console.error(
      "No Empower tab found. Make sure Chrome is open with remote debugging and you're logged in."
    );
    process.exit(1);
  }

  const tab = tabs[0];
  console.log(`Connected to: ${tab.title} (${tab.url})\n`);

  const { ws, send } = await connectTab(tab.webSocketDebuggerUrl);

  try {
    // Get all accounts
    const accounts = await scrapeAllAccounts(send);

    const allData = [];

    for (const account of accounts) {
      const result = await scrapeTransactionsFromDOM(send, account);
      if (!result) continue;

      const { accountTitle, transactions } = result;
      console.log(`  Found ${transactions.length} transactions`);

      // Determine if investment account
      const isInvestment = transactions.some((t) => t.action);

      // Save individual CSV
      const safeName = `${account.institution}_${account.accountNum}`.replace(
        /[^a-zA-Z0-9_]/g,
        "_"
      );
      const csvPath = path.join(OUTPUT_DIR, `${safeName}.csv`);
      const csv = toCsv(transactions, isInvestment);
      if (csv) {
        fs.writeFileSync(csvPath, csv);
        console.log(`  Saved to: ${csvPath}`);
      }

      allData.push({
        institution: account.institution,
        accountNum: account.accountNum,
        accountTitle: accountTitle || "",
        balance: account.balance,
        transactions,
      });

      // Small delay between accounts
      await sleep(1000);
    }

    // Save combined JSON for reference
    const jsonPath = path.join(OUTPUT_DIR, "all_accounts.json");
    fs.writeFileSync(jsonPath, JSON.stringify(allData, null, 2));
    console.log(`\nSaved combined data to: ${jsonPath}`);

    // Save a summary CSV
    const summaryRows = [["institution", "account_num", "account_title", "balance", "transaction_count"]];
    for (const d of allData) {
      summaryRows.push([
        d.institution,
        d.accountNum,
        d.accountTitle,
        d.balance,
        String(d.transactions.length),
      ]);
    }
    const summaryPath = path.join(OUTPUT_DIR, "summary.csv");
    fs.writeFileSync(summaryPath, summaryRows.map((r) => r.join(",")).join("\n"));
    console.log(`Saved summary to: ${summaryPath}`);

    console.log("\nDone!");
  } finally {
    ws.close();
  }
}

main().catch(console.error);
