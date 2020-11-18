import { makeObservable, observable, action, computed } from 'mobx';
import { Rect } from '../../components/resizable';
import { MovableViewModel } from '../../libs/movable';

const randomColors = ['blue', 'red', 'green', 'yellow', 'purple'];

const mockGroups: Group[] = [
  {
    rect: {
      x: 20,
      y: 20,
      width: 180,
      height: 220,
    },
    items: randomColors.map((color) => ({ color })),
  },
];

export interface Item {
  color: string;
}
export interface Group {
  rect: Rect;
  items: Item[];
}

export default class DndViewModel {
  constructor() {
    makeObservable(this);
  }

  // 基本数据结构
  @observable
  groups: Group[] = mockGroups;

  // 是否正在拖拽中
  @computed
  get dragging(): boolean {
    return !!this.newGroup || !!this.draggingItem;
  }

  // 基本动作
  // 移除分组
  @action
  removeGroup(group: Group): void {
    const idx = this.groups.indexOf(group);
    if (idx >= 0) {
      this.groups.splice(idx, 1);
    }
  }

  // 拖动会让分组移动到顶部
  @action
  moveGroupToTop(group: Group): void {
    const idx = this.groups.indexOf(group);
    if (idx >= 0 && idx !== this.groups.length - 1) {
      this.groups.splice(idx, 1);
      this.groups.push(group);
    }
  }

  // 下面代码实现拖拽创建分组。
  // 这是一个新建-拖拽的场景，所以可以直接在handleEnd处理逻辑
  @observable
  newGroup: Group | null = null;

  newGroupMovable = new MovableViewModel({
    handleMove: (x, y) => {
      this.newGroup = {
        rect: {
          x: x - 100,
          y: y - 100,
          width: 200,
          height: 200,
        },
        items: [],
      };
    },
    handleEnd: () => {
      if (this.newGroup) {
        this.groups.push(this.newGroup);
        this.newGroup = null;
      }
    },
    handleCancel: () => {
      this.newGroup = null;
    },
  });

  // 下面代码是新建Item/拖拽Item的共同状态，需要识别拖放的目标。
  @observable
  draggingItem: Item | null = null;

  @observable
  draggingFromGroup: Group | null = null;

  @observable
  draggingItemPos: Rect | null = null;

  // 下面代码是新建Item的实现
  newItemMovable = new MovableViewModel({
    handleMove: (x, y) => {
      if (!this.draggingItem) {
        this.draggingItem = {
          color: randomColors[Math.floor(Math.random() * randomColors.length)],
        };
      }
      this.draggingItemPos = {
        x: x - 50,
        y: y - 18,
        width: 100,
        height: 32,
      };
    },
    handleEnd: () => {
      // 目标的mouseUp先触发，然后到这里。
      // 两种模式都可以（dnd下也是两种模式都可以）：
      // 1. 目标的mouseUp直接检查状态，处理逻辑，这里依然要处理状态清理。
      // 2. 目标的mouseUp仅做标记，这里统一处理逻辑。
      // Item种类单一而DropTarget种类极多时倾向于前者
      // 一般情况倾向于后者。
      // 注意两种拖拽来源逻辑略有不同（新建、移动）
      if (this.dropTarget) {
        switch (this.dropTarget.type) {
          case 'group': {
            const { group, index } = this.dropTarget;
            if (this.draggingItem) {
              group.items.splice(index, 0, this.draggingItem);
            }
            break;
          }
          default:
            break;
        }
      }
      this.draggingItem = null;
      this.draggingItemPos = null;
      this.dropTarget = null;
    },
    handleCancel: () => {
      this.draggingItem = null;
      this.draggingItemPos = null;
      this.dropTarget = null;
    },
  });

  // 下面代码是拖拽已有item的实现，用动态movable的模式
  handleItemMouseDown(
    ev: React.MouseEvent<HTMLElement>,
    item: Item,
    group?: Group,
  ): void {
    const rect = ev.currentTarget.getBoundingClientRect();
    const movable = new MovableViewModel({
      handleStart: () => {
        return [rect.x, rect.y];
      },
      handleMove: (x, y) => {
        console.log('handleMove');
        if (!this.draggingItem) {
          this.draggingItem = item;
          this.draggingFromGroup = group || null;
          this.draggingItemPos = {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        } else if (this.draggingItemPos) {
          this.draggingItemPos.x = x;
          this.draggingItemPos.y = y;
        }
      },
      handleEnd: () => {
        if (this.dropTarget && this.draggingFromGroup && this.draggingItem) {
          const originIdx = this.draggingFromGroup.items.indexOf(
            this.draggingItem,
          );
          this.draggingFromGroup.items.splice(originIdx, 1);
          switch (this.dropTarget.type) {
            case 'group': {
              const { group } = this.dropTarget;
              let { index } = this.dropTarget;
              if (group === this.draggingFromGroup && index > originIdx) {
                index--;
              }
              group.items.splice(index, 0, this.draggingItem);
              break;
            }
            case 'trash': {
              break;
            }
            default: {
              break;
            }
          }
        }
        this.draggingItem = null;
        this.draggingFromGroup = null;
        this.draggingItemPos = null;
        this.dropTarget = null;
      },
      handleCancel: () => {
        this.draggingItem = null;
        this.draggingFromGroup = null;
        this.draggingItemPos = null;
        this.dropTarget = null;
      },
    });
    movable.eventHandlers.onMouseDown?.(ev);
  }

  // 下面代码实现拖拽元素过程中的动效
  @observable
  dropTarget:
    | {
        type: 'group';
        group: Group;
        index: number;
      }
    | {
        type: 'trash';
      }
    | null = null;

  @action
  handleDragOverGroup(ev: React.MouseEvent, group: Group): void {
    if (!this.draggingItem) {
      return;
    }

    const bounding = ev.currentTarget.getBoundingClientRect();
    const y = ev.clientY - bounding.y + ev.currentTarget.scrollTop;

    // 这里采用坐标简单计算预期下标。其实可以更加严密。
    const index = Math.min(Math.round(y / 40), group.items.length);

    if (!this.dropTarget || this.dropTarget.type !== 'group') {
      this.dropTarget = {
        type: 'group',
        group,
        index,
      };
    } else {
      this.dropTarget.group = group;
      this.dropTarget.index = index;
    }
  }

  @action
  handleDragOverTrash(): void {
    if (!this.draggingItem) {
      return;
    }
    this.dropTarget = {
      type: 'trash',
    };
  }

  @action
  handleDragLeave(): void {
    if (!this.draggingItem) {
      return;
    }
    this.dropTarget = null;
  }
}
