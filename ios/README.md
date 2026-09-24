# FitTrack iPhone

该工程使用 SwiftUI 和 `WKWebView` 承载现有 FitTrack 前端。Xcode 构建阶段会在仓库根目录运行 `npm run build`，再把 `dist/` 复制进 App Bundle，因此网页与 iPhone 版共用一套 UI 和业务逻辑。

构建阶段会将 Vite 的单文件入口脚本改为延迟加载的普通脚本。`WKWebView` 从 App 内的 `file://` 路径打开页面时，这可避免模块脚本因本地文件限制而无法执行，造成空白页。

## 打开与运行

1. 用 Xcode 打开 `ios/FitTrack.xcodeproj`。
2. 选择 FitTrack Target → Signing & Capabilities。
3. 选择自己的 Team；如 Bundle Identifier 已被占用，请改为自己的唯一标识。
4. 先选择 iPhone 模拟器运行，确认界面加载。
5. HealthKit 权限与真实健康数据请使用已登录同一 Apple ID 的真机测试。

工程已经添加 HealthKit Capability，并向网页注入 `window.fittrackNative`：

```js
window.fittrackNative.healthKitAvailable()
window.fittrackNative.requestHealthAuthorization()
window.addEventListener('fittrack:healthkit', (event) => console.log(event.detail))
```

目前桥接只完成可用性检查和权限申请，不会在启动时主动请求权限，也尚未导入健康数据。
