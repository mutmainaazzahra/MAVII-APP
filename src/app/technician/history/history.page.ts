import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
  ToastController,
  ActionSheetController,
  AlertController,
} from '@ionic/angular';
import { Subscription } from 'rxjs';
import { NavController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

import { HistoryService } from '../../core/services/history.service';
import { OfflineStorageService } from '../../core/services/offline-storage.service';
import { NetworkService } from '../../core/services/network.service';
import { AuthService } from '../../core/services/auth.service';
import { HistoryItem } from '../../core/models/history.model';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
  standalone: false,
})
export class HistoryPage implements OnInit, OnDestroy {
  user: User | null = null;
  allHistory: HistoryItem[] = [];
  filteredHistory: HistoryItem[] = [];
  searchQuery = '';
  activeFilter = 'all';
  isLoading = true;
  isOnline = true;
  showDateModal = false;
  selectedStartDate = '';
  selectedEndDate = '';
  datePickerMode: 'start' | 'end' = 'start';

  private networkSub!: Subscription;

  constructor(
    private navCtrl: NavController,
    private router: Router,
    private historyService: HistoryService,
    private authService: AuthService,
    private offlineStorage: OfflineStorageService,
    private networkService: NetworkService,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit() {
    this.networkSub = this.networkService
      .getNetworkStatus()
      .subscribe((online) => (this.isOnline = online));
  }

  async ionViewWillEnter() {
    this.user = await this.authService.getStoredUser();
    await this.loadHistory();
  }

  ngOnDestroy() {
    if (this.networkSub) this.networkSub.unsubscribe();
  }

  async loadHistory(event?: any) {
    this.isLoading = true;
    if (!this.isOnline) {
      this.allHistory = await this.offlineStorage.getHistoryCache();
      this.applyFilter();
      this.isLoading = false;
      if (event) event.target.complete();
      return;
    }
    this.historyService.getMyHistory().subscribe({
      next: async (res) => {
        this.allHistory = res.data || [];
        await this.offlineStorage.saveHistoryCache(this.allHistory);
        this.applyFilter();
        this.isLoading = false;
        if (event) event.target.complete();
      },
      error: async () => {
        this.allHistory = await this.offlineStorage.getHistoryCache();
        this.applyFilter();
        this.isLoading = false;
        if (event) event.target.complete();
      },
    });
  }

  setFilter(filter: string) {
    this.activeFilter = filter;
    this.applyFilter();
  }

  applyFilter() {
    let result = [...this.allHistory];
    if (this.activeFilter === 'finished')
      result = result.filter((h) => h.status === 'completed');
    else if (this.activeFilter === 'canceled')
      result = result.filter((h) => h.status === 'rejected');
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(
        (h) =>
          (h.title || '').toLowerCase().includes(q) ||
          (h.customer_name || '').toLowerCase().includes(q) ||
          (h.location_name || '').toLowerCase().includes(q),
      );
    }
    this.filteredHistory = result;
  }

  onSearch(event: any) {
    this.searchQuery = event.target.value || '';
    this.applyFilter();
  }

  goToDetail(id: number) {
    this.navCtrl.navigateForward(['/technician/history-detail', id]);
  }

  getInitial(item: HistoryItem): string {
    return (item.customer_name || item.title || 'T').charAt(0).toUpperCase();
  }

  getStatusLabel(status: string): string {
    return status === 'completed' ? 'Finished' : 'Canceled';
  }

  private getBestDateStr(item: HistoryItem): string {
    const candidates = [item.completed_at, item.updated_at, item.created_at];
    for (const c of candidates) {
      if (c) return c;
    }
    return '';
  }

  getGroupedHistory(): { date: string; items: HistoryItem[] }[] {
    const sorted = [...this.filteredHistory].sort((a, b) => {
      const da = this.getBestDate(a)?.getTime() || 0;
      const db = this.getBestDate(b)?.getTime() || 0;
      return db - da;
    });

    const groups: { [key: string]: HistoryItem[] } = {};
    sorted.forEach((item) => {
      const label = this.formatGroupDate(item);
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });

    const entries = Object.entries(groups).map(([date, items]) => ({
      date,
      items,
    }));
    entries.sort((a, b) => {
      const da = this.getBestDate(a.items[0])?.getTime() || 0;
      const db = this.getBestDate(b.items[0])?.getTime() || 0;
      return db - da;
    });
    return entries;
  }

  formatGroupDate(item: HistoryItem): string {
    const date = this.getBestDate(item);
    if (!date) return 'Tidak diketahui';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Hari Ini';
    if (date.toDateString() === yesterday.toDateString()) return 'Kemarin';
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    const d = new Date(String(dateStr).replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }

  private getBestDate(item: HistoryItem): Date | null {
    for (const c of [item.completed_at, item.updated_at, item.created_at]) {
      const d = this.parseDate(c);
      if (d) return d;
    }
    return null;
  }

  formatDate(item: HistoryItem): string {
    const date = this.getBestDate(item);
    if (!date) return '-';
    const day = date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    return `${day} · ${hh}:${mm}`;
  }

  async showDownloadOptions() {
    const sheet = await this.actionSheetCtrl.create({
      header: 'Download History',
      buttons: [
        {
          text: 'All History',
          icon: 'download-outline',
          handler: () => this.downloadCSV(this.allHistory, 'semua'),
        },
        {
          text: 'Choose Month',
          icon: 'calendar-outline',
          handler: () => this.showYearPicker(),
        },
        {
          text: 'Custom',
          icon: 'options-outline',
          handler: () => this.openDateModal(),
        },
        { text: 'Cancel', role: 'cancel', icon: 'close-outline' },
      ],
    });
    await sheet.present();
  }

  private getAvailableYears(): number[] {
    const years = new Set<number>();
    this.allHistory.forEach((h) => {
      const d = this.getBestDate(h);
      if (d) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }

  private async showYearPicker() {
    const years = this.getAvailableYears();
    if (years.length === 0) {
      this.showToast('Tidak ada data riwayat', 'warning');
      return;
    }
    const buttons: any[] = years.map((year) => ({
      text: `${year}`,
      handler: () => this.showMonthForYear(year),
    }));
    buttons.push({ text: 'Cancel', role: 'cancel' });
    const sheet = await this.actionSheetCtrl.create({
      header: 'Pilih Tahun',
      buttons,
    });
    await sheet.present();
  }

  private async showMonthForYear(year: number) {
    const monthNames = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    const available = monthNames
      .map((name, i) => {
        const count = this.allHistory.filter((h) => {
          const d = this.getBestDate(h);
          return d ? d.getMonth() === i && d.getFullYear() === year : false;
        }).length;
        return { name, index: i, count };
      })
      .filter((m) => m.count > 0);
    if (available.length === 0) {
      this.showToast(`Tidak ada data di tahun ${year}`, 'warning');
      return;
    }
    const buttons: any[] = available.map((m) => ({
      text: `${m.name} ${year} (${m.count} data)`,
      handler: () => {
        const filtered = this.allHistory.filter((h) => {
          const d = this.getBestDate(h);
          return d
            ? d.getMonth() === m.index && d.getFullYear() === year
            : false;
        });
        this.downloadCSV(filtered, `${m.name}-${year}`);
      },
    }));
    buttons.push({ text: 'Cancel', role: 'cancel' });
    const sheet = await this.actionSheetCtrl.create({
      header: `Bulan ${year}`,
      buttons,
    });
    await sheet.present();
  }

  openDateModal() {
    this.selectedStartDate = '';
    this.selectedEndDate = '';
    this.datePickerMode = 'start';
    this.showDateModal = true;
  }

  closeDateModal() {
    this.showDateModal = false;
  }

  onDateChange(event: any) {
    const value = event.detail.value;
    if (this.datePickerMode === 'start') {
      this.selectedStartDate = value;
      this.datePickerMode = 'end';
    } else this.selectedEndDate = value;
  }

  applyCustomDate() {
    if (!this.selectedStartDate || !this.selectedEndDate) {
      this.showToast('Pilih tanggal mulai dan akhir', 'warning');
      return;
    }
    const start = new Date(this.selectedStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(this.selectedEndDate);
    end.setHours(23, 59, 59, 999);
    const filtered = this.allHistory.filter((h) => {
      const d = this.getBestDate(h);
      return d ? d >= start && d <= end : false;
    });
    if (filtered.length === 0) {
      this.showToast('Tidak ada data di rentang tanggal tersebut', 'warning');
      return;
    }
    this.downloadCSV(filtered, 'custom');
    this.closeDateModal();
  }

  private async downloadCSV(data: HistoryItem[], suffix: string) {
    if (data.length === 0) {
      this.showToast('Tidak ada data untuk diunduh', 'warning');
      return;
    }
    const headers = [
      'No',
      'Nama Pelanggan',
      'Gangguan',
      'Status',
      'Lokasi',
      'Tanggal',
    ];
    const rows = data.map((h, i) => [
      i + 1,
      `"${h.customer_name || h.title || ''}"`,
      `"${h.title || ''}"`,
      h.status,
      `"${h.location_name || ''}"`,
      this.getBestDateStr(h),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `riwayat-mavii-${suffix}-${timestamp}.csv`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    if (Capacitor.isNativePlatform()) {
      const storageTargets: Array<{ directory: Directory; path: string }> = [
        { directory: Directory.ExternalStorage, path: `Download/${filename}` },
        { directory: Directory.Documents, path: `Download/${filename}` },
        { directory: Directory.Cache, path: filename },
        { directory: Directory.Data, path: `exports/${filename}` },
      ];

      let saved = false;
      for (const target of storageTargets) {
        try {
          const dirPath = target.path.includes('/')
            ? target.path.split('/').slice(0, -1).join('/')
            : '';
          if (dirPath) {
            await Filesystem.mkdir({
              path: dirPath,
              directory: target.directory,
              recursive: true,
            }).catch(() => {});
          }
          await Filesystem.writeFile({
            path: target.path,
            data: csv,
            directory: target.directory,
            encoding: Encoding.UTF8,
          });
          this.showToast(`File tersimpan: ${filename}`, 'success');
          this.showSaveSuccess(`File tersimpan: ${filename}`, () =>
            this.openSavedFile(target.path, target.directory, 'text/csv'),
          );
          saved = true;
          break;
        } catch (err) {
          console.error('CSV save failed for target', target, err);
        }
      }

      if (!saved) {
        this.showToast('Gagal menyimpan file ke perangkat', 'danger');
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Riwayat berhasil diunduh!', 'success');
  }

  private async showSaveSuccess(
    message: string,
    openHandler: () => Promise<void> | void,
  ) {
    const alert = await this.alertCtrl.create({
      header: 'File tersimpan',
      message,
      buttons: [
        {
          text: 'Buka',
          handler: async () => {
            await openHandler();
          },
        },
        { text: 'Tutup', role: 'cancel' },
      ],
    });
    await alert.present();
  }

  private async openSavedFile(
    path: string,
    directory: Directory,
    mimeType: string,
  ) {
    if (!Capacitor.isNativePlatform()) {
      this.showToast('Buka file lewat aplikasi lain', 'medium');
      return;
    }

    try {
      const { uri } = await Filesystem.getUri({ path, directory });
      await FileOpener.open({ filePath: uri, contentType: mimeType });
    } catch {
      this.showToast('Gagal membuka file', 'warning');
    }
  }

  private async showToast(
    message: string,
    color: string,
    buttons: any[] = [{ icon: 'close', role: 'cancel' }],
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      position: 'top',
      color,
      buttons,
    });
    await toast.present();
  }
}
