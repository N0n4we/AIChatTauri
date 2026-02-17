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
    channels_json: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct MemoRule {
    #[serde(alias = "description")]
    title: String,
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
            channels_json: String::new(),
        })
    } else {
        Config {
            api_key: String::new(),
            model_id: String::new(),
            base_url: String::new(),
            compact_model_id: String::new(),
            reasoning_enabled: false,
            compact_reasoning_enabled: false,
            channels_json: String::new(),
        }
    }
}

#[tauri::command]
fn save_config(app: AppHandle, api_key: String, model_id: String, base_url: String, compact_model_id: String, reasoning_enabled: bool, compact_reasoning_enabled: bool, channels_json: String) -> bool {
    let path = get_config_path(&app);
    let config = Config {
        api_key,
        model_id,
        base_url,
        compact_model_id,
        reasoning_enabled,
        compact_reasoning_enabled,
        channels_json,
    };
    let json = serde_json::to_string_pretty(&config).unwrap();
    fs::write(path, json).is_ok()
}

#[derive(Serialize, Deserialize, Clone)]
struct ChatSession {
    id: String,
    title: String,
    message_count: usize,
    created_at: String,
}

fn get_sessions_dir(app: &AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .expect("failed to get config dir");
    let sessions_dir = config_dir.join("sessions");
    fs::create_dir_all(&sessions_dir).ok();
    sessions_dir
}

#[tauri::command]
fn list_chat_sessions(app: AppHandle) -> Vec<ChatSession> {
    let dir = get_sessions_dir(&app);
    let mut sessions = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "json") {
                if let Ok(json) = fs::read_to_string(&path) {
                    if let Ok(data) = serde_json::from_str::<Value>(&json) {
                        if let Some(meta) = data.get("meta") {
                            if let Ok(session) = serde_json::from_value::<ChatSession>(meta.clone()) {
                                sessions.push(session);
                            }
                        }
                    }
                }
            }
        }
    }
    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    sessions
}

#[tauri::command]
fn save_chat_session(app: AppHandle, id: String, title: String, messages: Vec<Value>) -> bool {
    let dir = get_sessions_dir(&app);
    let path = dir.join(format!("{}.json", id));
    let meta = ChatSession {
        id: id.clone(),
        title,
        message_count: messages.len(),
        created_at: {
            if path.exists() {
                if let Ok(json) = fs::read_to_string(&path) {
                    if let Ok(data) = serde_json::from_str::<Value>(&json) {
                        data.get("meta")
                            .and_then(|m| m.get("created_at"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string()
                    } else {
                        Local::now().to_rfc3339()
                    }
                } else {
                    Local::now().to_rfc3339()
                }
            } else {
                Local::now().to_rfc3339()
            }
        },
    };
    let data = serde_json::json!({ "meta": meta, "messages": messages });
    let json = serde_json::to_string_pretty(&data).unwrap();
    fs::write(path, json).is_ok()
}

#[tauri::command]
fn load_chat_session(app: AppHandle, id: String) -> Vec<Value> {
    let dir = get_sessions_dir(&app);
    let path = dir.join(format!("{}.json", id));
    if path.exists() {
        if let Ok(json) = fs::read_to_string(&path) {
            if let Ok(data) = serde_json::from_str::<Value>(&json) {
                if let Some(msgs) = data.get("messages") {
                    return serde_json::from_value(msgs.clone()).unwrap_or_default();
                }
            }
        }
    }
    Vec::new()
}

#[tauri::command]
fn delete_chat_session(app: AppHandle, id: String) -> bool {
    let dir = get_sessions_dir(&app);
    let path = dir.join(format!("{}.json", id));
    fs::remove_file(path).is_ok()
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

#[derive(Serialize, Deserialize, Clone)]
struct ArchiveEntry {
    filename: String,
    message_count: usize,
    created_at: String,
}

#[tauri::command]
fn list_archives(app: AppHandle) -> Vec<ArchiveEntry> {
    let dir = get_archives_dir(&app);
    let mut entries = Vec::new();
    if let Ok(files) = fs::read_dir(dir) {
        for file in files.flatten() {
            let path = file.path();
            if path.extension().map_or(false, |e| e == "json") {
                let filename = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                let count = fs::read_to_string(&path)
                    .ok()
                    .and_then(|json| serde_json::from_str::<Vec<Value>>(&json).ok())
                    .map_or(0, |v| v.len());
                // filename is like 20250101_120000, parse to readable date
                let created_at = if filename.len() >= 15 {
                    format!(
                        "{}-{}-{}T{}:{}:{}",
                        &filename[0..4], &filename[4..6], &filename[6..8],
                        &filename[9..11], &filename[11..13], &filename[13..15]
                    )
                } else {
                    filename.clone()
                };
                entries.push(ArchiveEntry { filename, message_count: count, created_at });
            }
        }
    }
    entries.sort_by(|a, b| b.filename.cmp(&a.filename));
    entries
}

#[tauri::command]
fn load_archive(app: AppHandle, filename: String) -> Vec<Value> {
    let dir = get_archives_dir(&app);
    let path = dir.join(format!("{}.json", filename));
    if path.exists() {
        if let Ok(json) = fs::read_to_string(&path) {
            return serde_json::from_str(&json).unwrap_or_default();
        }
    }
    Vec::new()
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

fn get_current_pack_path(app: &AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .expect("failed to get config dir");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("current-pack.json")
}

#[tauri::command]
fn load_current_pack(app: AppHandle) -> Option<RulePack> {
    let path = get_current_pack_path(&app);
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
fn save_current_pack(app: AppHandle, pack: RulePack) -> bool {
    let path = get_current_pack_path(&app);
    let json = serde_json::to_string_pretty(&pack).unwrap();
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
            load_current_pack, save_current_pack,
            load_chat_history, save_chat_history, archive_chat_history,
            list_archives, load_archive,
            list_chat_sessions, save_chat_session, load_chat_session, delete_chat_session,
            load_packs, save_pack, delete_pack,
            export_pack
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
