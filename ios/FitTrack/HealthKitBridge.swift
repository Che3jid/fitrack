import HealthKit
import WebKit

final class HealthKitBridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "healthKit"

    weak var webView: WKWebView?
    private let healthStore = HKHealthStore()

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.handlerName,
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch action {
        case "availability":
            send(event: "availability", payload: ["available": HKHealthStore.isHealthDataAvailable()])
        case "requestAuthorization":
            requestAuthorization()
        default:
            send(event: "error", payload: ["message": "不支持的 HealthKit 操作。"])
        }
    }

    private func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else {
            send(event: "authorization", payload: ["completed": false, "message": "此设备不支持健康数据。"])
            return
        }

        let readTypes: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKObjectType.quantityType(forIdentifier: .bodyMass),
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned),
            HKObjectType.quantityType(forIdentifier: .heartRate),
            HKObjectType.quantityType(forIdentifier: .stepCount),
        ].compactMap { $0 }.reduce(into: Set<HKObjectType>()) { $0.insert($1) }

        healthStore.requestAuthorization(toShare: Set<HKSampleType>(), read: readTypes) { [weak self] success, error in
            let message = error?.localizedDescription ?? (success ? "健康数据授权流程已完成。" : "未能完成健康数据授权。")
            self?.send(event: "authorization", payload: ["completed": success, "message": message])
        }
    }

    private func send(event: String, payload: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        let script = "window.dispatchEvent(new CustomEvent('fittrack:healthkit', { detail: { event: '\(event)', payload: \(json) } }));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script)
        }
    }
}
