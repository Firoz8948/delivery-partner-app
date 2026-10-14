package com.lalganjeats.deliverypartner;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        OfferAlertChannels.ensure(this);
        super.onCreate(savedInstanceState);
    }
}
