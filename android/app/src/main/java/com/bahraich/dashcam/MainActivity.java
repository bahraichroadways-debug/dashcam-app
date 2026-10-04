package com.bahraich.dashcam;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        super.onPause();
        // 🎯 बैकग्राउंड जीपीएस अनफ्रीज: स्क्रीन ऑफ होने पर भी टाइमर 24/7 चालू रहेगा
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().resumeTimers();
        }
    }
}