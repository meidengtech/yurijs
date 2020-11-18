import { makeObservable, observable } from 'mobx';
import { createViewModel } from 'mobx-utils';

interface FormModel {
  account: string;
  password: string;
}

export default class FormViewModel {
  constructor() {
    makeObservable(this);
  }

  @observable
  model: FormModel = observable({
    account: '',
    password: '',
  });

  login(): void {
    alert(`Logined with ${this.model.account}`);
  }

  editModel = createViewModel(this.model);
}
