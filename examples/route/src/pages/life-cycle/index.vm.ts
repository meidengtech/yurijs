import { createRef } from 'react';

export default class LifeCycleViewModel {
  ref = createRef();

  mounted(): void {
    console.log('mounted!');
    console.log(this.ref.current);
  }

  beforeUnmount(): void {
    console.log('beforeUnmounted!');
  }
}
