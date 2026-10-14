package com.lalganjeats.deliverypartner;

import com.capacitorjs.plugins.pushnotifications.MessagingService;

/**
 * Replaces the Capacitor push service so the offer channels exist before
 * Firebase displays a push, even if the app was killed and never reopened.
 */
public class AlertMessagingService extends MessagingService {

    @Override
    public void onCreate() {
        super.onCreate();
        OfferAlertChannels.ensure(this);
    }
}
