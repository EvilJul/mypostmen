use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct HttpRequest {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
}

#[derive(Debug, Serialize)]
struct HttpResponse {
    status: u16,
    status_text: String,
    headers: HashMap<String, String>,
    body: String,
}

#[tauri::command]
async fn http_proxy(req: HttpRequest) -> Result<HttpResponse, String> {
    // 构建 HTTP 客户端
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    // 构建请求
    let method = reqwest::Method::from_bytes(req.method.as_bytes())
        .map_err(|e| format!("无效的 HTTP 方法: {}", e))?;

    let mut request_builder = client.request(method, &req.url);

    // 添加 headers
    for (key, value) in req.headers {
        request_builder = request_builder.header(key, value);
    }

    // 添加 body
    if let Some(body) = req.body {
        request_builder = request_builder.body(body);
    }

    // 发送请求
    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    // 提取响应信息
    let status = response.status().as_u16();
    let status_text = response.status().canonical_reason().unwrap_or("").to_string();

    let mut headers = HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(value_str) = value.to_str() {
            headers.insert(key.to_string(), value_str.to_string());
        }
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("读取响应体失败: {}", e))?;

    Ok(HttpResponse {
        status,
        status_text,
        headers,
        body,
    })
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
    .invoke_handler(tauri::generate_handler![http_proxy])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
