package com.lalganjeats.deliverypartner;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;

/**
 * Native notification channels for delivery offers.
 *
 * Channel settings are immutable once created on a device, so the ids must stay
 * in sync with backend app/core/fcm.py and notification.service.ts.
 */
public final class OfferAlertChannels {

    /** Offer pushes: alarm stream, so it rings even when the phone is on silent/vibrate. */
    public static final String OFFER_ALARM = "lalganjeats_offer_alarm_v3";
    /** Older builds and other urgent pushes. */
    public static final String URGENT = "lalganjeats_urgent_v2";

    private static final long[] VIBRATION = { 0, 600, 300, 600, 300, 900 };

    private OfferAlertChannels() {}

    public static void ensure(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Uri sound = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.getPackageName() + "/raw/order_alert");

        if (manager.getNotificationChannel(OFFER_ALARM) == null) {
            NotificationChannel alarm = new NotificationChannel(
                OFFER_ALARM,
                "New delivery offers (loud)",
                NotificationManager.IMPORTANCE_HIGH
            );
            alarm.setDescription("Rings at alarm volume for every new delivery offer");
            alarm.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            alarm.enableVibration(true);
            alarm.setVibrationPattern(VIBRATION);
            alarm.enableLights(true);
            alarm.setLightColor(0xFFFF0000);
            alarm.setBypassDnd(true);
            alarm.setSound(
                sound,
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
            manager.createNotificationChannel(alarm);
        }

        if (manager.getNotificationChannel(URGENT) == null) {
            NotificationChannel urgent = new NotificationChannel(
                URGENT,
                "Urgent Delivery Offers",
                NotificationManager.IMPORTANCE_HIGH
            );
            urgent.setDescription("Loud heads-up alerts for new delivery offers");
            urgent.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            urgent.enableVibration(true);
            urgent.setVibrationPattern(VIBRATION);
            urgent.setSound(
                sound,
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
            manager.createNotificationChannel(urgent);
        }
    }
}
