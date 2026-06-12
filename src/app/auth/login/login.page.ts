import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { NetworkService } from '../../core/services/network.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  email = '';
  password = '';
  showPassword = false;
  isLoading = false;
  errorMessage = '';
  emailError = '';
  passwordError = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private networkService: NetworkService,
  ) {}

  ngOnInit() {
    this.reset();
  }

  private reset() {
    this.email = '';
    this.password = '';
    this.errorMessage = '';
    this.emailError = '';
    this.passwordError = '';
  }

  private validate(): boolean {
    this.emailError = '';
    this.passwordError = '';
    this.errorMessage = '';

    if (!this.email) {
      this.emailError = 'Email tidak boleh kosong';
      return false;
    }
    if (!this.email.includes('@')) {
      this.emailError = 'Format email tidak valid';
      return false;
    }
    if (!this.password) {
      this.passwordError = 'Password tidak boleh kosong';
      return false;
    }
    if (this.password.length < 6) {
      this.passwordError = 'Password minimal 6 karakter';
      return false;
    }
    return true;
  }

  async onLogin() {
    if (!this.validate()) return;
    if (!this.networkService.isOnline()) {
      this.showToast('Tidak ada koneksi internet!', 'warning');
      return;
    }

    this.isLoading = true;
    this.authService
      .login({ email: this.email, password: this.password })
      .subscribe({
        next: async (res) => {
          if (res && res.token) {
            const token = res.token;
            const user = res.user;

            if (user.role !== 'technician') {
              this.errorMessage =
                'Akses ditolak. Aplikasi ini hanya untuk teknisi.';
              await this.authService.clearAuthData();
              this.isLoading = false;
              return;
            }

            await this.authService.saveAuthData(token, user);
            this.showToast(`Welcome, ${user.name}!`, 'success');
            this.router.navigate(['/technician/tabs'], { replaceUrl: true });
          } else {
            this.errorMessage = res.message || 'Login gagal. Coba lagi.';
          }
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          if (err.status === 401)
            this.errorMessage = 'Email atau password salah.';
          else if (err.status === 422)
            this.errorMessage = 'Data yang dimasukkan tidak valid.';
          else this.errorMessage = 'Terjadi kesalahan. Coba lagi nanti.';
        },
      });
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top',
      color,
    });
    await toast.present();
  }
}
