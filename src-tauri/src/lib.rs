use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone)]
struct Config {
    api_key: String,
    model_id: String,
    base_url: String,
    #[serde(default)]
    compact_model_id: String,
    #[serde(default)]
    reasoning_enabled: bool,
    #[serde(default)]
    compact_reasoning_enabled: bool,
    #[serde(default)]
    system_prompt: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct MemoRule {
    description: String,
    update_rule: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct Memo {
    title: String,
    content: String,
}

fn get_config_path(app: &AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .expect("failed to get config dir");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("config.json")
}

fn get_memo_rules_path(app: &AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .expect("failed to get config dir");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("memo-rules.json")
}

fn get_memos_path(app: &AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .expect("failed to get config dir");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("memos.json")
}

#[tauri::command]
fn load_config(app: AppHandle) -> Config {
    let path = get_config_path(&app);
    if path.exists() {
        let json = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&json).unwrap_or(Config {
            api_key: String::new(),
            model_id: String::new(),
            base_url: String::new(),
            compact_model_id: String::new(),
            reasoning_enabled: false,
            compact_reasoning_enabled: false,
            system_prompt: String::new(),
        })
    } else {
        Config {
            api_key: String::new(),
            model_id: String::new(),
            base_url: String::new(),
            compact_model_id: String::new(),
            reasoning_enabled: false,
            compact_reasoning_enabled: false,
            system_prompt: String::new(),
        }
    }
}

#[tauri::command]
fn save_config(app: AppHandle, api_key: String, model_id: String, base_url: String, compact_model_id: String, reasoning_enabled: bool, compact_reasoning_enabled: bool, system_prompt: String) -> bool {
    let path = get_config_path(&app);
    let config = Config {
        api_key,
        model_id,
        base_url,
        compact_model_id,
        reasoning_enabled,
        compact_reasoning_enabled,
        system_prompt,
    };
    let json = serde_json::to_string_pretty(&config).unwrap();
    fs::write(path, json).is_ok()
}

#[tauri::command]
fn load_memo_rules(app: AppHandle) -> Vec<MemoRule> {
    let path = get_memo_rules_path(&app);
    if path.exists() {
        let json = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&json).unwrap_or_default()
    } else {
        Vec::new()
    }
}

#[tauri::command]
fn save_memo_rules(app: AppHandle, rules: Vec<MemoRule>) -> bool {
    let path = get_memo_rules_path(&app);
    let json = serde_json::to_string_pretty(&rules).unwrap();
    fs::write(path, json).is_ok()
}

#[tauri::command]
fn load_memos(app: AppHandle) -> Vec<Memo> {
    let path = get_memos_path(&app);
    if path.exists() {
        let json = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&json).unwrap_or_default()
    } else {
        Vec::new()
    }
}

#[tauri::command]
fn save_memos(app: AppHandle, memos: Vec<Memo>) -> bool {
    let path = get_memos_path(&app);
    let json = serde_json::to_string_pretty(&memos).unwrap();
    fs::write(path, json).is_ok()
}

fn get_chat_history_path(app: &AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .expect("failed to get config dir");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("chat-history.json")
}

fn get_archives_dir(app: &AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .expect("failed to get config dir");
    let archives = config_dir.join("archives");
    fs::create_dir_all(&archives).ok();
    archives
}

#[tauri::command]
fn load_chat_history(app: AppHandle) -> Vec<Value> {
    let path = get_chat_history_path(&app);
    if path.exists() {
        let json = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&json).unwrap_or_default()
    } else {
        Vec::new()
    }
}

#[tauri::command]
fn save_chat_history(app: AppHandle, messages: Vec<Value>) -> bool {
    let path = get_chat_history_path(&app);
    let json = serde_json::to_string_pretty(&messages).unwrap();
    fs::write(path, json).is_ok()
}

#[tauri::command]
fn archive_chat_history(app: AppHandle, messages: Vec<Value>) -> bool {
    let dir = get_archives_dir(&app);
    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let path = dir.join(format!("{}.json", timestamp));
    let json = serde_json::to_string_pretty(&messages).unwrap();
    fs::write(path, json).is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_config, save_config, load_memo_rules, save_memo_rules, load_memos, save_memos, load_chat_history, save_chat_history, archive_chat_history])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
