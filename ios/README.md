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

## 微信登录接入准备

当前版本没有微信登录，也不会把本地记录上传。接入前需先准备可用于 iOS 应用的微信开放平台 AppID、对应的 iOS 关联配置，并规划服务端完成登录凭证交换与用户身份映射；敏感密钥不得放入 App 或打包网页。登录后还需要明确本地记录如何经用户确认关联到账号，避免覆盖现有 IndexedDB 数据。在这些条件具备前，首次设置和所有记录功能保持本地可用。
