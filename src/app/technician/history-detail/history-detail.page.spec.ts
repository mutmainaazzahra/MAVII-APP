import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistoryDetailPage } from './history-detail.page';

describe('HistoryDetailPage', () => {
  let component: HistoryDetailPage;
  let fixture: ComponentFixture<HistoryDetailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HistoryDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
