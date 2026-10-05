package com.bahraich.dashcam;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startFleetService();
    }

    @Override
    public void onPause() {
        super.onPause();
        // 🎯 स्क्रीन ऑफ होने पर भी टाइमर चालू रहेगा (नो स्लीप)
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().resumeTimers();
        }
    }

    private void startFleetService() {
        try {
            Intent serviceIntent = new Intent(this, BackgroundFleetService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}