import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private permissionsRequested = false;

  constructor() {
    this.initPermissions();
    this.initPushNotifications();
  }

  async initPermissions() {
    if (Capacitor.isNativePlatform() && !this.permissionsRequested) {
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }

        // Create high-importance notification channels with loud sound & vibration for killed/background app wake-up
        try {
          await LocalNotifications.createChannel({
            id: 'lalganjeats_orders',
            name: 'LalganjEats Orders',
            description: 'Instant notifications for incoming orders and deliveries',
            importance: 5,
            visibility: 1,
            sound: 'notification_sound.wav',
            vibration: true,
            lights: true,
            lightColor: '#FF0000',
          });
          await LocalNotifications.createChannel({
            id: 'lalganjeats_urgent_orders',
            name: 'Urgent Delivery Offers',
            description: 'Loud notifications for incoming delivery offers',
            importance: 5,
            visibility: 1,
            sound: 'notification_sound.wav',
            vibration: true,
            lights: true,
            lightColor: '#FF0000',
          });
        } catch (_) {}

        this.permissionsRequested = true;
      } catch (e) {
        console.warn('Could not request local notification permissions', e);
      }
    }
  }

  async initPushNotifications() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== 'granted') {
        console.warn('Push notification permission not granted');
        return;
      }

      await PushNotifications.register();

      PushNotifications.addListener('registration', (token: Token) => {
        console.log('Delivery FCM Token registered:', token.value);
        this.sendFcmTokenToBackend(token.value);
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Push notification registration error:', error);
      });

      PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          console.log('Delivery push received:', notification);
          this.playChimeSound();
        }
      );

      PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (notification: ActionPerformed) => {
          console.log('Delivery push action performed:', notification);
        }
      );
    } catch (e) {
      console.warn('PushNotifications initialization failed:', e);
    }
  }

  private sendFcmTokenToBackend(fcmToken: string) {
    const url = `${environment.apiBaseUrl}/delivery/fcm-token`;
    this.http.post(url, { fcm_token: fcmToken }).subscribe({
      next: () => console.log('Delivery FCM token synced with backend successfully'),
      error: (err) => console.warn('Could not sync Delivery FCM token with backend', err)
    });
  }

  async notifyNewOffer(orderNumber?: string) {
    const title = '🛵 New Delivery Offer!';
    const body = orderNumber
      ? `Order #${orderNumber}: New delivery offer available. Accept now!`
      : 'New delivery offer available. Tap to accept now!';

    if (Capacitor.isNativePlatform()) {
      try {
        await this.initPermissions();
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 100000),
              title,
              body,
              channelId: 'lalganjeats_urgent_orders',
              sound: 'res://raw/notification_sound',
              actionTypeId: '',
              extra: null
            }
          ]
        });
      } catch (e) {
        console.error('LocalNotification error', e);
      }
    }

    this.playChimeSound();
  }

  private playChimeSound() {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();

      // Play 3 loud, rapid, attention-grabbing chime burst pairs (like order alert sound)
      const playBeep = (freq1: number, freq2: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq1, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq2, startTime + duration * 0.8);

        gain.gain.setValueAtTime(0.75, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;
      // Burst 1
      playBeep(880, 1320, now, 0.18);
      playBeep(1320, 1760, now + 0.12, 0.22);

      // Burst 2
      playBeep(880, 1320, now + 0.40, 0.18);
      playBeep(1320, 1760, now + 0.52, 0.22);

      // Burst 3
      playBeep(988, 1480, now + 0.80, 0.18);
      playBeep(1480, 1976, now + 0.92, 0.35);
    } catch (e) {
      console.warn('Audio chime note:', e);
    }
  }
}
