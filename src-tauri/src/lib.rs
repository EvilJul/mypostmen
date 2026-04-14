use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use tauri::ipc::Channel;

#[derive(Deserialize)]
pub struct ProxyRequest {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct ProxyResponse {
    status: u16,
    status_text: String,
    headers: HashMap<String, String>,
    body: String,
}

#[derive(Serialize, Clone)]
pub struct StreamChunk {
    kind: String, // "data", "done", "error"
    data: String,
}

#[tauri::command]
async fn http_proxy(req: ProxyRequest) -> Result<ProxyResponse, String> {
    let client = reqwest::Client::new();
    let method: reqwest::Method = req.method.parse().map_err(|e| format!("Invalid method: {e}"))?;

    let mut header_map = HeaderMap::new();
    for (k, v) in &req.headers {
        let name = HeaderName::from_bytes(k.as_bytes()).map_err(|e| format!("Invalid header name: {e}"))?;
        let value = HeaderValue::from_str(v).map_err(|e| format!("Invalid header value: {e}"))?;
        header_map.insert(name, value);
    }

    let mut builder = client.request(method, &req.url).headers(header_map).timeout(std::time::Duration::from_secs(30));
    if let Some(body) = req.body {
        builder = builder.body(body);
    }

    let res = builder.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let status_text = res.status().canonical_reason().unwrap_or("").to_string();

    let mut headers = HashMap::new();
    for (k, v) in res.headers() {
        if let Ok(val) = v.to_str() {
            headers.insert(k.as_str().to_string(), val.to_string());
        }
    }

    let body = res.text().await.map_err(|e| e.to_string())?;

    Ok(ProxyResponse { status, status_text, headers, body })
}

#[tauri::command]
async fn http_proxy_stream(req: ProxyRequest, on_chunk: Channel<StreamChunk>) -> Result<(), String> {
    use futures_util::StreamExt;

    let client = reqwest::Client::new();
    let method: reqwest::Method = req.method.parse().map_err(|e| format!("Invalid method: {e}"))?;

    let mut header_map = HeaderMap::new();
    for (k, v) in &req.headers {
        let name = HeaderName::from_bytes(k.as_bytes()).map_err(|e| format!("Invalid header name: {e}"))?;
        let value = HeaderValue::from_str(v).map_err(|e| format!("Invalid header value: {e}"))?;
        header_map.insert(name, value);
    }

    let mut builder = client.request(method, &req.url).headers(header_map);
    if let Some(body) = req.body {
        builder = builder.body(body);
    }

    let res = builder.send().await.map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status().as_u16();
        let body = res.text().await.unwrap_or_default();
        let _ = on_chunk.send(StreamChunk {
            kind: "error".into(),
            data: format!("{status}: {body}"),
        });
        return Ok(());
    }

    let mut stream = res.bytes_stream();
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes).to_string();
                let _ = on_chunk.send(StreamChunk {
                    kind: "data".into(),
                    data: text,
                });
            }
            Err(e) => {
                let _ = on_chunk.send(StreamChunk {
                    kind: "error".into(),
                    data: e.to_string(),
                });
                return Ok(());
            }
        }
    }

    let _ = on_chunk.send(StreamChunk {
        kind: "done".into(),
        data: String::new(),
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![http_proxy, http_proxy_stream])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
