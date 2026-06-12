import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  isAnimated = false;

  constructor(private navCtrl: NavController) {}

  ngOnInit() {
    setTimeout(() => {
      this.isAnimated = true;
    }, 100);
  }

  goToLogin() {
    this.navCtrl.navigateRoot(['/auth/login'], { animated: false });
  }
}
