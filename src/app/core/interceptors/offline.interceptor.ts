import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastController, NavController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';

@Injectable()
export class OfflineInterceptor implements HttpInterceptor {
  constructor(
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private router: Router,
  ) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (!navigator.onLine) {
          this.showToast(
            'Kamu sedang offline. Periksa koneksi internet.',
            'warning',
          );
          return throwError(() => new Error('Offline'));
        }
        switch (error.status) {
          case 0:
            this.showToast(
              'Server tidak dapat dihubungi. Coba lagi nanti.',
              'danger',
            );
            break;
          case 401: {
            const currentUrl = this.router.url;
            const isPublicPage =
              currentUrl.includes('/auth/login') ||
              currentUrl.includes('/forgot-password') ||
              currentUrl.includes('/reset-password') ||
              currentUrl.includes('/welcome');
            if (!isPublicPage) {
              this.showToast(
                'Sesi kamu telah berakhir. Silakan login kembali.',
                'danger',
              );
              this.logout();
            }
            break;
          }
          case 403: {
            const msg =
              error.error?.message || 'Aksi tidak diizinkan untuk tugas ini.';
            this.showToast(msg, 'warning');
            break;
          }
          case 404:
            break;
          case 422:
            break;
          case 500: {
            const msg = error.error?.message || 'Terjadi kesalahan pada server. Coba lagi nanti.';
            this.showToast(msg, 'danger');
            break;
          }
          default:
            if (error.status >= 400) {
              this.showToast('Terjadi kesalahan. Silakan coba lagi.', 'danger');
            }
            break;
        }
        return throwError(() => error);
      }),
    );
  }

  private async logout() {
    await Preferences.remove({ key: 'auth_token' });
    await Preferences.remove({ key: 'auth_user' });
    this.navCtrl.navigateRoot(['/auth/login']);
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
