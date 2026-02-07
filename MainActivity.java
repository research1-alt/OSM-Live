package com.example.osmlive;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

/**
 * MainActivity for OSM Live.
 * Hosts the tactical PCAN HUD in an optimized full-screen WebView.
 */
public class MainActivity extends AppCompatActivity {

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Set the layout.
        setContentView(R.layout.activity_main);

        webView = (WebView) findViewById(R.id.webView);
        
        if (webView != null) {
            setupWebView();
            // Loading the tactical dashboard URL
            webView.loadUrl("https://live-data-rust.vercel.app/");
        }

        setupBackNavigation();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); 
        settings.setDomStorageEnabled(true); 
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        
        // Critical for modern web apps
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        // Identify as the official Mobile App to the React layer
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidInterface");

        // Use a modern User Agent to prevent "Unsupported Browser" blocks
        String userAgent = settings.getUserAgentString();
        settings.setUserAgentString(userAgent + " OSMLiveApp/1.0");

        webView.setWebViewClient(new WebViewClient());
        
        // Handle hardware permissions within WebView
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                MainActivity.this.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }
        });
    }

    private void setupBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }

    /**
     * Interface to communicate between JavaScript and Java.
     */
    public class WebAppInterface {
        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }
        
        @JavascriptInterface
        public String getAppVersion() {
            return "1.0.4-TACTICAL";
        }
    }
}