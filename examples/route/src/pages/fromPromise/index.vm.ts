import { computed, makeObservable, observable } from 'mobx';
import {
  fromPromise,
  IPromiseBasedObservable,
  lazyObservable,
} from 'mobx-utils';

async function echo(data: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return data;
}

async function random(): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return Math.random();
}

export default class FromPromiseViewModel {
  constructor() {
    makeObservable(this);
  }

  someData = fromPromise(echo('hello'));

  lazy = lazyObservable<number>((sink) => random().then(sink));

  @observable
  name = '';

  @computed
  get echoName(): IPromiseBasedObservable<string> {
    return fromPromise(echo(this.name));
  }
}
