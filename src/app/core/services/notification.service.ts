import { Injectable, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/** Must match backend `fcm.py` urgent channel (immutable on Android — v2 resets sound). */
const URGENT_CHANNEL = 'lalganjeats_urgent_v2';
const TOKEN_CACHE_KEY = 'le_delivery_fcm_token';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private permissionsRequested = false;
  private pushInitialized = false;

  constructor() {
    this.initPermissions();
    this.initPushNotifications();

    effect(() => {
      if (this.auth.currentUser()) this.syncCachedTokenNow();
    });
  }

  async initPermissions() {
    if (Capacitor.isNativePlatform() && !this.permissionsRequested) {
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }

        try {
          await LocalNotifications.createChannel({
            id: URGENT_CHANNEL,
            name: 'Urgent Delivery Offers',
            description: 'Loud heads-up alerts for new delivery offers',
            importance: 5,
            visibility: 1,
            sound: 'order_alert',
            vibration: true,
            lights: true,
            lightColor: '#FF0000',
          });
          await LocalNotifications.createChannel({
            id: 'lalganjeats_urgent_orders',
            name: 'Urgent Delivery Offers (legacy)',
            description: 'Legacy channel — prefer Urgent Delivery Offers',
            importance: 5,
            visibility: 1,
            sound: 'order_alert',
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
    if (!Capacitor.isNativePlatform() || this.pushInitialized) return;
    this.pushInitialized = true;

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
        try { localStorage.setItem(TOKEN_CACHE_KEY, token.value); } catch (_) {}
        this.sendFcmTokenToBackend(token.value);
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Push notification registration error:', error);
      });

      PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          console.log('Delivery push received:', notification);
          try {
            LocalNotifications.schedule({
              notifications: [
                {
                  id: Math.floor(Math.random() * 100000),
                  title: notification.title || 'New order',
                  body: notification.body || 'Tap to view',
                  channelId: URGENT_CHANNEL,
                  sound: 'order_alert',
                  extra: notification.data ?? null,
                },
              ],
            });
          } catch (_) {}
          this.playChimeSound();
        }
      );

      PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (notification: ActionPerformed) => {
          console.log('Delivery push action performed:', notification);
        }
      );

      this.syncCachedTokenNow();
    } catch (e) {
      console.warn('PushNotifications initialization failed:', e);
    }
  }

  syncCachedTokenNow(): void {
    try {
      const cached = localStorage.getItem(TOKEN_CACHE_KEY);
      if (cached) this.sendFcmTokenToBackend(cached);
    } catch (_) {}
  }

  private sendFcmTokenToBackend(fcmToken: string) {
    if (!fcmToken?.trim()) return;
    if (!this.auth.currentUser()) return;
    const url = `${environment.apiBaseUrl}/delivery/fcm-token`;
    this.http.post(url, { fcm_token: fcmToken }).subscribe({
      next: () => console.log('Delivery FCM token synced with backend successfully'),
      error: (err) => console.warn('Could not sync Delivery FCM token with backend', err)
    });
  }

  async notifyNewOffer(orderNumber?: string) {
    const title = 'New Delivery Offer!';
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
              channelId: URGENT_CHANNEL,
              sound: 'order_alert',
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

  private activeAudio: HTMLAudioElement | null = null;
  private activeAudioCtx: any = null;
  private activeOscillators: any[] = [];

  stopSound() {
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch (_) {}
      this.activeAudio = null;
    }

    if (this.activeOscillators.length > 0) {
      for (const osc of this.activeOscillators) {
        try { osc.stop(); } catch (_) {}
      }
      this.activeOscillators = [];
    }
    if (this.activeAudioCtx) {
      try { this.activeAudioCtx.close(); } catch (_) {}
      this.activeAudioCtx = null;
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(0); } catch (_) {}
    }
  }

  private playChimeSound() {
    this.stopSound();

    try {
      const audio = new Audio('assets/sounds/order_alert.mp3');
      audio.volume = 1.0;
      this.activeAudio = audio;
      audio.onended = () => {
        if (this.activeAudio === audio) this.activeAudio = null;
      };
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (this.activeAudio === audio) this.activeAudio = null;
          this.playSynthChime();
        });
      }
    } catch (_) {
      this.playSynthChime();
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 200, 400, 200, 600]);
      } catch (_) {}
    }
  }

  private playSynthChime() {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      this.activeAudioCtx = audioCtx;
      this.activeOscillators = [];

      const playBeep = (freq1: number, freq2: number, startTime: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        this.activeOscillators.push(osc);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq1, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq2, startTime + duration * 0.8);

        gain.gain.setValueAtTime(0.85, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;
      playBeep(880, 1320, now, 0.18);
      playBeep(1320, 1760, now + 0.12, 0.22);
      playBeep(880, 1320, now + 0.40, 0.18);
      playBeep(1320, 1760, now + 0.52, 0.22);
      playBeep(988, 1480, now + 0.80, 0.18);
      playBeep(1480, 1976, now + 0.92, 0.35);

      setTimeout(() => {
        if (this.activeAudioCtx === audioCtx) {
          try { audioCtx.close(); } catch (_) {}
          this.activeAudioCtx = null;
          this.activeOscillators = [];
        }
      }, 1500);
    } catch (e) {
      console.warn('Audio chime note:', e);
    }
  }
}
