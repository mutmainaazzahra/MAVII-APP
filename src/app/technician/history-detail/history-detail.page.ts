import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ToastController,
  ActionSheetController,
  AlertController,
} from '@ionic/angular';
import { HistoryService } from '../../core/services/history.service';
import { TaskService } from '../../core/services/task.service';
import { AuthService } from '../../core/services/auth.service';
import { Task, TaskProof } from '../../core/models/task.model';
import { User } from '../../core/models/user.model';
import { NavController } from '@ionic/angular';
import { environment } from '../../../environments/environment';
import { EmailComposer } from 'capacitor-email-composer';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

@Component({
  selector: 'app-history-detail',
  templateUrl: './history-detail.page.html',
  styleUrls: ['./history-detail.page.scss'],
  standalone: false,
})
export class HistoryDetailPage implements OnInit {
  task: Task | null = null;
  user: User | null = null;
  isLoading = true;
  taskId!: number;

  constructor(
    private navCtrl: NavController,
    private route: ActivatedRoute,
    private router: Router,
    private historyService: HistoryService,
    private taskService: TaskService,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit() {
    this.taskId = Number(this.route.snapshot.paramMap.get('id'));
  }

  async ionViewWillEnter() {
    this.user = await this.authService.getStoredUser();
    await this.loadDetail();
  }

  async loadDetail() {
    this.isLoading = true;
    this.taskService.getTaskDetail(this.taskId).subscribe({
      next: (res) => {
        this.task = res.data;
        this.isLoading = false;
      },
      error: () => {
        this.historyService.getHistoryDetail(this.taskId).subscribe({
          next: (res) => {
            this.task = res.data;
            this.isLoading = false;
          },
          error: () => {
            this.isLoading = false;
            this.showToast('Gagal memuat detail riwayat', 'danger');
          },
        });
      },
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  getStatusLabel(status: string): string {
    return status === 'completed' ? 'Finished' : 'Canceled';
  }

  getTindakan(): string {
    const actions = this.task?.actions;
    if (!actions) return '';
    if (typeof actions === 'string') return actions;
    if (Array.isArray(actions)) return (actions as string[]).join(', ');
    return '';
  }

  getCatatan(): string {
    const catatan = this.task?.catatan;
    if (!catatan) return '';
    if (typeof catatan === 'string') return catatan;
    if (Array.isArray(catatan)) return (catatan as string[]).join(', ');
    return '';
  }

  getAllProofs(): TaskProof[] {
    return this.task?.proofs || [];
  }

  formatDate(dateStr?: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(String(dateStr).replace(' ', 'T'));
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getPhotoUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${environment.apiUrl}/storage/${path}`;
  }

  getProxyImageUrl(path: string): string {
    if (!path) return '';
    const filename =
      path.replace('proofs/', '').split('/').pop() ||
      path.split('/').pop() ||
      '';
    return `${environment.apiUrl}/api/technician/proof/${filename}`;
  }

  getProofTypeLabel(proof: TaskProof): string {
    const label = (proof.note || proof.caption || '').toLowerCase();
    if (label.includes('sebelum')) return 'Foto Sebelum';
    if (label.includes('sesudah')) return 'Foto Sesudah';
    return 'Bukti Pekerjaan';
  }

  private async loadImageAsBase64(photoPath: string): Promise<string | null> {
    const proxyUrl = this.getProxyImageUrl(photoPath);
    const directUrl = this.getPhotoUrl(photoPath);

    for (const url of [proxyUrl, directUrl]) {
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${await this.getAuthToken()}`,
          },
        });
        if (!response.ok) continue;
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        return dataUrl;
      } catch {}
    }
    return null;
  }

  private async getAuthToken(): Promise<string> {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'auth_token' });
      return value || '';
    } catch {
      return '';
    }
  }

  private async compressImage(
    base64: string,
    maxWidth: number = 1200,
    quality: number = 0.75,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = reject;
      img.src = base64;
    });
  }

  private async loadProofImages(): Promise<{ [id: number]: string }> {
    const images: { [id: number]: string } = {};
    const proofs = this.getAllProofs();
    for (const proof of proofs) {
      if (proof.photo_path) {
        let img = await this.loadImageAsBase64(proof.photo_path);
        if (img) {
          img = await this.compressImage(img, 1200, 0.75);
          images[proof.id] = img;
        }
      }
    }
    return images;
  }

  private getJsPDFInstance(): any {
    const w = window as any;
    if (!w.jspdf) {
      this.showToast('Library PDF belum siap, coba lagi', 'warning');
      return null;
    }
    const { jsPDF } = w.jspdf;
    return new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  }

  private buildPdfDoc(proofImages: { [id: number]: string } = {}): any {
    if (!this.task) return null;
    const doc = this.getJsPDFInstance();
    if (!doc) return null;

    const margin = 15;
    const pageW = 210;
    const contentW = pageW - 2 * margin;
    let y = 20;
    const lh = 6;

    const checkPage = () => {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
    };

    const section = (title: string) => {
      checkPage();
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(19, 29, 170);
      doc.text(title, margin, y);
      y += 2;
      doc.setDrawColor(19, 29, 170);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageW - margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(26, 26, 46);
    };

    const row = (label: string, value: string) => {
      checkPage();
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(108, 117, 125);
      doc.text(label, margin, y);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 26, 46);
      const lines = doc.splitTextToSize(value || '-', contentW - 52);
      doc.text(lines, margin + 52, y);
      y += lh * lines.length + 1;
    };

    const emptyText = (text: string) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(170, 170, 170);
      doc.text(text, margin, y);
      y += lh;
    };

    const t = this.task;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 29, 170);
    doc.text('Laporan Pekerjaan', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(108, 117, 125);
    doc.text('MAVII — Field Service Management System', margin, y);
    y += 8;

    const isCompleted = t.status === 'completed';
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(
      isCompleted ? 21 : 114,
      isCompleted ? 87 : 28,
      isCompleted ? 36 : 36,
    );
    doc.text(isCompleted ? '✓ Finished' : '✗ Canceled', margin, y);
    y += 12;

    section('Informasi Pelanggan');
    row('Nama', t.customer_name || t.title);
    row('Telepon', t.customer_phone || '-');
    row('Lokasi / Alamat', t.location_name);
    y += 5;

    section('Detail Pekerjaan');
    row('Jenis Gangguan', t.description || t.title);
    row('Status', isCompleted ? 'Finished' : 'Canceled');
    row('Tanggal Selesai', this.formatDate(t.completed_at || t.updated_at));
    y += 5;

    section('Teknisi');
    row('Nama', this.user?.name || '-');
    row('Email', this.user?.email || '-');
    row('Telepon', this.user?.phone || '-');
    y += 5;

    section('Tindakan');
    const tindakan = this.getTindakan();
    if (!tindakan) {
      emptyText('Tidak ada tindakan tercatat');
    } else {
      const lines = doc.splitTextToSize(tindakan, contentW);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      doc.text(lines, margin, y);
      y += lh * lines.length;
    }
    y += 5;

    section('Catatan');
    const catatan = this.getCatatan();
    if (!catatan) {
      emptyText('Tidak ada catatan');
    } else {
      const lines = doc.splitTextToSize(catatan, contentW);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      doc.text(lines, margin, y);
      y += lh * lines.length;
    }
    y += 5;

    section('Bukti Pekerjaan');
    const proofs = this.getAllProofs();
    if (proofs.length === 0) {
      emptyText('Tidak ada bukti pekerjaan');
    } else {
      for (const p of proofs) {
        const typeLabel = this.getProofTypeLabel(p);
        checkPage();

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(19, 29, 170);
        doc.text(typeLabel, margin, y);
        y += lh;

        const imgData = proofImages[p.id];
        if (imgData) {
          const remainingSpace = 287 - y - 10;
          if (remainingSpace < 40) {
            doc.addPage();
            y = 20;
          }
          try {
            const imgWidth = contentW;
            let imgHeight = imgWidth * 0.65;
            const maxImgHeight = 130;
            if (imgHeight > maxImgHeight) {
              imgHeight = maxImgHeight;
            }
            const availableHeight = remainingSpace - 6;
            if (imgHeight > availableHeight) {
              imgHeight = availableHeight > 0 ? availableHeight : 50;
            }
            doc.addImage(
              imgData,
              'JPEG',
              margin,
              y,
              imgWidth,
              imgHeight,
              undefined,
              'MEDIUM',
            );
            y += imgHeight + 6;
          } catch {
            emptyText('(Gambar tidak dapat ditampilkan)');
          }
        } else {
          const imgUrl = this.getPhotoUrl(p.photo_path);
          doc.setFontSize(9);
          doc.setTextColor(19, 29, 170);
          doc.textWithLink('Klik untuk lihat foto', margin, y, { url: imgUrl });
          y += lh;
          doc.setFontSize(8);
          doc.setTextColor(170, 170, 170);
          doc.text(
            '(Pasang CORS header di server untuk tampilkan foto dalam PDF)',
            margin,
            y,
            { maxWidth: contentW },
          );
          y += lh + 2;
        }
      }
    }

    const today = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    doc.setFontSize(9);
    doc.setTextColor(170, 170, 170);
    doc.text(`Dibuat oleh: MAVII • ${today}`, pageW / 2, 287, {
      align: 'center',
    });

    return doc;
  }

  async downloadPdf() {
    if (!this.task) return;

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:white;border-radius:16px;padding:28px 36px;text-align:center;">
      <div style="font-size:28px;margin-bottom:10px;">📄</div>
      <div style="font-size:15px;font-weight:700;color:#131DAA;">Membuat PDF...</div>
      <div style="font-size:12px;color:#888;margin-top:4px;">Memuat foto bukti, mohon tunggu</div>
    </div>`;
    document.body.appendChild(overlay);

    await new Promise((r) => setTimeout(r, 300));

    try {
      const proofImages = await this.loadProofImages();
      const doc = this.buildPdfDoc(proofImages);
      if (!doc) throw new Error('fail');
      const filename = this.getTimestampFilename(`laporan-mavii-${this.task.id}`, 'pdf');
      const blob = doc.output('blob');
      await this.saveBlobToDevice(blob, filename);
    } catch {
      this.showToast('Gagal membuat PDF', 'danger');
    } finally {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  }

  private async generatePdfBlob(): Promise<Blob | null> {
    try {
      const proofImages = await this.loadProofImages();
      const doc = this.buildPdfDoc(proofImages);
      if (!doc) return null;
      return doc.output('blob');
    } catch {
      return null;
    }
  }

  async showShareOptions() {
    const sheet = await this.actionSheetCtrl.create({
      header: 'Bagikan Laporan',
      buttons: [
        {
          text: 'WhatsApp',
          icon: 'logo-whatsapp',
          handler: () => this.shareWhatsApp(),
        },
        {
          text: 'Email',
          icon: 'mail-outline',
          handler: () => this.shareEmail(),
        },
        {
          text: 'Download PDF',
          icon: 'download-outline',
          handler: () => this.downloadPdf(),
        },
        { text: 'Batal', role: 'cancel', icon: 'close-outline' },
      ],
    });
    await sheet.present();
  }

  async shareWhatsApp() {
    this.showToast('Menyiapkan PDF...', 'medium');
    const blob = await this.generatePdfBlob();
    if (!blob) {
      this.showToast('Gagal membuat PDF', 'danger');
      return;
    }
    const filename = this.getTimestampFilename(`laporan-mavii-${this.task?.id || 'laporan'}`, 'pdf');
    const file = new File([blob], filename, { type: 'application/pdf' });
    try {
      if (
        (navigator as any).share &&
        (navigator as any).canShare?.({ files: [file] })
      ) {
        await (navigator as any).share({
          files: [file],
          title: `Laporan - ${this.task?.customer_name || this.task?.title}`,
        });
      } else {
        this.triggerBlobDownload(blob, filename);
        this.showToast(
          'PDF didownload. Lampirkan ke WhatsApp secara manual.',
          'success',
        );
        setTimeout(() => {
          const text = `*Laporan Pekerjaan MAVII*\n\n*Pelanggan:* ${this.task?.customer_name || this.task?.title}\n*Lokasi:* ${this.task?.location_name || '-'}\n*Gangguan:* ${this.task?.description || this.task?.title}\n*Status:* ${this.getStatusLabel(this.task?.status || '')}\n*Teknisi:* ${this.user?.name}\n*Tanggal:* ${this.formatDate(this.task?.completed_at || this.task?.updated_at)}`;
          window.open(
            `https://wa.me/?text=${encodeURIComponent(text)}`,
            '_blank',
          );
        }, 800);
      }
    } catch (err: any) {
      if (err?.message && !err.message.toLowerCase().includes('cancel')) {
        this.showToast('Gagal berbagi', 'danger');
      }
    }
  }

  async shareEmail() {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative) {
      await this.shareEmailFallback();
      return;
    }

    this.showToast('Menyiapkan PDF...', 'medium');
    const blob = await this.generatePdfBlob();
    if (!blob) {
      this.showToast('Gagal membuat PDF', 'danger');
      return;
    }
    const filename = this.getTimestampFilename(`laporan-mavii-${this.task?.id || 'laporan'}`, 'pdf');
    this.triggerBlobDownload(blob, filename);
    this.showToast('PDF berhasil didownload', 'success');

    const subject = `Laporan Pekerjaan - ${this.task?.customer_name || this.task?.title} - MAVII`;
    const tindakan = this.getTindakan();
    const catatan = this.getCatatan();
    const body = `Yth. ${this.task?.customer_name || 'Pelanggan'},\n\nBerikut adalah ringkasan laporan pekerjaan:\n\nPelanggan: ${this.task?.customer_name || this.task?.title}\nGangguan: ${this.task?.description || this.task?.title}\nStatus: ${this.getStatusLabel(this.task?.status || '')}\nTeknisi: ${this.user?.name}\nTanggal: ${this.formatDate(this.task?.completed_at || this.task?.updated_at)}\n\nTindakan: ${tindakan || '-'}\nCatatan: ${catatan || '-'}\n\nFile PDF laporan lengkap (termasuk bukti foto) telah didownload ke perangkat Anda. Silakan lampirkan file PDF tersebut secara manual ke email ini.\n\nTerima kasih.\n\nMAVII - Field Service Management`;

    try {
      await EmailComposer.open({
        to: [],
        subject: subject,
        body: body,
        isHtml: false,
        attachments: [],
      });
      this.showToast('Email client dibuka, lampirkan PDF manual', 'success');
    } catch (err) {
      console.error(err);
      this.showToast('Gagal membuka email client', 'danger');
    }
  }

  private async shareEmailFallback() {
    this.showToast('Menyiapkan PDF...', 'medium');
    const blob = await this.generatePdfBlob();
    if (!blob) {
      this.showToast('Gagal membuat PDF', 'danger');
      return;
    }
    const filename = this.getTimestampFilename(`laporan-mavii-${this.task?.id || 'laporan'}`, 'pdf');
    this.triggerBlobDownload(blob, filename);
    this.showToast('PDF berhasil didownload', 'success');
    const tindakan = this.getTindakan();
    const catatan = this.getCatatan();
    const subject = `Laporan Pekerjaan - ${this.task?.customer_name || this.task?.title} - MAVII`;
    const body = `PDF laporan sudah didownload. Silakan lampirkan file PDF ke email ini.\n\nPelanggan: ${this.task?.customer_name || this.task?.title}\nGangguan: ${this.task?.description || this.task?.title}\nStatus: ${this.getStatusLabel(this.task?.status || '')}\nTeknisi: ${this.user?.name}\nTindakan: ${tindakan || '-'}\nCatatan: ${catatan || '-'}`;
    setTimeout(
      () =>
        window.open(
          `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
          '_blank',
        ),
      800,
    );
  }

  private getTimestampFilename(prefix: string, ext: string): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `${prefix}-${timestamp}.${ext}`;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return blob.arrayBuffer().then((buffer) => {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return btoa(binary);
    });
  }

  private async saveBlobToDevice(blob: Blob, filename: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const storageTargets: Array<{ directory: Directory; path: string }> = [
        { directory: Directory.ExternalStorage, path: `Download/${filename}` },
        { directory: Directory.Documents, path: `Download/${filename}` },
        { directory: Directory.Cache, path: filename },
        { directory: Directory.Data, path: `exports/${filename}` },
      ];

      let saved = false;
      const base64 = await this.blobToBase64(blob);
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
            data: base64,
            directory: target.directory,
          });
          this.showToast(`PDF tersimpan: ${filename}`, 'success');
          this.showSaveSuccess(`File tersimpan: ${filename}`, () =>
            this.openSavedFile(
              target.path,
              target.directory,
              'application/pdf',
            ),
          );
          saved = true;
          break;
        } catch (err) {
          console.error('PDF save failed for target', target, err);
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
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.showToast('PDF berhasil didownload!', 'success');
  }

  private triggerBlobDownload(blob: Blob, filename: string) {
    this.saveBlobToDevice(blob, filename);
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
