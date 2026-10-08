package com.bahraich.dashcam;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
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

        // 🛡️ Android 14 क्रैश-प्रूफ फ़ोरग्राउंड स्टार्ट
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(101, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(101, notification);
            }
        } catch (Exception e) {
            try { startForeground(101, notification); } catch (Exception ignored) {}
        }

        // 🔋 सुरक्षित वेकलॉक
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Dashcam::FleetWakeLock");
                wakeLock.acquire(10*60*1000L /* 10 मिनट सेफ़टी */);
            }
        } catch (Exception ignored) {}

        startNativeLocationTracking();
    }

    private void startNativeLocationTracking() {
        // 🎯 क्रैश से सुरक्षा: सिर्फ तभी चालू करो जब ड्राइवर ने परमिशन Allow कर दी हो
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) return;

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 20000, 15, this);
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 20000, 15, this);
            }
        } catch (SecurityException se) {
            // Android 14 सुरक्षा एरर को चुपचाप पकड़ना (ताकि ऐप कभी क्रैश न हो)
        } catch (Exception ignored) {}
    }

    @Override
    public void onLocationChanged(Location loc) {
        if (loc == null) return;
        sendLocationDirectToFirestore(loc);
    }

    private void sendLocationDirectToFirestore(final Location loc) {
        new Thread(() -> {
            try {
                SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                String truck = prefs.getString("driver_vehicle_num", "");
                if (truck == null || truck.trim().isEmpty()) {
                    truck = "UP74T4826";
                }
                truck = truck.replaceAll("[^a-zA-Z0-9]", "").toUpperCase();

                SimpleDateFormat sdf = new SimpleDateFormat("hh:mm a", Locale.getDefault());
                String istTime = sdf.format(new Date());

                String urlStr = "https://firestore.googleapis.com/v1/projects/dashcamfordrive/databases/(default)/documents/truck_locations/" + truck + "?updateMask.fieldPaths=lat&updateMask.fieldPaths=lng&updateMask.fieldPaths=speed&updateMask.fieldPaths=timestamp&updateMask.fieldPaths=last_seen&updateMask.fieldPaths=device_info&updateMask.fieldPaths=status";

                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("PATCH");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);

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

                conn.getResponseCode();
                conn.disconnect();
            } catch (Exception ignored) {}
        }).start();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startNativeLocationTracking(); // परमिशन मिलने के बाद दोबारा प्रयास
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        try {
            if (locationManager != null) locationManager.removeUpdates(this);
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {}
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