# MyPostmen 多平台编译指南

## 前置要求（所有平台通用）

- Node.js >= 18
- npm >= 9
- Rust >= 1.77.2（通过 rustup 安装）
- Tauri CLI（已包含在 devDependencies 中）

```bash
# 安装前端依赖
npm install
```

---

## macOS

### 环境准备

1. 安装 Xcode Command Line Tools：
```bash
xcode-select --install
```

2. 安装 Rust（使用清华镜像）：
```bash
export RUSTUP_DIST_SERVER=https://mirrors.tuna.tsinghua.edu.cn/rustup
export RUSTUP_UPDATE_ROOT=https://mirrors.tuna.tsinghua.edu.cn/rustup/rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

3. 配置 Cargo 清华镜像，编辑 `~/.cargo/config.toml`：
```toml
[source.crates-io]
replace-with = "tuna"

[source.tuna]
registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"
```

### 编译

```bash
# 开发模式（热更新）
npm run tauri:dev

# 生产构建
npm run tauri:build
```

### 产物位置

| 文件 | 路径 |
|------|------|
| .app 应用 | `src-tauri/target/release/bundle/macos/MyPostmen.app` |
| .dmg 安装包 | `src-tauri/target/release/bundle/dmg/MyPostmen_0.1.0_aarch64.dmg` |

### 注意事项

- Apple Silicon (M1/M2/M3/M4) 默认编译 `aarch64-apple-darwin`
- 如需编译 Intel 版本：
```bash
rustup target add x86_64-apple-darwin
npm run tauri:build -- --target x86_64-apple-darwin
```
- 如需编译通用二进制（同时支持 Intel + Apple Silicon）：
```bash
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
npm run tauri:build -- --target universal-apple-darwin
```
- 分发给其他用户时，需要对 App 进行签名，否则 macOS 会提示"无法验证开发者"。开发阶段可右键打开绕过

---

## Windows

### 环境准备

1. 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，勾选：
   - "使用 C++ 的桌面开发" 工作负载
   - Windows 10/11 SDK

2. 安装 [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)（Windows 10 1803+ 和 Windows 11 通常已预装）

3. 安装 Rust（使用清华镜像），在 PowerShell 中：
```powershell
$env:RUSTUP_DIST_SERVER = "https://mirrors.tuna.tsinghua.edu.cn/rustup"
$env:RUSTUP_UPDATE_ROOT = "https://mirrors.tuna.tsinghua.edu.cn/rustup/rustup"
Invoke-WebRequest -Uri https://win.rustup.rs/x86_64 -OutFile rustup-init.exe
.\rustup-init.exe
```

4. 配置 Cargo 清华镜像，编辑 `%USERPROFILE%\.cargo\config.toml`：
```toml
[source.crates-io]
replace-with = "tuna"

[source.tuna]
registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"
```

5. 永久设置 Rustup 镜像，在系统环境变量中添加：
```
RUSTUP_DIST_SERVER = https://mirrors.tuna.tsinghua.edu.cn/rustup
RUSTUP_UPDATE_ROOT = https://mirrors.tuna.tsinghua.edu.cn/rustup/rustup
```

### 编译

```powershell
# 开发模式
npm run tauri:dev

# 生产构建
npm run tauri:build
```

### 产物位置

| 文件 | 路径 |
|------|------|
| .msi 安装包 | `src-tauri\target\release\bundle\msi\MyPostmen_0.1.0_x64_en-US.msi` |
| .exe 安装包 (NSIS) | `src-tauri\target\release\bundle\nsis\MyPostmen_0.1.0_x64-setup.exe` |

### 注意事项

- 默认编译 `x86_64-pc-windows-msvc`
- 如需编译 ARM64 版本：
```powershell
rustup target add aarch64-pc-windows-msvc
npm run tauri:build -- --target aarch64-pc-windows-msvc
```
- NSIS 安装包支持"每用户安装"（无需管理员权限），MSI 需要管理员权限

---

## Linux

### 环境准备

#### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  libsoup-3.0-dev
```

#### Fedora

```bash
sudo dnf install -y \
  gcc gcc-c++ \
  openssl-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  webkit2gtk4.1-devel \
  javascriptcoregtk4.1-devel \
  libsoup3-devel
```

#### Arch Linux

```bash
sudo pacman -S --needed \
  base-devel \
  curl \
  wget \
  openssl \
  gtk3 \
  libappindicator-gtk3 \
  librsvg \
  webkit2gtk-4.1 \
  libsoup3
```

安装 Rust（所有发行版通用）：

```bash
export RUSTUP_DIST_SERVER=https://mirrors.tuna.tsinghua.edu.cn/rustup
export RUSTUP_UPDATE_ROOT=https://mirrors.tuna.tsinghua.edu.cn/rustup/rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

配置 Cargo 清华镜像，编辑 `~/.cargo/config.toml`：
```toml
[source.crates-io]
replace-with = "tuna"

[source.tuna]
registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"
```

永久设置 Rustup 镜像，添加到 `~/.bashrc` 或 `~/.zshrc`：
```bash
export RUSTUP_DIST_SERVER=https://mirrors.tuna.tsinghua.edu.cn/rustup
export RUSTUP_UPDATE_ROOT=https://mirrors.tuna.tsinghua.edu.cn/rustup/rustup
```

### 编译

```bash
# 开发模式
npm run tauri:dev

# 生产构建
npm run tauri:build
```

### 产物位置

| 文件 | 路径 |
|------|------|
| .deb 安装包 | `src-tauri/target/release/bundle/deb/my-postmen_0.1.0_amd64.deb` |
| .rpm 安装包 | `src-tauri/target/release/bundle/rpm/my-postmen-0.1.0-1.x86_64.rpm` |
| .AppImage | `src-tauri/target/release/bundle/appimage/my-postmen_0.1.0_amd64.AppImage` |

### 注意事项

- AppImage 是最通用的格式，无需安装，`chmod +x` 后直接运行
- .deb 适用于 Ubuntu/Debian，.rpm 适用于 Fedora/CentOS
- 如果桌面环境不是 GNOME，可能需要额外安装 `libappindicator` 相关包来支持系统托盘

---

## GitHub Actions 自动化构建（可选）

如果需要在 CI 中同时构建三个平台，在 `.github/workflows/build.yml` 中配置：

```yaml
name: Build

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - platform: macos-latest
            args: --target aarch64-apple-darwin
          - plat-latest
            args: --target x86_64-apple-darwin
          - platform: ubuntu-22.04
            args: ''
          - platform: windows-latest
            args: ''

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt update
          sudo apt install -y \
            libgtk-3-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev \
            libwebkit2gtk-4.1-dev \
            libjavascriptcoregtk-4.1-dev \
            libsoup-3.0-dev

      - name: Install frontend dependencies
        run: npm install

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          args: ${{ matrix.args }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-${{ matrix.platform }}
          path: src-tauri/target/release/bundle/**/*
```

推送 `v*` 格式的 tag 即可触发构建，产物会上传到 Actions Artifacts。

---

## 常见问题

### 首次编译很慢

正常现象。首次需要编译约 500 个 Rust 依赖，耗时 2-5 分钟。后续增量编译只需几秒。

### macOS 提示"无法验证开发者"

未签名的 App 会被 Gatekeeper 拦截。开发阶段：右键点击 App → 打开 → 确认打开。正式分发需要 Apple Developer 证书签名。

### Windows 缺少 WebView2

Windows 10 1803 以下版本需要手动安装 [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)。也可以在 `tauri.conf.json` 中配置 NSIS 安装包自动下载安装 WebView2。

### Linux 运行 AppImage 报错

确保有执行权限：
```bash
chmod +x MyPostmen_0.1.0_amd64.AppImage
./MyPostmen_0.1.0_amd64.AppImage
```

如果报 F关错误：
```bash
sudo apt install libfuse2   # Ubuntu 22.04+
```

### 清理编译缓存

```bash
cd src-tauri
cargo clean
```

这会删除 `target/` 目录（约 1-3 GB），下次编译会重新下载和编译依赖。
