import { makeObservable, observable } from 'mobx';

export default class HomeViewModel {
  constructor() {
    makeObservable(this);
  }

  @observable
  counter = 0;
}
