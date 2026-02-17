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
    #[serde(default)]
    channels_json: String,
    #[serde(default)]
    active_pack_id: String,
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

#[derive(Serialize, Deserialize, Clone)]
struct RulePack {
    id: String,
    name: String,
    description: String,
    author: String,
    version: String,
    system_prompt: String,
    rules: Vec<MemoRule>,
    memos: Vec<Memo>,
    tags: Vec<String>,
    created_at: String,
    updated_at: String,
}

fn get_config_path(app: &AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .expect("failed to get config dir");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("config.json")
}

fn get_packs_dir(app: &AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .expect("failed to get config dir");
    let packs_dir = config_dir.join("packs");
    fs::create_dir_all(&packs_dir).ok();
    packs_dir
}

fn get_installed_path(app: &AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .expect("failed to get config dir");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("installed.json")
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
            channels_json: String::new(),
            active_pack_id: String::new(),
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
            channels_json: String::new(),
            active_pack_id: String::new(),
        }
    }
}

#[tauri::command]
fn save_config(app: AppHandle, api_key: String, model_id: String, base_url: String, compact_model_id: String, reasoning_enabled: bool, compact_reasoning_enabled: bool, system_prompt: String, channels_json: String, active_pack_id: String) -> bool {
    let path = get_config_path(&app);
    let config = Config {
        api_key,
        model_id,
        base_url,
        compact_model_id,
        reasoning_enabled,
        compact_reasoning_enabled,
        system_prompt,
        channels_json,
        active_pack_id,
    };
    let json = serde_json::to_string_pretty(&config).unwrap();
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

// ===== Pack Management Functions =====

#[tauri::command]
fn get_active_pack(app: AppHandle) -> Option<RulePack> {
    let config = load_config(app.clone());
    if config.active_pack_id.is_empty() {
        return None;
    }

    let dir = get_packs_dir(&app);
    let path = dir.join(format!("{}.json", config.active_pack_id));

    if path.exists() {
        if let Ok(json) = fs::read_to_string(&path) {
            if let Ok(pack) = serde_json::from_str::<RulePack>(&json) {
                return Some(pack);
            }
        }
    }

    None
}

#[tauri::command]
fn set_active_pack(app: AppHandle, pack_id: String) -> bool {
    let mut config = load_config(app.clone());
    config.active_pack_id = pack_id;
    let path = get_config_path(&app);
    let json = serde_json::to_string_pretty(&config).unwrap();
    fs::write(path, json).is_ok()
}

#[tauri::command]
fn load_packs(app: AppHandle) -> Vec<RulePack> {
    let dir = get_packs_dir(&app);
    let mut packs = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(json) = fs::read_to_string(entry.path()) {
                if let Ok(pack) = serde_json::from_str::<RulePack>(&json) {
                    packs.push(pack);
                }
            }
        }
    }

    packs
}

#[tauri::command]
fn save_pack(app: AppHandle, pack: RulePack) -> bool {
    let dir = get_packs_dir(&app);
    let path = dir.join(format!("{}.json", pack.id));
    let json = serde_json::to_string_pretty(&pack).unwrap();
    fs::write(path, json).is_ok()
}

#[tauri::command]
fn delete_pack(app: AppHandle, id: String) -> bool {
    let dir = get_packs_dir(&app);
    let path = dir.join(format!("{}.json", id));
    fs::remove_file(path).is_ok()
}

#[tauri::command]
fn load_installed(app: AppHandle) -> Vec<String> {
    let path = get_installed_path(&app);
    if path.exists() {
        let json = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&json).unwrap_or_default()
    } else {
        Vec::new()
    }
}

#[tauri::command]
fn save_installed(app: AppHandle, ids: Vec<String>) -> bool {
    let path = get_installed_path(&app);
    let json = serde_json::to_string_pretty(&ids).unwrap();
    fs::write(path, json).is_ok()
}

#[tauri::command]
fn export_pack(app: AppHandle, content: String, filename: String) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app.dialog()
        .file()
        .set_file_name(&filename)
        .blocking_save_file();

    if let Some(file_path) = file_path {
        if let Some(path) = file_path.as_path() {
            fs::write(path, content).map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Invalid file path".to_string())
        }
    } else {
        Err("User cancelled".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_config, save_config,
            get_active_pack, set_active_pack,
            load_chat_history, save_chat_history, archive_chat_history,
            load_packs, save_pack, delete_pack,
            load_installed, save_installed,
            export_pack
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
