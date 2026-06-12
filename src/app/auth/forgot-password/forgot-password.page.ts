import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, NavController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { NetworkService } from '../../core/services/network.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: false,
})
export class ForgotPasswordPage {
  email = '';
  isLoading = false;
  errorMessage = '';
  emailError = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private networkService: NetworkService,
    private navCtrl: NavController,
  ) {}

  private validate(): boolean {
    this.emailError = '';
    this.errorMessage = '';

    if (!this.email.trim()) {
      this.emailError = 'Email tidak boleh kosong';
      return false;
    }
    if (!this.email.includes('@') || !this.email.includes('.')) {
      this.emailError = 'Format email tidak valid';
      return false;
    }
    return true;
  }

  async onSubmit() {
    if (!this.validate()) return;
    if (!this.networkService.isOnline()) {
      this.showToast('Tidak ada koneksi internet!', 'warning');
      return;
    }

    this.isLoading = true;
    this.authService.forgotPassword(this.email).subscribe({
      next: async (res) => {
        this.isLoading = false;
        await this.showToast(
          res.message || 'Link reset password telah dikirim ke email Anda.',
          'success',
        );
        this.router.navigate(['/auth/login'], { replaceUrl: true });
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 404) {
          this.errorMessage = 'Email tidak terdaftar.';
        } else if (err.status === 422) {
          this.errorMessage = 'Email tidak valid.';
        } else {
          this.errorMessage = 'Gagal mengirim link reset. Coba lagi.';
        }
      },
    });
  }

  goToLogin() {
    this.navCtrl.back();
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
