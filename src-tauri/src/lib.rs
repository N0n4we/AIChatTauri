use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Serialize, Deserialize, Clone)]
struct Config {
    api_key: String,
    model_id: String,
    base_url: String,
}

#[derive(Deserialize)]
struct ChatMessage {
    role: String,
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

#[tauri::command]
fn load_config(app: AppHandle) -> Config {
    let path = get_config_path(&app);
    if path.exists() {
        let json = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&json).unwrap_or(Config {
            api_key: String::new(),
            model_id: String::new(),
            base_url: String::new(),
        })
    } else {
        Config {
            api_key: String::new(),
            model_id: String::new(),
            base_url: String::new(),
        }
    }
}

#[tauri::command]
fn save_config(app: AppHandle, api_key: String, model_id: String, base_url: String) -> bool {
    let path = get_config_path(&app);
    let config = Config {
        api_key,
        model_id,
        base_url,
    };
    let json = serde_json::to_string_pretty(&config).unwrap();
    fs::write(path, json).is_ok()
}

#[tauri::command]
async fn chat(
    app: AppHandle,
    message: String,
    history: Vec<ChatMessage>,
) -> Result<String, String> {
    let config = load_config(app.clone());

    if config.api_key.is_empty() {
        return Err("API Key not configured".into());
    }

    let model = if config.model_id.is_empty() {
        "gpt-3.5-turbo".to_string()
    } else {
        config.model_id
    };
    let base_url = if config.base_url.is_empty() {
        "https://api.openai.com/v1".to_string()
    } else {
        config.base_url
    };

    let mut messages_payload: Vec<serde_json::Value> = history
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content,
            })
        })
        .collect();
    messages_payload.push(serde_json::json!({
        "role": "user",
        "content": message,
    }));

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/chat/completions", base_url))
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": model,
            "messages": messages_payload,
            "stream": true,
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API Error: {}", error_text));
    }

    let mut stream = response.bytes_stream();
    let mut full_content = String::new();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        let lines: Vec<String> = buffer.split('\n').map(|s| s.to_string()).collect();
        buffer = lines.last().cloned().unwrap_or_default();

        for line in &lines[..lines.len().saturating_sub(1)] {
            let trimmed = line.trim();
            if trimmed.is_empty() || !trimmed.starts_with("data: ") {
                continue;
            }

            let data = &trimmed[6..];
            if data == "[DONE]" {
                continue;
            }

            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(content) = parsed["choices"][0]["delta"]["content"].as_str() {
                    if !content.is_empty() {
                        full_content.push_str(content);
                        let _ = app.emit("chat-stream", content);
                    }
                }
            }
        }
    }

    // Process remaining buffer
    let trimmed = buffer.trim();
    if !trimmed.is_empty() && trimmed.starts_with("data: ") {
        let data = &trimmed[6..];
        if data != "[DONE]" {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(content) = parsed["choices"][0]["delta"]["content"].as_str() {
                    if !content.is_empty() {
                        full_content.push_str(content);
                        let _ = app.emit("chat-stream", content);
                    }
                }
            }
        }
    }

    let _ = app.emit("chat-stream-end", ());

    if full_content.is_empty() {
        Ok("No response from AI".into())
    } else {
        Ok(full_content)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_config, save_config, chat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
