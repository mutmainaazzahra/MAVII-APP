import { Component } from '@angular/core';
import { NavController } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.page.html',
  styleUrls: ['./privacy-policy.page.scss'],
  standalone: false,
})
export class PrivacyPolicyPage {
  isAgreed = false;

  constructor(private navCtrl: NavController) {}

  async acceptAndContinue() {
    if (!this.isAgreed) return;
    await Preferences.set({ key: 'app_welcomed', value: 'true' });
    this.navCtrl.navigateRoot(['/home'], { animated: true });
  }
}
