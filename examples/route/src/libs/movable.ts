/* eslint-disable @typescript-eslint/no-empty-function */
import { observable, action, runInAction } from 'mobx';
import { HTMLAttributes } from 'react';
// 在mousedown时触发
export type StartHandler = () => [number, number] | undefined | null;
// 在mousemove至少2像素之后触发
export type MoveHandler = (x: number, y: number) => void;
// 在MoveHandler触发后，mouseup时触发
export type EndHandler = () => void;
// 在MoveHandler触发后，鼠标移动到窗口外，接受不到mouseup时，再回到窗口内时触发
export type CancelHandler = () => void;

export enum MouseButtons {
  LEFT = 1,
  RIGHT = 2,
  MIDDLE = 4,
}

export interface MovableOptions {
  handleStart: StartHandler;
  handleMove: MoveHandler;
  handleEnd: EndHandler;
  handleCancel: CancelHandler;
  acceptButtons: MouseButtons;
}
const defaultOptions: MovableOptions = {
  handleStart: () => null,
  handleMove: () => {},
  handleEnd: () => {},
  handleCancel: () => {},
  acceptButtons: 1,
};

export class MovableViewModel {
  options: MovableOptions;
  constructor(options: Partial<MovableOptions>) {
    this.options = {
      ...defaultOptions,
      ...options,
    };
  }

  // 是否正在拖拽中，只有移动超过2像素才会变成true
  @observable
  isMoving = false;

  eventHandlers: HTMLAttributes<HTMLElement> = {
    onMouseDown: (ev) => {
      const {
        acceptButtons,
        handleStart,
        handleMove,
        handleEnd,
        handleCancel,
      } = this.options;
      if ((ev.buttons & acceptButtons) === 0) {
        // 按键不正确，忽略
        return;
      }
      if (this.isMoving) {
        // 可能是touch事件正在处理中
        return;
      }
      const [originX, originY] = handleStart() || [ev.pageX, ev.pageY];

      // 前两位是baseX/baseY，对象坐标与指针坐标的差值
      // 后两位是pageX/pageY，指针坐标
      const [baseX, baseY, startX, startY] = [
        originX - ev.pageX,
        originY - ev.pageY,
        ev.pageX,
        ev.pageY,
      ];
      ev.stopPropagation();

      const cleanUp = () => {
        this.isMoving = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      const handleMouseMove = action((ev: MouseEvent) => {
        if ((ev.buttons & acceptButtons) === 0) {
          handleCancel();
          cleanUp();
          return;
        }
        if (
          !this.isMoving &&
          Math.abs(startX - ev.pageX) < 2 &&
          Math.abs(startY - ev.pageY) < 2
        ) {
          // 移动距离较短
          return;
        }
        ev.preventDefault();
        runInAction(() => {
          handleMove(baseX + ev.pageX, baseY + ev.pageY);
        });
        this.isMoving = true;
      });
      const handleMouseUp = action((ev: MouseEvent) => {
        if (
          !this.isMoving &&
          Math.abs(startX - ev.pageX) < 2 &&
          Math.abs(startY - ev.pageY) < 2
        ) {
          // 移动距离较短
          return;
        }
        ev.preventDefault();
        runInAction(() => {
          handleMove(baseX + ev.pageX, baseY + ev.pageY);
          handleEnd();
        });
        cleanUp();
      });

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
  };
}
