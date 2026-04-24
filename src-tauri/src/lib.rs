use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Deserialize)]
struct FormDataEntry {
    key: String,
    value: String,
    #[serde(rename = "type")]
    entry_type: String,
    #[serde(rename = "fileName")]
    file_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HttpRequest {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    form_data: Option<Vec<FormDataEntry>>,
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

    // 处理 body 或 form-data
    if let Some(form_data) = req.form_data {
        // 构建 multipart form
        let mut form = reqwest::multipart::Form::new();

        for entry in form_data {
            if entry.entry_type == "file" {
                // 解码 base64 文件数据
                let file_data = general_purpose::STANDARD.decode(&entry.value)
                    .map_err(|e| format!("解码文件数据失败: {}", e))?;

                let file_name = entry.file_name.unwrap_or_else(|| "file".to_string());

                // 根据文件名推断 MIME 类型
                let mime_type = mime_guess::from_path(&file_name)
                    .first_or_octet_stream();

                // 创建 multipart part，设置正确的 MIME 类型
                let part = reqwest::multipart::Part::bytes(file_data)
                    .file_name(file_name)
                    .mime_str(mime_type.as_ref())
                    .map_err(|e| format!("设置 MIME 类型失败: {}", e))?;

                form = form.part(entry.key, part);
            } else {
                // 文本字段
                form = form.text(entry.key, entry.value);
            }
        }

        request_builder = request_builder.multipart(form);
    } else if let Some(body) = req.body {
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
