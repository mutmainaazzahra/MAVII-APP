import { Component, OnInit, OnDestroy } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';
import { NavController } from '@ionic/angular';
import { environment } from '../../../environments/environment';
import { LocationService } from '../../core/services/location.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit, OnDestroy {
  user: User | null = null;
  profilePhoto: string | null = null;
  showProfileModal = false;
  showSuccess = false;
  isSaving = false;
  formName = '';
  formEmail = '';
  formPhone = '';
  newPhotoDataUrl: string | null = null;

  showChangePassword = false;
  formCurrentPassword = '';
  formNewPassword = '';
  formNewPasswordConfirmation = '';
  showCurrentPw = false;
  showNewPw = false;
  showConfirmPw = false;

  private refreshInterval: any = null;

  constructor(
    private navCtrl: NavController,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private locationService: LocationService,
    private notificationService: NotificationService,
  ) {}

  async ngOnInit() {
    await this.refreshUserData();
    this.startAutoRefresh();
  }

  async ionViewWillEnter() {
    await this.refreshUserData();
    this.startAutoRefresh();
  }

  ionViewWillLeave() {
    this.stopAutoRefresh();
  }

  ngOnDestroy() {
    this.stopAutoRefresh();
  }

  private startAutoRefresh() {
    if (this.refreshInterval) return;
    this.refreshInterval = setInterval(() => {
      this.refreshUserData();
    }, 30000);
  }

  private stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private async refreshUserData() {
    try {
      const updatedUser = await this.authService.refreshUser().toPromise();
      if (updatedUser) {
        this.user = updatedUser;
        if (this.user && this.user.avatar) {
          this.user.avatar = this.normalizeAvatarUrl(this.user.avatar);
        }
        this.profilePhoto = this.user?.avatar
          ? `${this.user.avatar}?t=${new Date().getTime()}`
          : null;
        const token = await this.authService.getStoredToken();
        if (this.user) {
          await this.authService.saveAuthData(token || '', this.user);
        }
        if (this.showProfileModal && this.user) {
          this.formName = this.user.name || '';
          this.formPhone = this.user.phone || '';
        }
      }
    } catch {
      const stored = await this.authService.getStoredUser();
      if (stored) {
        this.user = stored;
        if (this.user && this.user.avatar) {
          this.user.avatar = this.normalizeAvatarUrl(this.user.avatar);
        }
        this.profilePhoto = this.user?.avatar
          ? `${this.user.avatar}?t=${new Date().getTime()}`
          : null;
      }
    }
  }

  private isValidPhotoUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    return (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:')
    );
  }

  private normalizeAvatarUrl(url: string): string {
    if (!url) return url;
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:')
    ) {
      return url;
    }
    let baseUrl = environment.apiUrl;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    if (cleanUrl.startsWith('avatars/')) {
      return `${baseUrl}/storage/${cleanUrl}`;
    }
    if (cleanUrl.startsWith('storage/')) {
      return `${baseUrl}/${cleanUrl}`;
    }
    return `${baseUrl}/${cleanUrl}`;
  }

  onAvatarError() {
    this.profilePhoto = null;
  }

  openProfileModal() {
    if (this.user) {
      this.formName = this.user.name || '';
      this.formEmail = this.user.email || '';
      this.formPhone = this.user.phone || '';
    }
    this.newPhotoDataUrl = null;
    this.showSuccess = false;
    this.showChangePassword = false;
    this.formCurrentPassword = '';
    this.formNewPassword = '';
    this.formNewPasswordConfirmation = '';
    this.showCurrentPw = false;
    this.showNewPw = false;
    this.showConfirmPw = false;
    this.showProfileModal = true;
  }

  closeProfileModal() {
    this.showProfileModal = false;
    this.showSuccess = false;
    this.newPhotoDataUrl = null;
    this.showChangePassword = false;
    this.formCurrentPassword = '';
    this.formNewPassword = '';
    this.formNewPasswordConfirmation = '';
  }

  toggleChangePassword() {
    this.showChangePassword = !this.showChangePassword;
    if (!this.showChangePassword) {
      this.formCurrentPassword = '';
      this.formNewPassword = '';
      this.formNewPasswordConfirmation = '';
    }
  }

  async pickPhoto() {
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    if (isNative) {
      try {
        await Camera.requestPermissions();
        const image = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
        });
        if (image.dataUrl) {
          this.profilePhoto = image.dataUrl;
          this.newPhotoDataUrl = image.dataUrl;
        }
      } catch {
        this.showToast('Gagal memilih foto', 'danger');
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/jpg,image/png,image/webp';
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          this.showToast('Ukuran foto maksimal 5MB', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          this.profilePhoto = reader.result as string;
          this.newPhotoDataUrl = reader.result as string;
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  }

  async saveProfile() {
    if (!this.formName.trim()) {
      this.showToast('Nama tidak boleh kosong', 'warning');
      return;
    }

    if (this.showChangePassword) {
      if (!this.formCurrentPassword) {
        this.showToast('Password saat ini tidak boleh kosong', 'warning');
        return;
      }
      if (!this.formNewPassword) {
        this.showToast('Password baru tidak boleh kosong', 'warning');
        return;
      }
      if (this.formNewPassword.length < 6) {
        this.showToast('Password baru minimal 6 karakter', 'warning');
        return;
      }
      if (this.formNewPassword !== this.formNewPasswordConfirmation) {
        this.showToast('Konfirmasi password baru tidak cocok', 'warning');
        return;
      }
    }

    this.isSaving = true;

    const formData = new FormData();
    formData.append('name', this.formName);
    formData.append('phone', this.formPhone);
    if (this.newPhotoDataUrl) {
      const blob = this.dataUrlToBlob(this.newPhotoDataUrl);
      formData.append('avatar', blob, 'avatar.jpg');
    }
    if (
      this.showChangePassword &&
      this.formCurrentPassword &&
      this.formNewPassword
    ) {
      formData.append('current_password', this.formCurrentPassword);
      formData.append('new_password', this.formNewPassword);
      formData.append(
        'new_password_confirmation',
        this.formNewPasswordConfirmation,
      );
    }

    this.authService.updateProfile(formData).subscribe({
      next: async (res: any) => {
        this.isSaving = false;
        this.showSuccess = true;
        this.showToast('Profil berhasil diperbarui', 'success');
        await this.refreshUserData();
        this.newPhotoDataUrl = null;
        this.showChangePassword = false;
        this.formCurrentPassword = '';
        this.formNewPassword = '';
        this.formNewPasswordConfirmation = '';
      },
      error: async (err: any) => {
        this.isSaving = false;
        if (err?.status === 422) {
          const msg =
            err?.error?.message ||
            err?.error?.errors?.current_password?.[0] ||
            'Password saat ini salah atau data tidak valid.';
          this.showToast(msg, 'danger');
        } else if (err?.status === 401) {
          this.showToast('Password saat ini salah.', 'danger');
        } else {
          this.showToast('Gagal menyimpan perubahan. Coba lagi.', 'danger');
        }
      },
    });
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  async confirmLogout() {
    const alert = await this.alertCtrl.create({
      header: 'Konfirmasi',
      message: 'Apakah anda yakin ingin keluar?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { text: 'Keluar', handler: () => this.logout() },
      ],
    });
    await alert.present();
  }

  private async logout() {
    await this.notificationService.clearLocal();
    await this.locationService.setOffline().toPromise();
    await Preferences.remove({ key: 'worker_online_status' });
    this.authService.logout().subscribe({
      next: async () => {
        await this.authService.clearAuthData();
        this.navCtrl.navigateRoot(['/auth/login']);
      },
      error: async () => {
        await this.authService.clearAuthData();
        this.navCtrl.navigateRoot(['/auth/login']);
      },
    });
  }

  getUserInitial(): string {
    return this.user?.name?.charAt(0).toUpperCase() || 'T';
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
