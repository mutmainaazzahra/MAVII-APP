import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  NavController,
  ToastController,
  AlertController,
} from '@ionic/angular';
import { Geolocation } from '@capacitor/geolocation';
import { TaskService } from '../../core/services/task.service';
import { AuthService } from '../../core/services/auth.service';
import { OfflineStorageService } from '../../core/services/offline-storage.service';
import { LocationService } from '../../core/services/location.service';
import { Task } from '../../core/models/task.model';
import { User } from '../../core/models/user.model';
import * as L from 'leaflet';

const iconRetinaUrl = 'assets/marker-icon-2x.png';
const iconUrl = 'assets/marker-icon.png';
const shadowUrl = 'assets/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

@Component({
  selector: 'app-task-detail',
  templateUrl: './task-detail.page.html',
  styleUrls: ['./task-detail.page.scss'],
  standalone: false,
})
export class TaskDetailPage implements OnInit, OnDestroy {
  task: Task | null = null;
  user: User | null = null;
  isLoading = true;
  taskId!: number;
  showInfoModal = false;
  showCatatanModal = false;
  showTindakanModal = false;
  showFullMap = false;
  catatan = '';
  tindakan = '';
  isSavingCatatan = false;
  isSavingTindakan = false;

  private map: any = null;
  private mapFullscreen: any = null;
  private techMarker: any = null;
  private taskMarkerFull: any = null;
  private routeLayer: any = null;
  private watchId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private taskService: TaskService,
    private authService: AuthService,
    private offlineStorage: OfflineStorageService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private locationService: LocationService,
  ) {}

  ngOnInit() {
    this.taskId = Number(this.route.snapshot.paramMap.get('id'));
  }

  async ionViewWillEnter() {
    this.user = await this.authService.getStoredUser();
    await this.loadTaskDetail();
  }

  async ionViewDidEnter() {
    setTimeout(() => {
      this.initMap();
      if (this.showFullMap) this.initFullMap();
    }, 500);
  }

  ionViewWillLeave() {
    this.destroyMap();
    this.showFullMap = false;
    this.closeAllModals();
    this.locationService.stopTracking();
  }

  ngOnDestroy() {
    this.destroyMap();
    this.locationService.stopTracking();
  }

  private destroyMap() {
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    if (this.mapFullscreen) {
      this.mapFullscreen.remove();
      this.mapFullscreen = null;
    }
    this.techMarker = null;
    this.routeLayer = null;
    this.taskMarkerFull = null;
  }

  async loadTaskDetail() {
    this.isLoading = true;
    const cached = await this.offlineStorage.getTaskDetail(this.taskId);
    if (cached) {
      this.task = cached;
      this.tindakan = (cached as any).actions || '';
      this.catatan = (cached as any).catatan || '';
      this.isLoading = false;
      this.locationService.startTracking(this.taskId);
      setTimeout(() => this.initMap(), 300);
    }
    this.taskService.getTaskDetail(this.taskId).subscribe({
      next: async (res) => {
        this.task = res.data;
        this.tindakan = (res.data as any)?.actions || '';
        this.catatan = (res.data as any)?.catatan || '';
        await this.offlineStorage.saveTaskDetail(this.taskId, this.task!);
        this.isLoading = false;
        this.locationService.startTracking(this.taskId);
        setTimeout(() => this.initMap(), 300);
      },
      error: () => {
        this.isLoading = false;
        if (!cached) this.showToast('Gagal memuat detail tugas', 'danger');
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
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
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
    mapInstance: any,
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    updatePopup = false,
  ) {
    if (!mapInstance) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        if (this.routeLayer && mapInstance)
          mapInstance.removeLayer(this.routeLayer);
        const coords = data.routes[0].geometry.coordinates.map(
          (c: number[]) => [c[1], c[0]],
        );
        this.routeLayer = L.polyline(coords, {
          color: '#131DAA',
          weight: 4,
          opacity: 0.8,
        }).addTo(mapInstance);
        if (updatePopup && this.taskMarkerFull && this.task) {
          const distanceKm = data.routes[0].distance / 1000;
          const durationSec = data.routes[0].duration;
          const distText = this.formatDistance(distanceKm);
          const durText = this.formatDuration(durationSec);
          const popupContent = `
            <div style="min-width:160px; padding:5px 0;">
              <div style="font-weight:700; font-size:14px; color:#000000;">${this.task.customer_name || this.task.title || 'Lokasi Tugas'}</div>
              <div style="font-size:12px; color:#444; margin-top:6px;">📍 Jarak: ${distText}</div>
              <div style="font-size:12px; color:#444;">⏱️ Estimasi: ${durText}</div>
              <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
            </div>
          `;
          this.taskMarkerFull.bindPopup(popupContent).openPopup();
        }
      } else if (updatePopup && this.taskMarkerFull && this.task) {
        const popupContent = `
          <div style="min-width:160px; padding:5px 0;">
            <div style="font-weight:700; font-size:14px; color:#000000;">${this.task.customer_name || this.task.title || 'Lokasi Tugas'}</div>
            <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
            <div style="font-size:11px; color:#d32f2f; margin-top:4px;">Tidak dapat menghitung rute</div>
          </div>
        `;
        this.taskMarkerFull.bindPopup(popupContent).openPopup();
      }
    } catch (error) {
      console.error('drawRoute error', error);
      if (updatePopup && this.taskMarkerFull && this.task) {
        const popupContent = `
          <div style="min-width:160px; padding:5px 0;">
            <div style="font-weight:700; font-size:14px; color:#000000;">${this.task.customer_name || this.task.title || 'Lokasi Tugas'}</div>
            <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
            <div style="font-size:11px; color:#d32f2f; margin-top:4px;">Gagal memuat rute</div>
          </div>
        `;
        this.taskMarkerFull.bindPopup(popupContent).openPopup();
      }
    }
  }

  async initMap() {
    if (!this.task?.latitude || !this.task?.longitude) return;
    const mapEl = document.getElementById('task-map');
    if (!mapEl) return;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    (mapEl as any)._leaflet_id = null;
    const taskLat = Number(this.task.latitude);
    const taskLng = Number(this.task.longitude);
    if (isNaN(taskLat) || isNaN(taskLng)) return;
    this.map = L.map('task-map', {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
    }).setView([taskLat, taskLng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
    const taskIcon = L.divIcon({
      html: `<div style="background:#EB445A;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
      className: '',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker([taskLat, taskLng], { icon: taskIcon }).addTo(this.map).bindPopup(`
        <div style="min-width:120px;padding:3px 0;">
          <div style="font-weight:700;font-size:14px;color:#000000;">${this.task.customer_name || this.task.title || 'Lokasi'}</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">Lokasi Tugas</div>
        </div>
      `);
    try {
      const perm = await Geolocation.requestPermissions();
      if (perm.location === 'granted') {
        const pos = await this.locationService.getCurrentPosition();
        const techLat = pos.latitude;
        const techLng = pos.longitude;
        const techIcon = L.divIcon({
          html: `<div style="background:#131DAA;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        this.techMarker = L.marker([techLat, techLng], {
          icon: techIcon,
        }).addTo(this.map).bindPopup(`
            <div style="min-width:120px;padding:3px 0;">
              <div style="font-weight:700;font-size:14px;color:#000000;">${this.user?.name || 'Teknisi'}</div>
              <div style="font-size:11px;color:#888;margin-top:2px;">Lokasi Anda</div>
            </div>
          `);
        this.map.fitBounds(
          L.latLngBounds([
            [techLat, techLng],
            [taskLat, taskLng],
          ]),
          { padding: [40, 40] },
        );
        setTimeout(() => {
          if (this.map) this.map.invalidateSize();
        }, 200);
        const distance = this.haversineDistance(
          techLat,
          techLng,
          taskLat,
          taskLng,
        );
        if (distance < 500) {
          await this.drawRoute(
            this.map,
            techLat,
            techLng,
            taskLat,
            taskLng,
            false,
          );
        }
      }
    } catch (error) {
      console.error('Geolocation error on mini map', error);
    }
  }

  openFullMap() {
    this.showFullMap = true;
    setTimeout(() => this.initFullMap(), 300);
  }

  private async initFullMap() {
    if (!this.task?.latitude || !this.task?.longitude) return;
    const mapEl = document.getElementById('task-map-full');
    if (!mapEl) return;
    if (this.mapFullscreen) {
      this.mapFullscreen.remove();
      this.mapFullscreen = null;
    }
    (mapEl as any)._leaflet_id = null;
    const taskLat = Number(this.task.latitude);
    const taskLng = Number(this.task.longitude);
    this.mapFullscreen = L.map('task-map-full', { zoomControl: true }).setView(
      [taskLat, taskLng],
      14,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.mapFullscreen);
    const taskIcon = L.divIcon({
      html: `<div style="background:#EB445A;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    this.taskMarkerFull = L.marker([taskLat, taskLng], { icon: taskIcon })
      .addTo(this.mapFullscreen)
      .bindPopup(
        `
        <div style="min-width:160px; padding:5px 0;">
          <div style="font-weight:700; font-size:14px; color:#000000;">${this.task.customer_name || this.task.title || 'Lokasi Tugas'}</div>
          <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
        </div>
      `,
      )
      .openPopup();
    try {
      const pos = await this.locationService.getCurrentPosition();
      const techLat = pos.latitude;
      const techLng = pos.longitude;
      const techIcon = L.divIcon({
        html: `<div style="background:#131DAA;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      this.techMarker = L.marker([techLat, techLng], { icon: techIcon }).addTo(
        this.mapFullscreen,
      ).bindPopup(`
          <div style="min-width:130px;padding:3px 0;">
            <div style="font-weight:700;font-size:14px;color:#000000;">${this.user?.name || 'Teknisi'}</div>
            <div style="font-size:11px;color:#888;margin-top:2px;">Lokasi Anda</div>
          </div>
        `);
      this.mapFullscreen.fitBounds(
        L.latLngBounds([
          [techLat, techLng],
          [taskLat, taskLng],
        ]),
        { padding: [50, 50] },
      );
      setTimeout(() => {
        if (this.mapFullscreen) this.mapFullscreen.invalidateSize();
      }, 200);
      const distance = this.haversineDistance(
        techLat,
        techLng,
        taskLat,
        taskLng,
      );
      if (distance < 500) {
        await this.drawRoute(
          this.mapFullscreen,
          techLat,
          techLng,
          taskLat,
          taskLng,
          true,
        );
      } else {
        const popupContent = `
          <div style="min-width:160px; padding:5px 0;">
            <div style="font-weight:700; font-size:14px; color:#000000;">${this.task.customer_name || this.task.title || 'Lokasi Tugas'}</div>
            <div style="font-size:12px; color:#d32f2f; margin-top:6px;">⚠️ Jarak terlalu jauh (${this.formatDistance(distance)})</div>
            <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
          </div>
        `;
        this.taskMarkerFull.bindPopup(popupContent).openPopup();
      }
      this.startLiveTracking();
    } catch (error) {
      console.error('Error init full map', error);
      const popupContent = `
        <div style="min-width:160px; padding:5px 0;">
          <div style="font-weight:700; font-size:14px; color:#000000;">${this.task.customer_name || this.task.title || 'Lokasi Tugas'}</div>
          <div style="font-size:11px; color:#d32f2f; margin-top:4px;">Gagal mendapatkan lokasi Anda</div>
          <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
        </div>
      `;
      this.taskMarkerFull.bindPopup(popupContent).openPopup();
    }
  }

  private async startLiveTracking() {
    try {
      const perm = await Geolocation.requestPermissions();
      if (perm.location !== 'granted') return;
      if (
        typeof (window as any).Capacitor !== 'undefined' &&
        (window as any).Capacitor.isNativePlatform()
      ) {
        this.watchId = (await Geolocation.watchPosition(
          { enableHighAccuracy: true },
          async (pos) => {
            if (!pos || !this.mapFullscreen || !this.task) return;
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (this.techMarker) {
              this.techMarker.setLatLng([lat, lng]);
            } else {
              const techIcon = L.divIcon({
                html: `<div style="background:#131DAA;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
                className: '',
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              });
              this.techMarker = L.marker([lat, lng], { icon: techIcon }).addTo(
                this.mapFullscreen,
              ).bindPopup(`
                <div style="min-width:130px;padding:3px 0;">
                  <div style="font-weight:700;font-size:14px;color:#000000;">${this.user?.name || 'Teknisi'}</div>
                  <div style="font-size:11px;color:#888;margin-top:2px;">Lokasi Anda</div>
                </div>
              `);
            }
            const taskLat = Number(this.task.latitude);
            const taskLng = Number(this.task.longitude);
            const dist = this.haversineDistance(lat, lng, taskLat, taskLng);
            if (dist < 500) {
              await this.drawRoute(
                this.mapFullscreen,
                lat,
                lng,
                taskLat,
                taskLng,
                true,
              );
            } else if (this.taskMarkerFull) {
              const popupContent = `
              <div style="min-width:160px; padding:5px 0;">
                <div style="font-weight:700; font-size:14px; color:#000000;">${this.task.customer_name || this.task.title || 'Lokasi Tugas'}</div>
                <div style="font-size:12px; color:#d32f2f; margin-top:6px;">⚠️ Jarak terlalu jauh (${this.formatDistance(dist)})</div>
                <div style="font-size:11px; color:#888; margin-top:4px;">Lokasi Tugas</div>
              </div>
            `;
              this.taskMarkerFull.bindPopup(popupContent).openPopup();
            }
          },
        )) as string;
      } else {
        console.warn('Live tracking only available on native device');
      }
    } catch (error) {
      console.error('Live tracking error', error);
    }
  }

  closeFullMap() {
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }
    this.showFullMap = false;
    if (this.mapFullscreen) {
      this.mapFullscreen.remove();
      this.mapFullscreen = null;
    }
    this.techMarker = null;
    this.routeLayer = null;
    this.taskMarkerFull = null;
  }

  openInfoModal() {
    this.showInfoModal = true;
  }
  closeInfoModal() {
    this.showInfoModal = false;
  }

  async openCatatanModal() {
    if (this.task?.status === 'assigned') {
      const alert = await this.alertCtrl.create({
        header: 'Belum Menerima Tugas',
        message:
          'Anda harus menerima (Accept) tugas terlebih dahulu sebelum dapat menambahkan catatan.',
        buttons: [{ text: 'OK', role: 'cancel' }],
      });
      await alert.present();
      return;
    }
    if (this.task?.status === 'accepted') {
      const alert = await this.alertCtrl.create({
        header: 'Pekerjaan Belum Dimulai',
        message:
          'Klik "Mulai Pekerjaan" terlebih dahulu sebelum menambahkan catatan.',
        buttons: [{ text: 'OK', role: 'cancel' }],
      });
      await alert.present();
      return;
    }
    this.catatan = this.task?.catatan || '';
    this.showCatatanModal = true;
  }

  closeCatatanModal() {
    this.showCatatanModal = false;
  }

  async openTindakanModal() {
    if (this.task?.status === 'assigned') {
      const alert = await this.alertCtrl.create({
        header: 'Belum Menerima Tugas',
        message:
          'Anda harus menerima (Accept) tugas terlebih dahulu sebelum dapat menambahkan tindakan.',
        buttons: [{ text: 'OK', role: 'cancel' }],
      });
      await alert.present();
      return;
    }
    if (this.task?.status === 'accepted') {
      const alert = await this.alertCtrl.create({
        header: 'Pekerjaan Belum Dimulai',
        message:
          'Klik "Mulai Pekerjaan" terlebih dahulu sebelum menambahkan tindakan.',
        buttons: [{ text: 'OK', role: 'cancel' }],
      });
      await alert.present();
      return;
    }
    this.tindakan = this.task?.actions || '';
    this.showTindakanModal = true;
  }

  closeTindakanModal() {
    this.showTindakanModal = false;
  }

  closeAllModals() {
    this.showInfoModal = false;
    this.showCatatanModal = false;
    this.showTindakanModal = false;
  }

  saveCatatan() {
    if (!this.catatan.trim()) {
      this.showToast('Catatan tidak boleh kosong', 'warning');
      return;
    }
    this.isSavingCatatan = true;
    this.taskService
      .updateNotes(this.taskId, 'catatan', this.catatan)
      .subscribe({
        next: () => {
          this.isSavingCatatan = false;
          if (this.task) this.task.catatan = this.catatan;
          this.showToast('Catatan tersimpan', 'success');
          this.closeCatatanModal();
        },
        error: () => {
          this.isSavingCatatan = false;
          this.showToast('Gagal menyimpan catatan', 'danger');
        },
      });
  }

  saveTindakan() {
    if (!this.tindakan.trim()) {
      this.showToast('Tindakan tidak boleh kosong', 'warning');
      return;
    }
    this.isSavingTindakan = true;
    this.taskService
      .updateNotes(this.taskId, 'tindakan', this.tindakan)
      .subscribe({
        next: () => {
          this.isSavingTindakan = false;
          if (this.task) this.task.actions = this.tindakan;
          this.showToast('Tindakan tersimpan', 'success');
          this.closeTindakanModal();
        },
        error: () => {
          this.isSavingTindakan = false;
          this.showToast('Gagal menyimpan tindakan', 'danger');
        },
      });
  }

  async startTask() {
    const alert = await this.alertCtrl.create({
      header: 'Mulai Pekerjaan',
      message: 'Apakah Anda yakin ingin memulai pengerjaan tugas ini?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: 'Mulai',
          handler: () => {
            this.taskService.startTask(this.taskId).subscribe({
              next: () => {
                this.showToast('Pekerjaan dimulai!', 'success');
                this.loadTaskDetail();
              },
              error: () => this.showToast('Gagal memulai pekerjaan', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  goToJobExecution() {
    this.navCtrl.navigateForward(['/technician/job-execution', this.taskId]);
  }

  goBack() {
    this.navCtrl.back();
  }

  formatDate(d?: string): string {
    return d
      ? new Date(d.replace(' ', 'T')).toLocaleDateString('id-ID')
      : 'Tidak ada jadwal';
  }

  private async showToast(m: string, c: string) {
    const t = await this.toastCtrl.create({
      message: m,
      duration: 3000,
      position: 'top',
      color: c,
    });
    await t.present();
  }
}
