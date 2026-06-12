import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { NetworkService } from '../../core/services/network.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: false,
})
export class ResetPasswordPage implements OnInit {
  password = '';
  confirmPassword = '';
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  errorMessage = '';
  passwordError = '';
  confirmPasswordError = '';
  token = '';
  email = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private networkService: NetworkService,
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || '';
      this.email = params['email'] || '';
      if (!this.token) {
        this.errorMessage =
          'Token tidak valid. Silakan gunakan link dari email.';
      }
    });
  }

  private validate(): boolean {
    this.passwordError = '';
    this.confirmPasswordError = '';
    this.errorMessage = '';

    if (!this.password) {
      this.passwordError = 'Password baru tidak boleh kosong';
      return false;
    }
    if (this.password.length < 6) {
      this.passwordError = 'Password minimal 6 karakter';
      return false;
    }
    if (!this.confirmPassword) {
      this.confirmPasswordError = 'Konfirmasi password tidak boleh kosong';
      return false;
    }
    if (this.password !== this.confirmPassword) {
      this.confirmPasswordError = 'Password tidak cocok';
      return false;
    }
    return true;
  }

  async onReset() {
    if (!this.validate()) return;
    if (!this.networkService.isOnline()) {
      this.showToast('Tidak ada koneksi internet!', 'warning');
      return;
    }
    if (!this.token) {
      this.errorMessage = 'Token tidak valid. Silakan coba lagi.';
      return;
    }

    this.isLoading = true;
    this.authService
      .resetPassword(
        this.token,
        this.email,
        this.password,
        this.confirmPassword,
      )
      .subscribe({
        next: async (res) => {
          this.isLoading = false;
          await this.showToast(
            res.message || 'Password berhasil direset. Silakan login.',
            'success',
          );
          this.router.navigate(['/auth/login'], { replaceUrl: true });
        },
        error: (err) => {
          this.isLoading = false;
          if (err.status === 400) {
            this.errorMessage =
              err.error?.message || 'Token tidak valid atau sudah kadaluarsa.';
          } else if (err.status === 422) {
            this.errorMessage = 'Validasi gagal. Periksa password Anda.';
          } else {
            this.errorMessage = 'Terjadi kesalahan. Coba lagi nanti.';
          }
        },
      });
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color,
    });
    await toast.present();
  }
}
