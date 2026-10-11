package com.fittrack.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.os.Message;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private static final String APP_URL = APP_ORIGIN + "/assets/web/index.html#/today";
    private static final int PICK_BACKUP = 1001;
    private static final int SAVE_BACKUP = 1002;
    private static final int MAX_BACKUP_BYTES = 20 * 1024 * 1024;

    private WebView webView;
    private ValueCallback<Uri[]> uploadCallback;
    private String pendingBackup;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setBackgroundColor(0xFFF5F4F1);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Android's document picker returns content:// URIs.
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setSafeBrowsingEnabled(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (view.getParent() instanceof ViewGroup) ((ViewGroup) view.getParent()).removeView(view);
                view.destroy();
                webView = null;
                Toast.makeText(MainActivity.this, "页面已重新加载，已保存的记录仍在本机", Toast.LENGTH_LONG).show();
                recreate();
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (APP_ORIGIN.equals(uri.getScheme() + "://" + uri.getAuthority())
                    && uri.getPath() != null && uri.getPath().startsWith("/assets/web/")) return false;
                if (!request.isForMainFrame()) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException exception) {
                    Toast.makeText(MainActivity.this, "无法打开此链接", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog,
                                          boolean isUserGesture, Message resultMsg) {
                if (!isUserGesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean onRenderProcessGone(WebView child, RenderProcessGoneDetail detail) {
                        child.destroy();
                        return true;
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) {
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                        } catch (ActivityNotFoundException exception) {
                            Toast.makeText(MainActivity.this, "无法打开此链接", Toast.LENGTH_SHORT).show();
                        }
                        child.post(child::destroy);
                        return true;
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (uploadCallback != null) uploadCallback.onReceiveValue(null);
                uploadCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), PICK_BACKUP);
                    return true;
                } catch (ActivityNotFoundException exception) {
                    uploadCallback = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "没有可用的文件选择器", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        webView.addJavascriptInterface(new BackupBridge(), "fittrackAndroid");
        FrameLayout content = new FrameLayout(this);
        content.setBackgroundColor(0xFFF5F4F1);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
        content.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars()
                    | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            }
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        content.addView(webView);
        setContentView(content);
        content.requestApplyInsets();
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(APP_URL);
        }
    }

    private final class BackupBridge {
        @JavascriptInterface
        public void saveBackup(String name, String data) {
            if (data == null || data.getBytes(StandardCharsets.UTF_8).length > MAX_BACKUP_BYTES) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "备份文件过大", Toast.LENGTH_SHORT).show());
                return;
            }
            runOnUiThread(() -> {
                pendingBackup = data;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/json")
                    .putExtra(Intent.EXTRA_TITLE, name);
                try {
                    startActivityForResult(intent, SAVE_BACKUP);
                } catch (ActivityNotFoundException exception) {
                    pendingBackup = null;
                    Toast.makeText(MainActivity.this, "没有可用的文件保存器", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_BACKUP && uploadCallback != null) {
            uploadCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            uploadCallback = null;
        } else if (requestCode == SAVE_BACKUP && pendingBackup != null) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                try (OutputStream stream = getContentResolver().openOutputStream(data.getData())) {
                    if (stream == null) throw new IOException("无法写入文件");
                    stream.write(pendingBackup.getBytes(StandardCharsets.UTF_8));
                    Toast.makeText(this, "备份已保存", Toast.LENGTH_SHORT).show();
                } catch (IOException exception) {
                    Toast.makeText(this, "备份保存失败", Toast.LENGTH_LONG).show();
                }
            }
            pendingBackup = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        if (webView != null) webView.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    protected void onDestroy() {
        if (uploadCallback != null) uploadCallback.onReceiveValue(null);
        if (webView != null) {
            webView.removeJavascriptInterface("fittrackAndroid");
            if (webView.getParent() instanceof ViewGroup) {
                ((ViewGroup) webView.getParent()).removeView(webView);
            }
            webView.destroy();
        }
        super.onDestroy();
    }
}
