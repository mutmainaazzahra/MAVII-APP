import { TestBed } from '@angular/core/testing';

import { Progress } from './progress.service';

describe('Progress', () => {
  let service: Progress;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Progress);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
