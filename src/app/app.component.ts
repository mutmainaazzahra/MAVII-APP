import { Component, NgZone, OnInit, OnDestroy } from '@angular/core';
import { NavController, Platform, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { SplashScreen } from '@capacitor/splash-screen';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { NotificationService } from './core/services/notification.service';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  private backButtonSub: any;

  constructor(
    private navCtrl: NavController,
    private platform: Platform,
    private alertCtrl: AlertController,
    private notifService: NotificationService,
    private authService: AuthService,
    private router: Router,
    private ngZone: NgZone,
  ) {}

  async ngOnInit() {
    await this.platform.ready();
    await this.notifService.initialize();
    await this.initApp();
    this.initBackButton();

    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.ngZone.run(() => {
        try {
          let url = event.url;
          if (url.startsWith('http://') || url.startsWith('https://')) {
            const urlObj = new URL(url);
            if (urlObj.pathname === '/reset-password') {
              const token = urlObj.searchParams.get('token');
              const email = urlObj.searchParams.get('email');
              if (token && email) {
                this.router.navigate(['/reset-password'], {
                  queryParams: { token, email },
                });
              }
            }
          } else if (url.startsWith('mavii://')) {
            const urlObj = new URL(url);
            if (urlObj.pathname === '/reset-password') {
              const token = urlObj.searchParams.get('token');
              const email = urlObj.searchParams.get('email');
              if (token && email) {
                this.router.navigate(['/reset-password'], {
                  queryParams: { token, email },
                });
              }
            }
          }
        } catch (error) {
          console.error('Deep link error:', error);
        }
      });
    });
  }

  private async initApp() {
    try {
      await new Promise((r) => setTimeout(r, 1500));
      await SplashScreen.hide({ fadeOutDuration: 300 });
      await new Promise((r) => setTimeout(r, 1800));

      const { value: token } = await Preferences.get({ key: 'auth_token' });
      const { value: welcomed } = await Preferences.get({
        key: 'app_welcomed',
      });

      if (token) {
        await this.navCtrl.navigateRoot(['/technician/tabs'], {
          animated: false,
        });
      } else if (!welcomed) {
        await this.navCtrl.navigateRoot(['/welcome'], { animated: false });
      } else {
        await this.navCtrl.navigateRoot(['/home'], { animated: false });
      }
      this.hideWebSplash();
    } catch {
      await SplashScreen.hide();
      this.navCtrl.navigateRoot(['/welcome'], { animated: false });
      this.hideWebSplash();
    }
  }

  private hideWebSplash() {
    const el = document.getElementById('web-splash');
    if (el) {
      el.style.transition = 'opacity 0.4s ease';
      el.style.opacity = '0';
      setTimeout(() => {
        el.style.display = 'none';
      }, 400);
    }
  }

  private initBackButton() {
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(10, async () => {
      const currentUrl = this.router.url;
      const isRootRoute = this.isRootRoute(currentUrl);

      if (isRootRoute) {
        await this.showExitConfirm();
      } else {
        this.navCtrl.back();
      }
    });
  }

  private isRootRoute(url: string): boolean {
    const normalizedUrl = (url || '').split('?')[0];
    return ['/welcome', '/home', '/auth/login', '/technician/tabs'].some(
      (route) =>
        normalizedUrl === route || normalizedUrl.startsWith(`${route}/`),
    );
  }

  private async showExitConfirm() {
    const alert = await this.alertCtrl.create({
      header: 'Keluar Aplikasi',
      message: 'Yakin ingin keluar dari MAVII?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { text: 'Keluar', handler: () => App.exitApp() },
      ],
    });
    await alert.present();
  }

  ngOnDestroy() {
    if (this.backButtonSub) this.backButtonSub.unsubscribe();
  }
}
