import { makeObservable, observable } from 'mobx';

export default class CounterViewModel {
  constructor() {
    makeObservable(this);
  }

  @observable
  counter = 0;
}
