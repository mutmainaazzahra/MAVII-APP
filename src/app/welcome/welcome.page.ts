import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  standalone: false,
})
export class WelcomePage implements OnInit {
  currentSlide = 0;

  slides = [
    {
      image: 'assets/welcome/slide1.png',
      title: 'Task Management & Assignment',
      description:
        'Admin membuat dan menugaskan pekerjaan ke teknisi. Teknisi dapat menerima atau menolak tugas dengan mudah dan terstruktur.',
    },
    {
      image: 'assets/welcome/slide2.png',
      title: 'Job Status Flow',
      description:
        'Setiap tugas memiliki alur status yang jelas: Assigned → Accepted → On-Going → Completed. Progress selalu terpantau.',
    },
    {
      image: 'assets/welcome/slide3.png',
      title: 'Location Tracking',
      description:
        'Lokasi teknisi diperbarui secara berkala. Admin dapat memantau posisi teknisi lapangan secara real-time.',
    },
    {
      image: 'assets/welcome/slide4.png',
      title: 'Proof of Work & History',
      description:
        'Teknisi upload foto bukti pekerjaan. Semua riwayat tersimpan dan dapat dipantau melalui dashboard admin.',
    },
  ];

  constructor(private navCtrl: NavController) {}

  async ngOnInit() {
    const { value: welcomed } = await Preferences.get({ key: 'app_welcomed' });
    const { value: token } = await Preferences.get({ key: 'auth_token' });
    if (welcomed && token) {
      this.navCtrl.navigateRoot(['/technician/tabs'], { animated: false });
    } else if (welcomed) {
      this.navCtrl.navigateRoot(['/home'], { animated: false });
    }
  }

  nextSlide() {
    if (this.currentSlide < this.slides.length - 1) {
      this.currentSlide++;
      setTimeout(() => {
        const img = document.querySelector('.slide-image') as HTMLElement;
        if (img) {
          img.style.animation = 'none';
          img.offsetHeight;
          img.style.animation = '';
        }
      }, 0);
    } else {
      this.goToPrivacyPolicy();
    }
  }

  skipSlides() {
    this.goToPrivacyPolicy();
  }

  goToPrivacyPolicy() {
    this.navCtrl.navigateForward(['/privacy-policy'], { animated: true });
  }

  isLastSlide(): boolean {
    return this.currentSlide === this.slides.length - 1;
  }
}
