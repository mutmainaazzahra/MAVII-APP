import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import {
  NavController,
  ToastController,
  AlertController,
} from '@ionic/angular';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { Subscription } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../../environments/environment';

import { TaskService } from '../../core/services/task.service';
import { OfflineStorageService } from '../../core/services/offline-storage.service';
import { NetworkService } from '../../core/services/network.service';
import { AuthService } from '../../core/services/auth.service';
import { LocationService } from '../../core/services/location.service';
import {
  NotificationService,
  AppNotification,
} from '../../core/services/notification.service';
import { TaskList } from '../../core/models/task.model';
import { User } from '../../core/models/user.model';

declare const L: any;

@Component({
  selector: 'app-task-list',
  templateUrl: './task-list.page.html',
  styleUrls: ['./task-list.page.scss'],
  standalone: false,
})
export class TaskListPage implements OnInit, OnDestroy {
  tasks: TaskList[] = [];
  isLoading = true;
  isOnline = true;
  showLocationMap = false;
  selectedTask: TaskList | null = null;

  user: User | null = null;
  profilePhoto: string | null = null;
  isWorkerOnline = false;
  showNotifPanel = false;

  private networkSub!: Subscription;
  private locationMap: any = null;
  private techMarker: any = null;
  private taskMarkerFull: any = null;
  private routeLayer: any = null;
  private watchId: any = null;

  constructor(
    private router: Router,
    private navCtrl: NavController,
    private taskService: TaskService,
    private offlineStorage: OfflineStorageService,
    private networkService: NetworkService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private authService: AuthService,
    private locationService: LocationService,
    private notificationService: NotificationService,
    private ngZone: NgZone,
  ) {}

  ngOnInit() {
    this.networkSub = this.networkService
      .getNetworkStatus()
      .subscribe((online) => (this.isOnline = online));
  }

  async ionViewWillEnter() {
    await this.loadUser();
    await this.loadTasks();
    await this.restoreWorkerStatus();
  }

  ionViewWillLeave() {
    this.closeLocationMap();
  }

  ngOnDestroy() {
    if (this.networkSub) this.networkSub.unsubscribe();
    this.closeLocationMap();
  }

  private async loadUser() {
    this.user = await this.authService.getStoredUser();
    await this.loadProfilePhoto();
  }

  private isValidPhotoUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    return (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:')
    );
  }

  private normalizeAvatar(avatar: string | undefined): string | null {
    if (!avatar) return null;
    if (avatar.startsWith('http') || avatar.startsWith('https') || avatar.startsWith('data:')) return avatar;

    let base = environment.apiUrl;
    if (base.endsWith('/')) base = base.slice(0, -1);

    const parts = avatar.split('/');
    const filename = parts[parts.length - 1];

    return `${base}/storage/avatars/${filename}?t=${new Date().getTime()}`;
  }

  private async fetchAvatarAsDataUrl(url: string): Promise<string | null> {
    if (!url) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  private async loadProfilePhoto() {
    const avatarUrl = this.normalizeAvatar(this.user?.avatar);
    if (avatarUrl) {
      this.profilePhoto = avatarUrl;
    } else {
      this.profilePhoto = null;
    }
  }

  onAvatarError() {
    this.profilePhoto = null;
  }

  getUserInitial(): string {
    return this.user?.name?.charAt(0).toUpperCase() || 'T';
  }

  get notifications(): AppNotification[] {
    return this.notificationService.getNotifications();
  }
  get unreadCount(): number {
    return this.notificationService.getUnreadCount();
  }
  toggleNotifPanel() {
    this.showNotifPanel = !this.showNotifPanel;
  }
  onNotifItemClick(notif: AppNotification) {
    this.notificationService.markOneRead(notif.id);
    this.toggleNotifPanel();
  }
  clearNotifications() {
    this.notificationService.clearAll();
    this.showNotifPanel = false;
  }
  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  async restoreWorkerStatus() {
    const { value } = await Preferences.get({ key: 'worker_online_status' });
    this.isWorkerOnline = value === 'true';
  }

  async toggleWorkerStatus() {
    if (this.isWorkerOnline) {
      const hasActiveTask = this.tasks.some((t) => t.status === 'accepted' || t.status === 'on-going');
      if (hasActiveTask) {
        const alert = await this.alertCtrl.create({
          header: 'Tidak Bisa Offline',
          message:
            'Anda memiliki tugas yang belum selesai. Selesaikan tugas tersebut terlebih dahulu sebelum mengubah status menjadi offline.',
          buttons: [{ text: 'OK', role: 'cancel' }],
        });
        await alert.present();
        return;
      }
      await this.goOffline();
    } else {
      await this.goOnline();
    }
  }

  private async goOnline() {
    this.locationService.setOnline().subscribe({
      next: async () => {
        this.isWorkerOnline = true;
        await Preferences.set({ key: 'worker_online_status', value: 'true' });
        try {
          const position = await this.locationService.getCurrentPosition();
          const activeTask = this.getActiveTasks()[0];
          this.locationService
            .updateLocation(
              position.latitude,
              position.longitude,
              position.accuracy,
              activeTask?.id || 0,
            )
            .subscribe({
              next: () => {
                if (activeTask)
                  this.locationService.startTracking(activeTask.id);
                this.showToast('Status online, lokasi terdeteksi!', 'success');
              },
              error: () => {
                this.showToast('Online (gagal sinkronisasi lokasi)', 'warning');
              },
            });
        } catch {
          this.showToast('Status online (GPS tidak tersedia)', 'warning');
        }
      },
      error: (err) => {
        console.error('Gagal set online:', err);
        this.showToast('Gagal mengubah status online', 'danger');
      },
    });
  }

  private async goOffline() {
    this.locationService.setOffline().subscribe({
      next: () => {
        this.locationService.stopTracking();
        this.isWorkerOnline = false;
        Preferences.set({ key: 'worker_online_status', value: 'false' });
        this.showToast('Status offline', 'medium');
      },
      error: (err) => {
        console.error('Gagal set offline:', err);
        this.showToast('Gagal mengubah status offline', 'danger');
      },
    });
  }

  goToProfile() {
    this.navCtrl.navigateForward(['/technician/tabs/profile']);
  }

  async loadTasks(event?: any) {
    this.isLoading = true;
    if (!this.isOnline) {
      this.tasks = await this.offlineStorage.getTasksCache();
      this.isLoading = false;
      if (event) event.target.complete();
      return;
    }
    this.taskService.getMyTasks().subscribe({
      next: async (res) => {
        this.tasks = res.data || [];
        await this.offlineStorage.saveTasksCache(this.tasks);
        this.isLoading = false;
        if (event) event.target.complete();
      },
      error: async () => {
        this.tasks = await this.offlineStorage.getTasksCache();
        this.isLoading = false;
        if (event) event.target.complete();
      },
    });
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private formatDistance(km: number): string {
    if (km < 1) return `${(km * 1000).toFixed(0)} m`;
    if (km < 100) return `${km.toFixed(1)} km`;
    return `${km.toFixed(0)} km`;
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)} detik`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours} jam ${minutes} menit`;
    return `${minutes} menit`;
  }

  private async drawRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    updatePopup = false,
  ) {
    if (!this.locationMap) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes?.length > 0) {
        if (this.routeLayer) this.locationMap.removeLayer(this.routeLayer);
        const coords = data.routes[0].geometry.coordinates.map(
          (c: number[]) => [c[1], c[0]],
        );
        this.routeLayer = L.polyline(coords, {
          color: '#131DAA',
          weight: 4,
          opacity: 0.8,
        }).addTo(this.locationMap);

        if (updatePopup && this.taskMarkerFull && this.selectedTask) {
          const distanceKm = data.routes[0].distance / 1000;
          const durationSec = data.routes[0].duration;
          const distText = this.formatDistance(distanceKm);
          const durText = this.formatDuration(durationSec);
          const popupContent = `
            <div style="min-width:160px; padding:5px 0;">
              <div style="font-weight:700; font-size:14px; color:#000000;">${this.selectedTask.customer_name || this.selectedTask.title || 'Lokasi Tugas'}</div>
              <div style="font-size:12px; color:#444; margin-top:6px;">📍 Jarak: ${distText}</div>
              <div style="font-size:12px; color:#444;">⏱️ Estimasi: ${durText}</div>
              <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
            </div>
          `;
          this.taskMarkerFull.bindPopup(popupContent).openPopup();
        }
      } else if (updatePopup && this.taskMarkerFull && this.selectedTask) {
        const popupContent = `
          <div style="min-width:160px; padding:5px 0;">
            <div style="font-weight:700; font-size:14px; color:#000000;">${this.selectedTask.customer_name || this.selectedTask.title || 'Lokasi Tugas'}</div>
            <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
            <div style="font-size:11px; color:#d32f2f; margin-top:4px;">Tidak dapat menghitung rute</div>
          </div>
        `;
        this.taskMarkerFull.bindPopup(popupContent).openPopup();
      }
    } catch {}
  }

  private isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  async openLocationMap(task: TaskList, event: Event) {
    event.stopPropagation();
    if (!task.latitude || !task.longitude) {
      this.showToast('Koordinat lokasi tidak tersedia', 'warning');
      return;
    }
    this.selectedTask = task;
    this.showLocationMap = true;
    document.body.classList.add('hide-tabs');
    setTimeout(() => this.initLocationMap(), 300);
  }

  private async initLocationMap() {
    if (!this.selectedTask?.latitude || !this.selectedTask?.longitude) return;
    const mapEl = document.getElementById('location-map');
    if (!mapEl) return;
    if (this.locationMap) {
      this.locationMap.remove();
      this.locationMap = null;
    }
    (mapEl as any)._leaflet_id = null;
    const taskLat = this.selectedTask.latitude;
    const taskLng = this.selectedTask.longitude;

    this.locationMap = L.map('location-map', { zoomControl: false }).setView(
      [taskLat, taskLng],
      14,
    );
    L.control.zoom({ position: 'topleft' }).addTo(this.locationMap);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(
      this.locationMap,
    );

    const taskIcon = L.divIcon({
      html: `<div style="background:#EB445A;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    this.taskMarkerFull = L.marker([taskLat, taskLng], { icon: taskIcon })
      .addTo(this.locationMap)
      .bindPopup(
        `
        <div style="min-width:160px; padding:5px 0;">
          <div style="font-weight:700; font-size:14px; color:#000000;">${this.selectedTask.customer_name || this.selectedTask.title || 'Lokasi Tugas'}</div>
          <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
        </div>
      `,
      )
      .openPopup();

    const getPosition = (): Promise<{
      latitude: number;
      longitude: number;
      accuracy: number;
    }> => {
      return new Promise(async (resolve, reject) => {
        if (this.isNative()) {
          try {
            const pos = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 10000,
            });
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
          } catch (err) {
            reject(err);
          }
        } else {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                resolve({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                });
              },
              (err) => reject(err),
              { enableHighAccuracy: true, timeout: 10000 },
            );
          } else {
            reject(new Error('Geolocation not supported'));
          }
        }
      });
    };

    try {
      let pos;
      if (this.isNative()) {
        const permResult = await Geolocation.requestPermissions();
        if (permResult.location !== 'granted') {
          this.showToast(
            'Izin lokasi diperlukan untuk melihat peta',
            'warning',
          );
          return;
        }
        pos = await getPosition();
      } else {
        pos = await getPosition();
      }

      const techLat = pos.latitude;
      const techLng = pos.longitude;

      const techIcon = L.divIcon({
        html: `<div style="background:#131DAA;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      this.techMarker = L.marker([techLat, techLng], { icon: techIcon }).addTo(
        this.locationMap,
      ).bindPopup(`
          <div style="min-width:130px;padding:3px 0;">
            <div style="font-weight:700;font-size:14px;color:#000000;">Teknisi</div>
            <div style="font-size:11px;color:#888;margin-top:2px;">Lokasi Anda</div>
          </div>
        `);

      this.locationMap.fitBounds(
        L.latLngBounds([
          [techLat, techLng],
          [taskLat, taskLng],
        ]),
        { padding: [40, 40] },
      );

      const distance = this.haversineDistance(
        techLat,
        techLng,
        taskLat,
        taskLng,
      );
      if (distance < 500) {
        await this.drawRoute(techLat, techLng, taskLat, taskLng, true);
      } else {
        const popupContent = `
          <div style="min-width:160px; padding:5px 0;">
            <div style="font-weight:700; font-size:14px; color:#000000;">${this.selectedTask.customer_name || this.selectedTask.title || 'Lokasi Tugas'}</div>
            <div style="font-size:12px; color:#d32f2f; margin-top:6px;">⚠️ Jarak terlalu jauh (${this.formatDistance(distance)})</div>
            <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
          </div>
        `;
        this.taskMarkerFull.bindPopup(popupContent).openPopup();
      }

      if (this.isNative()) {
        this.watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true },
          async (p) => {
            if (!p || !this.locationMap) return;
            if (this.techMarker) {
              this.techMarker.setLatLng([
                p.coords.latitude,
                p.coords.longitude,
              ]);
            }
            const newDist = this.haversineDistance(
              p.coords.latitude,
              p.coords.longitude,
              taskLat,
              taskLng,
            );
            if (newDist < 500) {
              await this.drawRoute(
                p.coords.latitude,
                p.coords.longitude,
                taskLat,
                taskLng,
                true,
              );
            } else {
              const popupContent = `
                <div style="min-width:160px; padding:5px 0;">
                  <div style="font-weight:700; font-size:14px; color:#000000;">${this.selectedTask?.customer_name || this.selectedTask?.title || 'Lokasi Tugas'}</div>
                  <div style="font-size:12px; color:#d32f2f; margin-top:6px;">⚠️ Jarak terlalu jauh (${this.formatDistance(newDist)})</div>
                  <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
                </div>
              `;
              if (this.taskMarkerFull)
                this.taskMarkerFull.bindPopup(popupContent).openPopup();
            }
          },
        );
      } else {
        this.watchId = navigator.geolocation.watchPosition(
          async (p) => {
            if (!this.locationMap) return;
            if (this.techMarker) {
              this.techMarker.setLatLng([
                p.coords.latitude,
                p.coords.longitude,
              ]);
            }
            const newDist = this.haversineDistance(
              p.coords.latitude,
              p.coords.longitude,
              taskLat,
              taskLng,
            );
            if (newDist < 500) {
              await this.drawRoute(
                p.coords.latitude,
                p.coords.longitude,
                taskLat,
                taskLng,
                true,
              );
            } else {
              const popupContent = `
                <div style="min-width:160px; padding:5px 0;">
                  <div style="font-weight:700; font-size:14px; color:#000000;">${this.selectedTask?.customer_name || this.selectedTask?.title || 'Lokasi Tugas'}</div>
                  <div style="font-size:12px; color:#d32f2f; margin-top:6px;">⚠️ Jarak terlalu jauh (${this.formatDistance(newDist)})</div>
                  <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
                </div>
              `;
              if (this.taskMarkerFull)
                this.taskMarkerFull.bindPopup(popupContent).openPopup();
            }
          },
          (err) => console.error('Watch error:', err),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
      this.showToast(
        'Gagal mengakses lokasi. Pastikan izin lokasi diberikan.',
        'warning',
      );
    }
  }

  closeLocationMap() {
    if (this.watchId) {
      if (this.isNative()) {
        Geolocation.clearWatch({ id: this.watchId });
      } else {
        navigator.geolocation.clearWatch(this.watchId);
      }
      this.watchId = null;
    }
    this.showLocationMap = false;
    this.selectedTask = null;
    this.techMarker = null;
    this.taskMarkerFull = null;
    this.routeLayer = null;
    document.body.classList.remove('hide-tabs');
    if (this.locationMap) {
      this.locationMap.remove();
      this.locationMap = null;
    }
  }

  getAssignedTasks(): TaskList[] {
    return this.tasks.filter((t) => t.status === 'assigned');
  }

  getActiveTasks(): TaskList[] {
    return this.tasks.filter(
      (t) => t.status === 'accepted' || t.status === 'on-going',
    );
  }

  private hasActiveTask(): boolean {
    return this.tasks.some(
      (t) => t.status === 'accepted' || t.status === 'on-going',
    );
  }

  goToDetail(id: number) {
    this.navCtrl.navigateForward(['/technician/task-detail', id]);
  }

  async confirmAction(task: TaskList, action: 'accept' | 'reject') {
    if (!this.isWorkerOnline) {
      const alert = await this.alertCtrl.create({
        header: 'Status Offline',
        message: 'Anda harus mengubah status menjadi Online terlebih dahulu sebelum dapat memproses tugas.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    if (action === 'accept') {
      if (this.hasActiveTask()) {
        const alert = await this.alertCtrl.create({
          header: 'Tidak Dapat Menerima Tugas',
          message:
            'Anda sedang memiliki tugas yang sedang berjalan. Selesaikan tugas tersebut terlebih dahulu sebelum menerima tugas baru.',
          buttons: ['OK'],
        });
        await alert.present();
        return;
      }
    }
    const alert = await this.alertCtrl.create({
      header: action === 'accept' ? 'Terima Tugas' : 'Tolak Tugas',
      message:
        action === 'accept'
          ? `Terima tugas "${task.customer_name || task.title}"?`
          : `Tolak tugas "${task.customer_name || task.title}"?`,
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: action === 'accept' ? 'Terima' : 'Tolak',
          handler: () => {
            if (action === 'accept') this.acceptTask(task.id);
            else this.rejectTask(task.id);
          },
        },
      ],
    });
    await alert.present();
  }

  private acceptTask(id: number) {
    this.taskService.acceptTask(id).subscribe({
      next: () => {
        this.showToast('Tugas berhasil diterima!', 'success');
        this.loadTasks();
      },
      error: () => {
        this.loadTasks();
      },
    });
  }

  private rejectTask(id: number) {
    this.taskService.rejectTask(id).subscribe({
      next: () => {
        this.showToast('Tugas berhasil ditolak', 'warning');
        this.loadTasks();
      },
      error: () => {
        this.loadTasks();
      },
    });
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
      color,
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await toast.present();
  }
}
