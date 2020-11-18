import {
  action,
  computed,
  makeObservable,
  observable,
  runInAction,
} from 'mobx';

export type QueryFunction<T> = (page: number) => Promise<[T[], boolean]>;
export class PagingList<T> {
  constructor(query: QueryFunction<T>) {
    makeObservable(this);
    this._query = query;
  }

  private _query: QueryFunction<T>;

  @observable
  data: T[] = [];

  @observable
  page = 0;

  @observable
  hasMore = true;

  @observable
  loading = false;

  async _nextPage(): Promise<void> {
    this.loading = true;
    const [data, hasMore] = await this._query(this.page);
    runInAction(() => {
      this.page++;
      this.loading = false;
      this.hasMore = hasMore;
      for (const item of data) {
        this.data.push(item);
      }
    });
  }

  @computed
  get empty(): boolean {
    return !this.hasMore && this.data.length === 0;
  }

  @action
  loadMore(): void {
    if (this.hasMore && !this.loading) {
      this._nextPage();
    }
  }
}
