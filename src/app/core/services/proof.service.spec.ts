import { TestBed } from '@angular/core/testing';

import { Proof } from './proof.service';

describe('Proof', () => {
  let service: Proof;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Proof);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
