import { computed, makeObservable, observable } from 'mobx';
import { PagingList } from '../../libs/paging-list';

async function query(
  search: string,
  page: number,
): Promise<[string[], boolean]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return [new Array(10).fill(0).map((v, i) => `${search}-${page}-${i}`), true];
}

export default class PageListPageViewModel {
  constructor() {
    makeObservable(this);
  }

  @observable
  search = '';

  @computed
  get list(): PagingList<string> {
    const { search } = this;
    return new PagingList((page) => query(search, page));
  }
}
