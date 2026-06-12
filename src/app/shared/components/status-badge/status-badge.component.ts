import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.component.html',
  styleUrls: ['./status-badge.component.scss'],
  standalone: false,
})
export class StatusBadgeComponent {
  @Input() status: string = '';

  getColor(): string {
    switch (this.status) {
      case 'assigned':
        return 'warning';
      case 'accepted':
        return 'success';
      case 'on-going':
        return 'primary';
      case 'completed':
        return 'medium';
      case 'rejected':
        return 'danger';
      default:
        return 'medium';
    }
  }

  getLabel(): string {
    switch (this.status) {
      case 'assigned':
        return 'Assigned';
      case 'accepted':
        return 'Accepted';
      case 'on-going':
        return 'On-Going';
      case 'completed':
        return 'Completed';
      case 'rejected':
        return 'Rejected';
      default:
        return this.status;
    }
  }

  getIcon(): string {
    switch (this.status) {
      case 'assigned':
        return 'time-outline';
      case 'accepted':
        return 'checkmark-outline';
      case 'on-going':
        return 'play-outline';
      case 'completed':
        return 'checkmark-done-outline';
      case 'rejected':
        return 'close-outline';
      default:
        return 'help-outline';
    }
  }
}
