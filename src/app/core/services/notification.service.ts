import { Injectable, NgZone, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { AlertController, NavController } from '@ionic/angular';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notifications: AppNotification[] = [];
  private readonly STORAGE_KEY = 'app_notifications';
  private _authService: AuthService | null = null;
  private channelCreated = false;
  private displayedNotifIds: Set<number> = new Set();

  constructor(
    private http: HttpClient,
    private alertCtrl: AlertController,
    private navCtrl: NavController,
    private ngZone: NgZone,
    private injector: Injector,
  ) {}

  private get authService(): AuthService {
    if (!this._authService) {
      this._authService = this.injector.get(AuthService);
    }
    return this._authService;
  }

  async initialize(): Promise<void> {
    await this.loadFromStorage();
    await this.loadDisplayedIds();
    await this.requestPermissionsOnce();
    await this.setupPushNotifications();
    await this.ensureNotificationChannel();
    await this.syncFromServer();
    if (!Capacitor.isNativePlatform()) {
      if ('Notification' in window && Notification.permission !== 'granted') {
        await Notification.requestPermission();
      }
    }
  }

  private async loadDisplayedIds(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: 'displayed_notif_ids' });
      if (value) {
        const ids: number[] = JSON.parse(value);
        this.displayedNotifIds = new Set(ids);
      }
    } catch {}
  }

  private async saveDisplayedIds(): Promise<void> {
    const ids = Array.from(this.displayedNotifIds);
    await Preferences.set({
      key: 'displayed_notif_ids',
      value: JSON.stringify(ids),
    });
  }

  async syncFromServer(): Promise<void> {
    if (!this.authService.isLoggedIn()) return;
    try {
      const res = await this.http
        .get<any>(`${environment.apiUrl}/api/notifications`)
        .toPromise();
      if (res && res.notifications) {
        const serverNotifs: AppNotification[] = res.notifications.map(
          (n: any) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            time: new Date(n.created_at).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            read: n.is_read == 1 || n.is_read === true || n.is_read === 'true',
          }),
        );
        const oldIds = new Set(this.notifications.map((n) => n.id));
        this.notifications = serverNotifs;
        await this.saveToStorage();

        for (const notif of this.notifications) {
          if (
            !notif.read &&
            !this.displayedNotifIds.has(notif.id) &&
            !oldIds.has(notif.id)
          ) {
            this.displayedNotifIds.add(notif.id);
            await this.saveDisplayedIds();
            this.ngZone.run(async () => {
              const alert = await this.alertCtrl.create({
                header: notif.title,
                message: notif.message,
                buttons: [
                  {
                    text: 'Lihat Detail',
                    handler: () => {
                      let taskId = null;
                      try {
                        if (notif.message.includes('Lokasi:')) {
                          taskId = notif.message.match(/task_id=(\d+)/)?.[1];
                        }
                      } catch {}
                      if (taskId) {
                        this.navCtrl.navigateRoot([
                          '/technician/task-detail',
                          taskId,
                        ]);
                      } else {
                        this.navCtrl.navigateRoot(['/technician/tabs/tasks']);
                      }
                    },
                  },
                  { text: 'Nanti', role: 'cancel' },
                ],
                backdropDismiss: false,
              });
              await alert.present();
            });
          }
        }
      }
    } catch (err) {
      console.error('Gagal sinkronisasi notifikasi dari server', err);
    }
  }

  private async ensureNotificationChannel(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.channelCreated) return;
    try {
      await LocalNotifications.createChannel({
        id: 'mavii_tasks',
        name: 'Notifikasi Tugas',
        description: 'Notifikasi untuk tugas baru dan update pekerjaan',
        sound: 'default',
        importance: 4,
        visibility: 1,
        vibration: true,
      });
      this.channelCreated = true;
    } catch (err) {
      console.error('Channel creation error:', err);
    }
  }

  private async requestPermissionsOnce(): Promise<void> {
    try {
      const { value: granted } = await Preferences.get({
        key: 'app_permissions_granted',
      });
      if (granted === 'true') return;
      if (Capacitor.isNativePlatform()) {
        const notifPerm = await LocalNotifications.requestPermissions();
        console.log('Izin notifikasi:', notifPerm.display);
      }
      try {
        await Geolocation.requestPermissions();
      } catch {}
      await Preferences.set({ key: 'app_permissions_granted', value: 'true' });
    } catch (err) {
      console.error('Permission error:', err);
    }
  }

  private async setupPushNotifications(): Promise<void> {
    try {
      if (!Capacitor.isNativePlatform()) return;
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== 'granted') return;
      await PushNotifications.register();
      await PushNotifications.addListener('registration', async (token) => {
        console.log('FCM TOKEN:', token.value);
        await Preferences.set({ key: 'fcm_token', value: token.value });
        this.sendTokenToLaravel(token.value);
      });
      await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification) => {
          this.addInAppNotification(
            notification.title ?? '',
            notification.body ?? '',
          );
          this.sendLocalNotification(
            notification.title ?? '',
            notification.body ?? '',
          );
          this.syncFromServer();
          this.ngZone.run(async () => {
            const alert = await this.alertCtrl.create({
              header: notification.title ?? 'Tugas Baru',
              message: notification.body ?? 'Ada tugas baru untuk Anda',
              buttons: [
                {
                  text: 'Lihat Detail',
                  handler: () =>
                    this.navCtrl.navigateRoot(['/technician/tabs/tasks']),
                },
                { text: 'Nanti', role: 'cancel' },
              ],
              backdropDismiss: false,
            });
            await alert.present();
          });
        },
      );
    } catch (err) {
      console.error('Push setup error:', err);
    }
  }

  sendTokenToLaravel(token: string): void {
    this.http
      .post(`${environment.apiUrl}/api/save-fcm-token`, { fcm_token: token })
      .subscribe({
        next: (res) => console.log('FCM token terkirim', res),
        error: (err) => console.error('Gagal kirim FCM token', err),
      });
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: this.STORAGE_KEY });
      if (value) {
        this.notifications = JSON.parse(value);
      }
    } catch {}
  }

  private async saveToStorage(): Promise<void> {
    await Preferences.set({
      key: this.STORAGE_KEY,
      value: JSON.stringify(this.notifications),
    });
  }

  async sendLocalNotification(title: string, body: string): Promise<void> {
    try {
      if (!Capacitor.isNativePlatform()) return;
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') return;
      await this.ensureNotificationChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title,
            body,
            schedule: { at: new Date(Date.now() + 100) },
            sound: 'default',
            channelId: 'mavii_tasks',
          },
        ],
      });
    } catch (err) {
      console.error('Gagal kirim notifikasi lokal', err);
    }
  }

  addInAppNotification(title: string, message: string): AppNotification {
    const notif: AppNotification = {
      id: Date.now(),
      title,
      message,
      time: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      read: false,
    };
    this.notifications.unshift(notif);
    this.saveToStorage();
    return notif;
  }

  async markOneRead(id: number): Promise<void> {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif && !notif.read) {
      notif.read = true;
      await this.saveToStorage();
      this.http
        .post(`${environment.apiUrl}/api/notifications/${id}/read`, {})
        .subscribe();
    }
  }

  async markAllAsRead(): Promise<void> {
    this.notifications.forEach((n) => (n.read = true));
    await this.saveToStorage();
    this.http
      .post(`${environment.apiUrl}/api/notifications/read-all`, {})
      .subscribe();
  }

  async clearAll(): Promise<void> {
    this.notifications = [];
    await this.saveToStorage();
    this.http.delete(`${environment.apiUrl}/api/notifications`).subscribe();
  }

  async clearLocal(): Promise<void> {
    this.notifications = [];
    await this.saveToStorage();
    this.displayedNotifIds.clear();
    await Preferences.remove({ key: 'displayed_notif_ids' });
  }

  getNotifications(): AppNotification[] {
    return this.notifications;
  }

  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  startPolling() {}
  stopPolling() {}
}
