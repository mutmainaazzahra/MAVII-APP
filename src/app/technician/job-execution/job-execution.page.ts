import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ToastController,
  AlertController,
  ActionSheetController,
  NavController,
} from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import heic2any from 'heic2any';

import { TaskService } from '../../core/services/task.service';
import { ProofService } from '../../core/services/proof.service';
import { LocationService } from '../../core/services/location.service';
import { AuthService } from '../../core/services/auth.service';
import { Task } from '../../core/models/task.model';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-job-execution',
  templateUrl: './job-execution.page.html',
  styleUrls: ['./job-execution.page.scss'],
  standalone: false,
})
export class JobExecutionPage implements OnInit, OnDestroy {
  task: Task | null = null;
  user: User | null = null;
  taskId!: number;
  isLoading = true;
  isCompleting = false;

  photoBefore: string | null = null; 
  photoBeforeBlob: Blob | null = null; 
  photoBeforeUploaded = false;
  isUploadingBefore = false;

  photoAfter: string | null = null;
  photoAfterBlob: Blob | null = null;
  photoAfterUploaded = false;
  isUploadingAfter = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private taskService: TaskService,
    private proofService: ProofService,
    private locationService: LocationService,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private navCtrl: NavController,
  ) {}

  ngOnInit() {
    this.taskId = Number(this.route.snapshot.paramMap.get('id'));
  }

  async ionViewWillEnter() {
    this.user = await this.authService.getStoredUser();
    await this.restoreState();
    await this.loadTask();
    this.locationService.startTracking(this.taskId);
  }

  ionViewWillLeave() {
    this.locationService.stopTracking();
  }
  ngOnDestroy() {
    this.locationService.stopTracking();
  }

  private async restoreState() {
    const { value: before } = await Preferences.get({
      key: `proof_before_${this.taskId}`,
    });
    const { value: after } = await Preferences.get({
      key: `proof_after_${this.taskId}`,
    });
    this.photoBeforeUploaded = before === 'true';
    this.photoAfterUploaded = after === 'true';

    try {
      const beforePreview = sessionStorage.getItem(
        `photo_before_${this.taskId}`,
      );
      if (beforePreview) {
        this.photoBefore = beforePreview;
        if (!this.photoBeforeUploaded) {
          
          const response = await fetch(beforePreview);
          this.photoBeforeBlob = await response.blob();
        }
      }
      const afterPreview = sessionStorage.getItem(`photo_after_${this.taskId}`);
      if (afterPreview) {
        this.photoAfter = afterPreview;
        if (!this.photoAfterUploaded) {
          const response = await fetch(afterPreview);
          this.photoAfterBlob = await response.blob();
        }
      }
    } catch {}
  }

  private async clearState() {
    await Preferences.remove({ key: `proof_before_${this.taskId}` });
    await Preferences.remove({ key: `proof_after_${this.taskId}` });
    try {
      sessionStorage.removeItem(`photo_before_${this.taskId}`);
      sessionStorage.removeItem(`photo_after_${this.taskId}`);
    } catch {}
  }

  async loadTask() {
    this.isLoading = true;
    this.taskService.getTaskDetail(this.taskId).subscribe({
      next: (res) => {
        this.task = res.data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Gagal memuat data tugas', 'danger');
      },
    });
  }

  private async showPhotoSourceOptions(): Promise<'camera' | 'gallery' | null> {
    return new Promise(async (resolve) => {
      const sheet = await this.actionSheetCtrl.create({
        header: 'Pilih Sumber Foto',
        buttons: [
          {
            text: 'Ambil Foto (Kamera)',
            icon: 'camera-outline',
            handler: () => resolve('camera'),
          },
          {
            text: 'Pilih dari Galeri',
            icon: 'image-outline',
            handler: () => resolve('gallery'),
          },
          { text: 'Batal', role: 'cancel', handler: () => resolve(null) },
        ],
      });
      await sheet.present();
    });
  }

  private async capturePhoto(): Promise<{
    base64: string;
    blob: Blob;
  } | null> {
    const source = await this.showPhotoSourceOptions();
    if (!source) return null;
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      });
      if (!image.dataUrl) return null;

      let blob = await (await fetch(image.dataUrl)).blob();
      let base64 = image.dataUrl; 

      
      const isHeic =
        blob.type === 'image/heic' ||
        blob.type === 'image/heif' ||
        image.dataUrl.includes('image/heic') ||
        image.dataUrl.includes('image/heif');

      if (isHeic) {
        try {
          console.log('HEIC detected, converting...');
          const convertedBlob = await heic2any({
            blob: blob,
            toType: 'image/jpeg',
            quality: 0.8,
          });
          blob = convertedBlob as Blob;

          
          base64 = await this.blobToBase64(blob);
          console.log('HEIC conversion success');
        } catch (conversionError) {
          console.error('HEIC conversion failed:', conversionError);
          this.showToast(
            'Gagal memproses foto HEIC, coba foto lain',
            'warning',
          );
          return null;
        }
      }

      const MAX_SIZE_BYTES = 5 * 1024 * 1024;
      if (blob.size > MAX_SIZE_BYTES) {
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
        this.showToast(
          `Foto terlalu besar (${sizeMB} MB). Maksimal 5 MB.`,
          'warning',
        );
        return null;
      }

      return { base64, blob };
    } catch (err: any) {
      if (err?.message && !err.message.toLowerCase().includes('cancel')) {
        this.showToast('Gagal mengambil foto', 'danger');
      }
      return null;
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async pickPhotoBefore() {
    const result = await this.capturePhoto();
    if (result) {
      this.photoBefore = result.base64;
      this.photoBeforeBlob = result.blob;
      this.photoBeforeUploaded = false;
      await Preferences.remove({ key: `proof_before_${this.taskId}` });
      try {
        sessionStorage.setItem(`photo_before_${this.taskId}`, result.base64);
      } catch {}
    }
  }

  async pickPhotoAfter() {
    const result = await this.capturePhoto();
    if (result) {
      this.photoAfter = result.base64;
      this.photoAfterBlob = result.blob;
      this.photoAfterUploaded = false;
      await Preferences.remove({ key: `proof_after_${this.taskId}` });
      try {
        sessionStorage.setItem(`photo_after_${this.taskId}`, result.base64);
      } catch {}
    }
  }

  async uploadPhotoBefore() {
    if (!this.photoBeforeBlob) {
      this.showToast('Pilih foto sebelum terlebih dahulu', 'warning');
      return;
    }
    this.isUploadingBefore = true;
    this.proofService
      .uploadProof(this.taskId, this.photoBeforeBlob, 'Foto sebelum pekerjaan')
      .subscribe({
        next: async () => {
          this.isUploadingBefore = false;
          this.photoBeforeUploaded = true;
          await Preferences.set({
            key: `proof_before_${this.taskId}`,
            value: 'true',
          });
          this.showToast('Foto sebelum berhasil diunggah!', 'success');
        },
        error: (err: any) => {
          this.isUploadingBefore = false;
          if (err?.status === 400) {
            this.showToast(
              'Klik "Mulai Pekerjaan" di Task Detail terlebih dahulu sebelum upload foto',
              'warning',
            );
          } else {
            this.showToast('Gagal mengunggah foto sebelum', 'danger');
          }
        },
      });
  }

  async uploadPhotoAfter() {
    if (!this.photoAfterBlob) {
      this.showToast('Pilih foto sesudah terlebih dahulu', 'warning');
      return;
    }
    this.isUploadingAfter = true;
    this.proofService
      .uploadProof(this.taskId, this.photoAfterBlob, 'Foto sesudah pekerjaan')
      .subscribe({
        next: async () => {
          this.isUploadingAfter = false;
          this.photoAfterUploaded = true;
          await Preferences.set({
            key: `proof_after_${this.taskId}`,
            value: 'true',
          });
          this.showToast('Foto sesudah berhasil diunggah!', 'success');
        },
        error: (err: any) => {
          this.isUploadingAfter = false;
          if (err?.status === 400) {
            this.showToast(
              'Klik "Mulai Pekerjaan" di Task Detail terlebih dahulu sebelum upload foto',
              'warning',
            );
          } else {
            this.showToast('Gagal mengunggah foto sesudah', 'danger');
          }
        },
      });
  }

  async confirmComplete() {
    if (!this.photoBeforeUploaded && !this.photoAfterUploaded) {
      const alert = await this.alertCtrl.create({
        header: 'Foto Bukti Belum Diupload',
        message:
          'Harap upload minimal satu foto bukti pekerjaan (Sebelum atau Sesudah) sebelum menyelesaikan pekerjaan.',
        buttons: [{ text: 'OK', role: 'cancel' }],
      });
      await alert.present();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Selesaikan Pekerjaan',
      message: 'Apakah pekerjaan ini sudah selesai?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { text: 'Selesai', handler: () => this.completeTask() },
      ],
    });
    await alert.present();
  }

  private completeTask() {
    this.isCompleting = true;
    this.taskService
      .completeTask(
        this.taskId,
        this.task?.actions || '',
        this.task?.catatan || '',
      )
      .subscribe({
        next: async () => {
          this.isCompleting = false;
          await this.clearState();
          this.locationService.stopTracking();
          this.showToast('Pekerjaan selesai!', 'success');
          setTimeout(
            () =>
              this.router.navigate(['/technician/tabs/tasks'], {
                replaceUrl: true,
              }),
            1500,
          );
        },
        error: () => {
          this.isCompleting = false;
          this.showToast('Gagal menyelesaikan pekerjaan', 'danger');
        },
      });
  }

  goBack() {
    this.navCtrl.back();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color,
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await toast.present();
  }
}
