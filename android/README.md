# FitTrack Android

本工程把仓库根目录的网页构建产物放入 APK，用原生 WebView 显示。界面和业务逻辑与网页端共用；每台 Android 设备都有独立的 IndexedDB 数据库。Android 版目前没有 Health Connect 或智能手表数据接入。

## 打开和运行

1. 安装 Android Studio，在 SDK Manager 中安装 Android SDK Platform 36 和 Build Tools 36。Android Studio 自带 JDK 17 或更新版本。
2. 在仓库根目录运行 `npm ci`（Node.js 24）。
3. Android Studio → Open → 选择本目录 `android/`。等待 Gradle 同步完成。
4. 选择 Android 8.0（API 26）或更新的模拟器/手机，点击 Run。

Android Studio 的构建会先运行 `npm run build`，再把 `dist/` 复制到 Android 资源目录。命令行可在本目录运行 `./gradlew :app:assembleDebug`。调试 APK 输出到 `app/build/outputs/apk/debug/app-debug.apk`。

备份导出使用 Android 系统“保存到文件”，导入使用系统文件选择器。右上角的外部数据来源链接会在系统浏览器打开。当前 App 的本地记录不会与浏览器或 iPhone 自动同步；可以通过 JSON 备份或“连接数据库”手动迁移。

## 本机命令行构建

如果已把 Java 17、Gradle 9.4.1 和 Android SDK 安装到本工程的 `.toolchain/`，在仓库根目录执行：

```sh
./android/build-local.sh
```

脚本会自动选择项目内工具，并把构建缓存放到忽略提交的 `.gradle-user/`。没有项目内工具时会调用标准 Gradle Wrapper，使用系统配置的 Java 和 Android SDK。无需改变系统默认 Java 版本。工具和 SDK 许可文件都不会提交到 GitHub。

Android 状态栏、屏幕缺口、底部导航栏及键盘由原生外壳处理安全边距。当前产物为开发用调试 APK；正式发布需要另外配置应用签名。

2026-10-10 已完成调试 APK 构建与签名校验，并在 Android 15 / API 35 ARM64 模拟器验证：首次资料保存、主要页面切换、系统返回键、重启后本地资料保留、原生 JSON 导出/导入恢复，以及连接临时 SQLite 后端。测试使用独立的模拟器示例资料和内存数据库。

## 连接自己的后端

在 Mac 上执行 `FITTRACK_HOST=0.0.0.0 npm run server`，使本机 SQLite 服务监听局域网。Android App 中输入 `http://<Mac 的局域网 IP>:8787` 和服务显示的访问密钥。两台设备必须在同一可信网络，服务只适合个人开发和测试。Android 工程允许用户主动输入的局域网 HTTP 地址；此连接没有传输加密，对公网使用时应改为 HTTPS。

Android 版借助 `WebViewAssetLoader` 使用 `https://appassets.androidplatform.net` 作为固定本地来源。后端只放行这个精确来源及原有网页/iPhone 来源，不向任意网站开放 API。联网动作图片需要网络连接；内置界面、基础食物库和本地记录可以离线使用。
