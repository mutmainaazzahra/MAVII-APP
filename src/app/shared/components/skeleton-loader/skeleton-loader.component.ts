import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton-loader',
  templateUrl: './skeleton-loader.component.html',
  styleUrls: ['./skeleton-loader.component.scss'],
  standalone: false,
})
export class SkeletonLoaderComponent {
  @Input() count: number = 4; 

  getItems(): number[] {
    return Array(this.count).fill(0);
  }
}
