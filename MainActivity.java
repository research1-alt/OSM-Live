
package com.example.osmlive;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bluetoothLeScanner;
    private BluetoothGatt bluetoothGatt;
    private static final int PERMISSION_REQUEST_CODE = 1234;
    private static final String TAG = "OSM_NATIVE_BLE";
    private static final String CHANNEL_ID = "OSM_FILE_EXPORTS";

    private static final UUID UART_SERVICE_UUID = UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID TX_CHAR_UUID = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID CLIENT_CHARACTERISTIC_CONFIG = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Handler scanHandler = new Handler(Looper.getMainLooper());
    private boolean isScanning = false;
    private boolean isPendingScan = false;

    private final ActivityResultLauncher<Intent> enableBtLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == Activity.RESULT_OK) {
                    sendToJs("STATE_SUCCESS: Bluetooth enabled.");
                    scanHandler.postDelayed(() -> new NativeBleBridge().startBleLink(), 1000);
                } else {
                    sendToJs("STATE_ERROR: Bluetooth enabling rejected.");
                    evaluateJs("window.onNativeBleStatus('error')");
                }
            }
    );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.webView);

        initBluetooth();
        createNotificationChannel();
        checkAndRequestPermissions();
        setupWebView();
        
        webView.loadUrl("https://live-data-rust.vercel.app/");
        setupBackNavigation();
    }

    private void initBluetooth() {
        BluetoothManager bluetoothManager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        if (bluetoothManager != null) {
            bluetoothAdapter = bluetoothManager.getAdapter();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "File Exports";
            String description = "Notifications for saved CAN trace files";
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private void checkAndRequestPermissions() {
        List<String> permissions = new ArrayList<>();
        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
        permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions.add(Manifest.permission.BLUETOOTH_SCAN);
            permissions.add(Manifest.permission.BLUETOOTH_CONNECT);
        }
        
        List<String> needed = new ArrayList<>();
        for (String p : permissions) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                needed.add(p);
            }
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    private boolean isLocationEnabled() {
        LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        return lm != null && (lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        webView.addJavascriptInterface(new NativeBleBridge(), "NativeBleBridge");
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidInterface");

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });
    }

    @SuppressWarnings("unused")
    public class NativeBleBridge {
        @JavascriptInterface
        public void startBleLink() {
            runOnUiThread(() -> {
                if (isPendingScan) return;
                
                if (bluetoothAdapter == null) {
                    sendToJs("STATE_ERROR: Bluetooth Hardware not found.");
                    evaluateJs("window.onNativeBleStatus('error')");
                    return;
                }

                if (!bluetoothAdapter.isEnabled()) {
                    sendToJs("STATE_ERROR: Bluetooth is OFF.");
                    Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                    if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                        enableBtLauncher.launch(enableBtIntent);
                    }
                    return;
                }

                if (!isLocationEnabled()) {
                    sendToJs("STATE_ERROR: Location Services are OFF.");
                    startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
                    evaluateJs("window.onNativeBleStatus('error')");
                    return;
                }

                // Aggressive reset to clear Registration Code 2
                stopBleScan();
                
                isPendingScan = true;
                sendToJs("SCAN_RESET: Releasing internal handles...");
                
                scanHandler.postDelayed(() -> {
                    isPendingScan = false;
                    bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
                    if (bluetoothLeScanner == null) {
                        sendToJs("SCAN_ERROR: Internal stack error. Toggle Bluetooth.");
                        evaluateJs("window.onNativeBleStatus('error')");
                        return;
                    }

                    ScanSettings scanSettings = new ScanSettings.Builder()
                            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
                            .build();

                    if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED) {
                        try {
                            isScanning = true;
                            bluetoothLeScanner.startScan(null, scanSettings, scanCallback);
                            sendToJs("SCAN_INIT: Monitoring 2.4GHz...");
                            
                            scanHandler.removeCallbacksAndMessages(null);
                            scanHandler.postDelayed(() -> {
                                if (isScanning) {
                                    stopBleScan();
                                    sendToJs("SCAN_TIMEOUT: No compatible device detected.");
                                    evaluateJs("window.onNativeBleStatus('disconnected')");
                                }
                            }, 25000);
                        } catch (Exception e) {
                            isScanning = false;
                            sendToJs("SCAN_EXCEPTION: " + e.getMessage());
                            evaluateJs("window.onNativeBleStatus('error')");
                        }
                    } else {
                        sendToJs("STATE_ERROR: Permissions denied.");
                        evaluateJs("window.onNativeBleStatus('error')");
                    }
                }, 800); // 800ms gap to ensure system registration is cleared
            });
        }

        private void stopBleScan() {
            if (bluetoothLeScanner != null && isScanning) {
                if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED) {
                    try {
                        bluetoothLeScanner.stopScan(scanCallback);
                    } catch (Exception e) {
                        Log.e(TAG, "Stop scan error", e);
                    }
                }
            }
            isScanning = false;
            bluetoothLeScanner = null;
        }

        @JavascriptInterface
        public void disconnectBle() {
            runOnUiThread(() -> {
                stopBleScan();
                if (bluetoothGatt != null) {
                    if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                        bluetoothGatt.disconnect();
                        bluetoothGatt.close();
                        bluetoothGatt = null;
                        sendToJs("LINK_STATUS: Disconnected.");
                        evaluateJs("window.onNativeBleStatus('disconnected')");
                    }
                }
            });
        }
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            BluetoothDevice device = result.getDevice();
            if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                String name = device.getName();
                if (name != null) {
                    if (name.contains("OSM") || name.contains("ESP32") || name.contains("CAN")) {
                        sendToJs("LINK_MATCH: Found " + name);
                        if (isScanning && bluetoothLeScanner != null) {
                            bluetoothLeScanner.stopScan(scanCallback);
                            isScanning = false;
                        }
                        connectToDevice(device);
                    }
                }
            }
        }

        @Override
        public void onScanFailed(int errorCode) {
            isScanning = false;
            String message;
            switch (errorCode) {
                case SCAN_FAILED_APPLICATION_REGISTRATION_FAILED:
                    message = "INTERNAL_ERROR: App Registration Failed (Code 2). Please toggle Bluetooth OFF and ON in system settings.";
                    break;
                case SCAN_FAILED_ALREADY_STARTED:
                    message = "Scan currently active.";
                    break;
                case SCAN_FAILED_INTERNAL_ERROR:
                    message = "Bluetooth Controller Error.";
                    break;
                default:
                    message = "Scan failure code " + errorCode;
                    break;
            }
            sendToJs("SCAN_ERROR: " + message);
            evaluateJs("window.onNativeBleStatus('error')");
        }
    };

    private void connectToDevice(BluetoothDevice device) {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
            bluetoothGatt = device.connectGatt(this, false, gattCallback);
        }
    }

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                sendToJs("GATT_STATUS: Handshaking...");
                if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                    scanHandler.postDelayed(() -> {
                        if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                            gatt.requestMtu(512);
                        }
                    }, 800);
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                sendToJs("GATT_STATUS: Offline.");
                evaluateJs("window.onNativeBleStatus('disconnected')");
                if (bluetoothGatt != null) {
                    if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                        bluetoothGatt.close();
                    }
                    bluetoothGatt = null;
                }
            }
        }

        @Override
        public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
            if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                gatt.discoverServices();
            }
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt gatt, int status) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                BluetoothGattService service = gatt.getService(UART_SERVICE_UUID);
                if (service != null) {
                    BluetoothGattCharacteristic txChar = service.getCharacteristic(TX_CHAR_UUID);
                    if (txChar != null) {
                        if (ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                            gatt.setCharacteristicNotification(txChar, true);
                            BluetoothGattDescriptor descriptor = txChar.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG);
                            if (descriptor != null) {
                                descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                                gatt.writeDescriptor(descriptor);
                                sendToJs("BRIDGE_ACTIVE: Data streaming.");
                                evaluateJs("window.onNativeBleStatus('connected')");
                            }
                        }
                    }
                }
            }
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt gatt, @NonNull BluetoothGattCharacteristic characteristic) {
            if (TX_CHAR_UUID.equals(characteristic.getUuid())) {
                byte[] value = characteristic.getValue();
                if (value != null) {
                    String data = new String(value);
                    evaluateJs("window.onNativeBleData('" + data.replace("\n", "\\n").replace("\r", "") + "')");
                }
            }
        }
    };

    private void sendToJs(String msg) {
        evaluateJs("window.onNativeBleLog('" + msg + "')");
    }

    private void evaluateJs(String script) {
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(script, null);
        });
    }

    private void setupBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack();
                else finish();
            }
        });
    }

    @SuppressWarnings("unused")
    public class WebAppInterface {
        @JavascriptInterface
        public boolean isNativeApp() { return true; }

        @JavascriptInterface
        public void saveFile(String data, String fileName) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, "text/plain");
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri externalUri = Uri.parse("content://media/external/downloads");
                    Uri uri = getContentResolver().insert(externalUri, values);
                    if (uri != null) {
                        try (OutputStream outputStream = getContentResolver().openOutputStream(uri)) {
                            if (outputStream != null) {
                                outputStream.write(data.getBytes());
                                outputStream.flush();
                                onSaveComplete(fileName);
                            }
                        }
                    }
                } else {
                    File path = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!path.exists()) {
                        if (!path.mkdirs()) Log.e(TAG, "Failed to create directory");
                    }
                    File file = new File(path, fileName);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(data.getBytes());
                        fos.flush();
                    }
                    MediaScannerConnection.scanFile(MainActivity.this, new String[]{file.getAbsolutePath()}, null, null);
                    onSaveComplete(fileName);
                }
            } catch (Exception e) {
                sendToJs("FILE_ERROR: " + e.getMessage());
            }
        }

        private void onSaveComplete(String fileName) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Trace Exported: " + fileName, Toast.LENGTH_SHORT).show());
            sendToJs("NATIVE_SAVE: " + fileName);
        }
    }
}
