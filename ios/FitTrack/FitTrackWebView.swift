import SwiftUI
import WebKit

struct FitTrackWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true

        let controller = configuration.userContentController
        controller.add(context.coordinator.healthKitBridge, name: HealthKitBridge.handlerName)
        controller.addUserScript(WKUserScript(
            source: Self.nativeBridgeScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.051, green: 0.055, blue: 0.055, alpha: 1)
        webView.scrollView.backgroundColor = UIColor(red: 0.051, green: 0.055, blue: 0.055, alpha: 1)
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.allowsBackForwardNavigationGestures = false
        context.coordinator.healthKitBridge.webView = webView
        loadApp(in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    private func loadApp(in webView: WKWebView) {
        guard let directory = Bundle.main.url(forResource: "web", withExtension: nil),
              let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") else {
            webView.loadHTMLString(Self.missingBuildPage, baseURL: nil)
            return
        }
        webView.loadFileURL(index, allowingReadAccessTo: directory)
    }

    final class Coordinator {
        let healthKitBridge = HealthKitBridge()
    }

    private static let nativeBridgeScript = """
    window.fittrackNative = Object.freeze({
      platform: 'ios',
      healthKitAvailable: () => window.webkit.messageHandlers.healthKit.postMessage({ action: 'availability' }),
      requestHealthAuthorization: () => window.webkit.messageHandlers.healthKit.postMessage({ action: 'requestAuthorization' })
    });
    """

    private static let missingBuildPage = """
    <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font:17px -apple-system;padding:48px 24px;color:#f0eee4;background:#0d0e0e}main{max-width:520px;margin:auto;background:#1b1d1d;padding:28px;border:1px solid #505554}code{word-break:break-all;color:#f4c64b}</style>
    <main><h1>FitTrack 网页资源尚未生成</h1><p>回到项目根目录运行 <code>npm ci</code>，然后重新在 Xcode 构建。Xcode 会自动执行 <code>npm run build</code> 并复制网页资源。</p></main>
    """
}
