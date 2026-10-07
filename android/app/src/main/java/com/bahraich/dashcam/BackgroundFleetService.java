package com.bahraich.dashcam;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class BackgroundFleetService extends Service implements LocationListener {
    private static final String CHANNEL_ID = "fleet_tracking_channel";
    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("🚛 Bahraich Roadways Fleet")
                .setContentText("24/7 लाइव जीपीएस ट्रैकिंग सक्रिय")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();

        startForeground(101, notification);

        // 🔋 हल्का वेकलॉक (0% बैटरी ड्रेन)
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Dashcam::FleetWakeLock");
            wakeLock.acquire();
        }

        startNativeLocationTracking();
    }

    @SuppressLint("MissingPermission")
    private void startNativeLocationTracking() {
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) return;

        try {
            // 🎯 स्मार्ट बैटरी सेवर: 20 सेकंड या 15 मीटर चलने पर ही जीपीएस जगेगा!
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 20000, 15, this);
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 20000, 15, this);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onLocationChanged(Location loc) {
        if (loc == null) return;
        sendLocationDirectToFirestore(loc);
    }

    // 📡 सीधे Android Native से Firestore में लाइव लोकेशन भेजना (0% WebView Dependency)
    private void sendLocationDirectToFirestore(final Location loc) {
        new Thread(() -> {
            try {
                // गाड़ी का नंबर प्राप्त करना
                SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                String truck = prefs.getString("driver_vehicle_num", "");
                if (truck == null || truck.trim().isEmpty()) {
                    truck = "UP74T4826"; // फ़ॉलबैक
                }
                truck = truck.replaceAll("[^a-zA-Z0-9]", "").toUpperCase();

                SimpleDateFormat sdf = new SimpleDateFormat("hh:mm a", Locale.getDefault());
                String istTime = sdf.format(new Date());

                // Firestore REST API एंडपॉइंट
                String urlStr = "https://firestore.googleapis.com/v1/projects/dashcamfordrive/databases/(default)/documents/truck_locations/" + truck + "?updateMask.fieldPaths=lat&updateMask.fieldPaths=lng&updateMask.fieldPaths=speed&updateMask.fieldPaths=timestamp&updateMask.fieldPaths=last_seen&updateMask.fieldPaths=device_info&updateMask.fieldPaths=status";

                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("PATCH");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);

                long now = System.currentTimeMillis();
                String jsonBody = "{"
                        + "\"fields\": {"
                        + "\"lat\": {\"doubleValue\": " + loc.getLatitude() + "},"
                        + "\"lng\": {\"doubleValue\": " + loc.getLongitude() + "},"
                        + "\"speed\": {\"doubleValue\": " + loc.getSpeed() + "},"
                        + "\"timestamp\": {\"integerValue\": \"" + now + "\"},"
                        + "\"last_seen\": {\"stringValue\": \"" + istTime + "\"},"
                        + "\"device_info\": {\"stringValue\": \"Android App (Native APK)\"},"
                        + "\"status\": {\"stringValue\": \"ACTIVE\"}"
                        + "}"
                        + "}";

                OutputStream os = conn.getOutputStream();
                os.write(jsonBody.getBytes("UTF-8"));
                os.close();

                int code = conn.getResponseCode();
                conn.disconnect();
            } catch (Exception e) {
                // साइलेंट
            }
        }).start();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (locationManager != null) {
            locationManager.removeUpdates(this);
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override
    public void onProviderEnabled(String provider) {}
    @Override
    public void onProviderDisabled(String provider) {}

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Fleet Live Tracking",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("24/7 background GPS tracking service");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}