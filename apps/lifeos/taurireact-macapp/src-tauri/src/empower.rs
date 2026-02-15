// Empower Retirement Finance Scraper Integration
//
// Reads scraped account/transaction data from all_accounts.json,
// cleans it, and returns it to the frontend for syncing to Convex.
//
// Tauri commands:
// 1. read_empower_data — reads + cleans JSON, returns to frontend
// 2. run_empower_scraper — launches Chrome scraper (Patchright), then returns cleaned data
// 3. get_empower_schedule — reads cron config from Tauri store
// 4. save_empower_schedule — writes cron config to Tauri store
//
// Background cron:
// - run_cron_loop() checks every 60s if a scheduled scrape is due
// - On trigger, runs the scraper and emits "empower-cron-triggered" event
// - Frontend listens for event and syncs cleaned data to Convex

use cron::Schedule;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::str::FromStr;
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;
use tokio::time::sleep;

fn get_scraper_dir() -> PathBuf {
    let known_path = PathBuf::from(
        "/Users/bryanliu/Sync/00.Projects/holaai-convexo-monorepo/zexperiments/empower-scraper",
    );
    if known_path.exists() {
        return known_path;
    }
    let relative = PathBuf::from("../../zexperiments/empower-scraper");
    if relative.exists() {
        return relative;
    }
    known_path
}

fn get_uv_path() -> String {
    let candidates = [
        "/Users/bryanliu/.pyenv/shims/uv",
        "/Users/bryanliu/.local/bin/uv",
        "/usr/local/bin/uv",
        "/opt/homebrew/bin/uv",
    ];
    for path in &candidates {
        if PathBuf::from(path).exists() {
            return path.to_string();
        }
    }
    "uv".to_string()
}

// ==================== Raw scraper types ====================

#[derive(Debug, Deserialize)]
struct RawAccount {
    institution: String,
    #[serde(rename = "accountNum")]
    account_num: String,
    #[serde(rename = "accountTitle")]
    account_title: Option<String>,
    balance: String,
    transactions: Vec<RawTransaction>,
}

#[derive(Debug, Deserialize)]
struct RawTransaction {
    date: String,
    description: Option<String>,
    category: Option<String>,
    amount: Option<String>,
    action: Option<String>,
    quantity: Option<String>,
    price: Option<String>,
}

// ==================== Cleaned output types ====================

#[derive(Debug, Serialize, Clone)]
pub struct CleanedAccount {
    #[serde(rename = "accountNum")]
    pub account_num: String,
    pub institution: String,
    #[serde(rename = "accountName")]
    pub account_name: String,
    #[serde(rename = "accountType")]
    pub account_type: String,
    #[serde(rename = "accountSubtype")]
    pub account_subtype: String,
    #[serde(rename = "assetClass")]
    pub asset_class: String,
    #[serde(rename = "balanceCents")]
    pub balance_cents: i64,
    #[serde(rename = "isDebt")]
    pub is_debt: bool,
    #[serde(rename = "rawInstitution")]
    pub raw_institution: String,
    #[serde(rename = "rawAccountTitle")]
    pub raw_account_title: String,
    pub transactions: Vec<CleanedTransaction>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CleanedTransaction {
    pub date: String,
    #[serde(rename = "dateMs")]
    pub date_ms: f64,
    pub description: String,
    pub category: String,
    #[serde(rename = "amountCents")]
    pub amount_cents: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quantity: Option<f64>,
    #[serde(rename = "priceCents", skip_serializing_if = "Option::is_none")]
    pub price_cents: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct EmpowerReadResult {
    pub success: bool,
    pub accounts: Vec<CleanedAccount>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ==================== Account classification ====================

struct AccountInfo {
    account_type: &'static str,
    subtype: &'static str,
    asset_class: &'static str,
}

fn get_account_map() -> HashMap<&'static str, AccountInfo> {
    let mut m = HashMap::new();
    // Cash
    m.insert(
        "4824",
        AccountInfo {
            account_type: "cash",
            subtype: "checking",
            asset_class: "asset",
        },
    );
    m.insert(
        "560",
        AccountInfo {
            account_type: "cash",
            subtype: "checking",
            asset_class: "asset",
        },
    );
    // Investments
    m.insert(
        "0653",
        AccountInfo {
            account_type: "investment",
            subtype: "brokerage",
            asset_class: "asset",
        },
    );
    m.insert(
        "4348",
        AccountInfo {
            account_type: "investment",
            subtype: "brokerage",
            asset_class: "asset",
        },
    );
    m.insert(
        "880",
        AccountInfo {
            account_type: "investment",
            subtype: "roth_ira",
            asset_class: "asset",
        },
    );
    m.insert(
        "042",
        AccountInfo {
            account_type: "investment",
            subtype: "individual",
            asset_class: "asset",
        },
    );
    m.insert(
        "909",
        AccountInfo {
            account_type: "investment",
            subtype: "rollover_ira",
            asset_class: "asset",
        },
    );
    m.insert(
        "9957",
        AccountInfo {
            account_type: "investment",
            subtype: "other",
            asset_class: "asset",
        },
    );
    m.insert(
        "3315",
        AccountInfo {
            account_type: "investment",
            subtype: "brokerage",
            asset_class: "asset",
        },
    );
    m.insert(
        "0359",
        AccountInfo {
            account_type: "investment",
            subtype: "brokerage",
            asset_class: "asset",
        },
    );
    // Credit cards
    m.insert(
        "2775",
        AccountInfo {
            account_type: "credit_card",
            subtype: "credit_card",
            asset_class: "liability",
        },
    );
    m.insert(
        "4937",
        AccountInfo {
            account_type: "credit_card",
            subtype: "credit_card",
            asset_class: "liability",
        },
    );
    m.insert(
        "7277",
        AccountInfo {
            account_type: "credit_card",
            subtype: "credit_card",
            asset_class: "liability",
        },
    );
    m.insert(
        "4108",
        AccountInfo {
            account_type: "credit_card",
            subtype: "credit_card",
            asset_class: "liability",
        },
    );
    m.insert(
        "2276",
        AccountInfo {
            account_type: "credit_card",
            subtype: "credit_card",
            asset_class: "liability",
        },
    );
    m
}

const KNOWN_INSTITUTIONS: &[&str] = &[
    "Chase",
    "Charles Schwab",
    "E*TRADE",
    "Fidelity Investments",
    "Barclaycard",
    "Wells Fargo",
    "Vanguard",
    "Venmo",
    "Wealthfront",
    "Citibank",
];

fn clean_institution(raw: &str) -> String {
    let lower = raw.to_lowercase();
    for name in KNOWN_INSTITUTIONS {
        if lower.contains(&name.to_lowercase()) {
            return name.to_string();
        }
    }
    // Fallback: first word, strip trailing digits
    let first = raw.split_whitespace().next().unwrap_or("Unknown");
    let re = Regex::new(r"\d+$").unwrap();
    let cleaned = re.replace(first, "").to_string();
    if cleaned.is_empty() {
        "Unknown".to_string()
    } else {
        cleaned
    }
}

fn clean_account_name(raw_title: &str, account_num: &str) -> String {
    // "Type - Ending in XXXX"
    let re = Regex::new(r"([\w\s/]+?)\s*-\s*Ending in\s*\d+").unwrap();
    if let Some(caps) = re.captures(raw_title) {
        return caps[1].trim().to_string();
    }
    // Known patterns
    let patterns = [
        "Total Checking",
        "Investor Checking",
        "Credit Card",
        "Roth Contributory Ira",
        "Rollover Ira",
        "Individual",
        "Self Directed",
        "Securities",
    ];
    let lower = raw_title.to_lowercase();
    for p in &patterns {
        if lower.contains(&p.to_lowercase()) {
            return p.to_string();
        }
    }
    format!("Account ...{}", account_num)
}

fn parse_money(raw: &str) -> i64 {
    let cleaned = raw.replace('$', "").replace(',', "").trim().to_string();
    match cleaned.parse::<f64>() {
        Ok(v) => (v * 100.0).round() as i64,
        Err(_) => 0,
    }
}

fn parse_date_to_iso(raw: &str) -> String {
    // "2/14/2026" -> "2026-02-14"
    let parts: Vec<&str> = raw.split('/').collect();
    if parts.len() == 3 {
        let m = parts[0].parse::<u32>().unwrap_or(1);
        let d = parts[1].parse::<u32>().unwrap_or(1);
        let y = parts[2].parse::<u32>().unwrap_or(2026);
        format!("{:04}-{:02}-{:02}", y, m, d)
    } else {
        raw.to_string()
    }
}

fn parse_date_to_ms(raw: &str) -> f64 {
    let parts: Vec<&str> = raw.split('/').collect();
    if parts.len() == 3 {
        let m = parts[0].parse::<u32>().unwrap_or(1);
        let d = parts[1].parse::<u32>().unwrap_or(1);
        let y = parts[2].parse::<i32>().unwrap_or(2026);
        if let Some(dt) = chrono::NaiveDate::from_ymd_opt(y, m, d) {
            return dt
                .and_hms_opt(12, 0, 0)
                .unwrap()
                .and_utc()
                .timestamp_millis() as f64;
        }
    }
    0.0
}

fn clean_account(raw: &RawAccount) -> CleanedAccount {
    let account_map = get_account_map();
    let info = account_map.get(raw.account_num.as_str());

    let (account_type, subtype, asset_class) = match info {
        Some(i) => (i.account_type, i.subtype, i.asset_class),
        None => ("other", "other", "asset"),
    };

    let raw_title = raw.account_title.as_deref().unwrap_or("");

    let transactions: Vec<CleanedTransaction> = raw
        .transactions
        .iter()
        .map(|txn| {
            let quantity = txn
                .quantity
                .as_deref()
                .and_then(|q| q.parse::<f64>().ok());
            let price_cents = txn.price.as_deref().map(parse_money);

            CleanedTransaction {
                date: parse_date_to_iso(&txn.date),
                date_ms: parse_date_to_ms(&txn.date),
                description: txn.description.clone().unwrap_or_default(),
                category: txn
                    .category
                    .clone()
                    .unwrap_or_else(|| "Uncategorized".to_string()),
                amount_cents: parse_money(txn.amount.as_deref().unwrap_or("$0")),
                action: txn.action.clone(),
                quantity,
                price_cents,
            }
        })
        .collect();

    CleanedAccount {
        account_num: raw.account_num.clone(),
        institution: clean_institution(&raw.institution),
        account_name: clean_account_name(raw_title, &raw.account_num),
        account_type: account_type.to_string(),
        account_subtype: subtype.to_string(),
        asset_class: asset_class.to_string(),
        balance_cents: parse_money(&raw.balance),
        is_debt: asset_class == "liability",
        raw_institution: raw.institution.clone(),
        raw_account_title: raw_title.to_string(),
        transactions,
    }
}

fn read_and_clean() -> Result<Vec<CleanedAccount>, String> {
    let json_path = get_scraper_dir().join("output/all_accounts.json");
    if !json_path.exists() {
        return Err(format!(
            "No scraped data found at {}",
            json_path.display()
        ));
    }

    let content =
        fs::read_to_string(&json_path).map_err(|e| format!("Failed to read JSON: {}", e))?;

    let raw_accounts: Vec<RawAccount> =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(raw_accounts.iter().map(clean_account).collect())
}

// ==================== Tauri commands ====================

/// Read the scraped all_accounts.json, clean data, and return to frontend.
/// Frontend then pushes each account to Convex via authenticated mutations.
#[tauri::command]
pub fn read_empower_data() -> EmpowerReadResult {
    match read_and_clean() {
        Ok(accounts) => {
            let total_txns: usize = accounts.iter().map(|a| a.transactions.len()).sum();
            EmpowerReadResult {
                success: true,
                message: format!("{} accounts, {} transactions", accounts.len(), total_txns),
                accounts,
                error: None,
            }
        }
        Err(e) => EmpowerReadResult {
            success: false,
            message: "Failed to read scraped data".to_string(),
            accounts: vec![],
            error: Some(e),
        },
    }
}

// ==================== Schedule / Cron ====================

const EMPOWER_STORE_FILE: &str = "empower-schedule.json";
const CRON_EXPR_KEY: &str = "cronExpression";
const CRON_ENABLED_KEY: &str = "cronEnabled";
const DEFAULT_CRON: &str = "0 */6 * * *"; // Every 6 hours

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmpowerSchedule {
    #[serde(rename = "cronExpression")]
    pub cron_expression: String,
    #[serde(rename = "cronEnabled")]
    pub cron_enabled: bool,
}

#[tauri::command]
pub async fn get_empower_schedule(app: AppHandle) -> Result<EmpowerSchedule, String> {
    let store = app
        .store(EMPOWER_STORE_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let cron_expression: String = store
        .get(CRON_EXPR_KEY)
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(|| DEFAULT_CRON.to_string());

    let cron_enabled: bool = store
        .get(CRON_ENABLED_KEY)
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or(false);

    Ok(EmpowerSchedule {
        cron_expression,
        cron_enabled,
    })
}

#[tauri::command]
pub async fn save_empower_schedule(
    app: AppHandle,
    cron_expression: String,
    cron_enabled: bool,
) -> Result<(), String> {
    // Validate the cron expression (convert 5-field to 6-field for the cron crate)
    let cron_6field = format!("0 {}", &cron_expression);
    Schedule::from_str(&cron_6field)
        .map_err(|e| format!("Invalid cron expression '{}': {}", cron_expression, e))?;

    let store = app
        .store(EMPOWER_STORE_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.set(CRON_EXPR_KEY, serde_json::json!(cron_expression));
    store.set(CRON_ENABLED_KEY, serde_json::json!(cron_enabled));

    store
        .save()
        .map_err(|e| format!("Failed to persist store: {}", e))?;

    println!(
        "[Empower Cron] Schedule saved: {} (enabled: {})",
        cron_expression, cron_enabled
    );

    Ok(())
}

/// Background cron loop. Checks every 60s if a scheduled scrape is due.
/// On trigger, runs the scraper and emits "empower-cron-triggered" event
/// so the frontend can sync the cleaned data to Convex.
pub async fn run_cron_loop(app: AppHandle) {
    // Initial delay — let the app fully boot
    sleep(std::time::Duration::from_secs(30)).await;
    println!("[Empower Cron] Background scheduler started");

    let mut last_check = chrono::Utc::now();

    loop {
        sleep(std::time::Duration::from_secs(60)).await;

        // Read schedule from store
        let (cron_expr, enabled) = {
            let store = match app.store(EMPOWER_STORE_FILE) {
                Ok(s) => s,
                Err(_) => continue,
            };

            let expr: String = store
                .get(CRON_EXPR_KEY)
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_else(|| DEFAULT_CRON.to_string());

            let en: bool = store
                .get(CRON_ENABLED_KEY)
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or(false);

            (expr, en)
        };

        if !enabled {
            last_check = chrono::Utc::now();
            continue;
        }

        // Parse cron (prepend seconds field for the cron crate's 6-field format)
        let cron_6field = format!("0 {}", &cron_expr);
        let schedule = match Schedule::from_str(&cron_6field) {
            Ok(s) => s,
            Err(e) => {
                println!("[Empower Cron] Invalid cron '{}': {}", cron_expr, e);
                last_check = chrono::Utc::now();
                continue;
            }
        };

        let now = chrono::Utc::now();

        // Check if there was a scheduled time between last_check and now
        if let Some(next) = schedule.after(&last_check).next() {
            if next <= now {
                println!("[Empower Cron] Scheduled scrape triggered (cron: {})", cron_expr);

                // Run the scraper in a blocking task
                let scraper_dir = get_scraper_dir();
                let scrape_script = scraper_dir.join("scrape_all.py");

                if scrape_script.exists() {
                    let uv = get_uv_path();
                    let result = tokio::task::spawn_blocking(move || {
                        Command::new(&uv)
                            .args(["run", "python", "scrape_all.py", "--no-sync"])
                            .current_dir(&scraper_dir)
                            .env("PYENV_VERSION", "3.12.10")
                            .output()
                    })
                    .await;

                    match result {
                        Ok(Ok(output)) if output.status.success() => {
                            println!("[Empower Cron] Scrape completed successfully");
                            // Emit event so the frontend syncs data to Convex
                            let _ = app.emit("empower-cron-triggered", ());
                        }
                        Ok(Ok(output)) => {
                            let stderr = String::from_utf8_lossy(&output.stderr);
                            println!("[Empower Cron] Scrape failed: {}", stderr);
                        }
                        Ok(Err(e)) => {
                            println!("[Empower Cron] Failed to run scraper: {}", e);
                        }
                        Err(e) => {
                            println!("[Empower Cron] Task join error: {}", e);
                        }
                    }
                } else {
                    println!(
                        "[Empower Cron] Scraper script not found at {}",
                        scrape_script.display()
                    );
                }
            }
        }

        last_check = now;
    }
}

// ==================== Net Worth History ====================

#[derive(Debug, Serialize, Clone)]
pub struct NetWorthHistoryPoint {
    pub date: String,      // ISO "2026-02-15"
    #[serde(rename = "netWorthCents")]
    pub net_worth_cents: i64,
    #[serde(rename = "assetsCents")]
    pub assets_cents: Option<i64>,
    #[serde(rename = "liabilitiesCents")]
    pub liabilities_cents: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct NetWorthHistoryResult {
    pub success: bool,
    pub points: Vec<NetWorthHistoryPoint>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Read net_worth_history.json from scraper output.
/// Returns any historical data points found during the last scrape.
#[tauri::command]
pub fn read_net_worth_history() -> NetWorthHistoryResult {
    let json_path = get_scraper_dir().join("output/net_worth_history.json");
    if !json_path.exists() {
        return NetWorthHistoryResult {
            success: false,
            points: vec![],
            message: "No net worth history file found".to_string(),
            error: Some("Run a full scrape first".to_string()),
        };
    }

    let content = match fs::read_to_string(&json_path) {
        Ok(c) => c,
        Err(e) => {
            return NetWorthHistoryResult {
                success: false,
                points: vec![],
                message: "Failed to read file".to_string(),
                error: Some(format!("{}", e)),
            }
        }
    };

    let raw: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(e) => {
            return NetWorthHistoryResult {
                success: false,
                points: vec![],
                message: "Failed to parse JSON".to_string(),
                error: Some(format!("{}", e)),
            }
        }
    };

    let mut points = Vec::new();

    // Try to extract from historyPoints array
    if let Some(arr) = raw.get("historyPoints").and_then(|v| v.as_array()) {
        for item in arr {
            if let Some(point) = parse_history_point(item) {
                points.push(point);
            }
        }
    }

    // If no structured history, try extracting from apiCaptures
    if points.is_empty() {
        if let Some(captures) = raw.get("apiCaptures").and_then(|v| v.as_array()) {
            for capture in captures {
                if let Some(data) = capture.get("data") {
                    // Look for arrays in the response data
                    if let Some(arr) = find_time_series(data) {
                        for item in arr {
                            if let Some(point) = parse_history_point(item) {
                                points.push(point);
                            }
                        }
                        if !points.is_empty() {
                            break;
                        }
                    }
                }
            }
        }
    }

    let msg = format!("{} history points found", points.len());
    NetWorthHistoryResult {
        success: true,
        points,
        message: msg,
        error: None,
    }
}

/// Try to parse a JSON value into a NetWorthHistoryPoint.
fn parse_history_point(val: &serde_json::Value) -> Option<NetWorthHistoryPoint> {
    let obj = val.as_object()?;

    // Find date field
    let date_keys = ["date", "dateTime", "timestamp", "time", "period", "day"];
    let date_raw = date_keys
        .iter()
        .filter_map(|k| obj.get(*k))
        .next()?;

    let date = if let Some(s) = date_raw.as_str() {
        // Might be ISO date or M/D/YYYY
        if s.contains('/') {
            parse_date_to_iso(s)
        } else {
            s[..10.min(s.len())].to_string() // Take YYYY-MM-DD portion
        }
    } else if let Some(ts) = date_raw.as_f64() {
        // Unix timestamp (seconds or milliseconds)
        let secs = if ts > 1e12 { (ts / 1000.0) as i64 } else { ts as i64 };
        chrono::DateTime::from_timestamp(secs, 0)
            .map(|dt| dt.format("%Y-%m-%d").to_string())
            .unwrap_or_default()
    } else {
        return None;
    };

    if date.is_empty() {
        return None;
    }

    // Find value field
    let value_keys = ["value", "amount", "balance", "netWorth", "total", "y"];
    let value = value_keys
        .iter()
        .filter_map(|k| obj.get(*k))
        .filter_map(|v| {
            if let Some(n) = v.as_f64() {
                Some(n)
            } else if let Some(s) = v.as_str() {
                parse_money_f64(s)
            } else {
                None
            }
        })
        .next()?;

    Some(NetWorthHistoryPoint {
        date,
        net_worth_cents: (value * 100.0).round() as i64,
        assets_cents: None,
        liabilities_cents: None,
    })
}

fn parse_money_f64(raw: &str) -> Option<f64> {
    let cleaned = raw.replace('$', "").replace(',', "").trim().to_string();
    cleaned.parse::<f64>().ok()
}

/// Recursively search a JSON value for an array that looks like a time series.
fn find_time_series(val: &serde_json::Value) -> Option<&Vec<serde_json::Value>> {
    match val {
        serde_json::Value::Array(arr) if arr.len() >= 3 => {
            // Check if items look like date/value objects
            let sample = arr.first()?;
            let obj = sample.as_object()?;
            let date_keys = ["date", "dateTime", "timestamp", "time", "period", "day"];
            let value_keys = ["value", "amount", "balance", "netWorth", "total", "y"];
            let has_date = date_keys.iter().any(|k| obj.contains_key(*k));
            let has_value = value_keys.iter().any(|k| obj.contains_key(*k));
            if has_date && has_value {
                return Some(arr);
            }
            None
        }
        serde_json::Value::Object(map) => {
            for (_, v) in map {
                if let Some(arr) = find_time_series(v) {
                    return Some(arr);
                }
            }
            None
        }
        _ => None,
    }
}

/// Run the full Empower scrape (Chrome/Patchright), then return cleaned data.
/// Frontend calls this, waits for scrape, then syncs the returned data to Convex.
#[tauri::command]
pub async fn run_empower_scraper() -> EmpowerReadResult {
    let scraper_dir = get_scraper_dir();
    let scrape_script = scraper_dir.join("scrape_all.py");

    if !scrape_script.exists() {
        return EmpowerReadResult {
            success: false,
            message: "Scraper script not found".to_string(),
            accounts: vec![],
            error: Some(format!("Expected at: {}", scrape_script.display())),
        };
    }

    let uv = get_uv_path();

    // Run: PYENV_VERSION=3.12.10 uv run python scrape_all.py --no-sync
    let result = tokio::task::spawn_blocking(move || {
        Command::new(&uv)
            .args(["run", "python", "scrape_all.py", "--no-sync"])
            .current_dir(&scraper_dir)
            .env("PYENV_VERSION", "3.12.10")
            .output()
    })
    .await;

    match result {
        Ok(Ok(output)) => {
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                return EmpowerReadResult {
                    success: false,
                    message: "Scrape failed".to_string(),
                    accounts: vec![],
                    error: Some(format!("{}\n{}", stderr, stdout)),
                };
            }
            // Scrape succeeded — now read the output JSON
            match read_and_clean() {
                Ok(accounts) => {
                    let total_txns: usize =
                        accounts.iter().map(|a| a.transactions.len()).sum();
                    EmpowerReadResult {
                        success: true,
                        message: format!(
                            "Scraped {} accounts, {} transactions",
                            accounts.len(),
                            total_txns
                        ),
                        accounts,
                        error: None,
                    }
                }
                Err(e) => EmpowerReadResult {
                    success: false,
                    message: "Scrape succeeded but failed to read output".to_string(),
                    accounts: vec![],
                    error: Some(e),
                },
            }
        }
        Ok(Err(e)) => EmpowerReadResult {
            success: false,
            message: "Failed to run scraper".to_string(),
            accounts: vec![],
            error: Some(format!("{}", e)),
        },
        Err(e) => EmpowerReadResult {
            success: false,
            message: "Task join error".to_string(),
            accounts: vec![],
            error: Some(format!("{}", e)),
        },
    }
}
