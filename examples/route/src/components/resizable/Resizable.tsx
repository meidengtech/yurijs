import * as React from 'react';
import { FC, HTMLAttributes, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { isObservableObject } from 'mobx';
import classnames from 'classnames';
import { MovableViewModel } from '../../libs/movable';
import styles from './index.less';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeHandlerProps {
  rect: Rect;
  maxWidth: number;
  minWidth: number;
  maxHeight: number;
  minHeight: number;
  onMoving?: () => void;
  onMoveEnd?: () => void;
}

export type MovableProps = HTMLAttributes<HTMLDivElement> & ResizeHandlerProps;

export const Movable: FC<MovableProps> = observer(
  ({
    rect,
    style,
    className,
    onMoving,
    onMoveEnd,
    maxWidth,
    minWidth,
    maxHeight,
    minHeight,
    ...others
  }) => {
    const vm = useMemo(() => {
      if (!isObservableObject(rect)) {
        console.warn('rect props for Moving/Resizing should be observable.');
      }
      return new MovableViewModel({
        handleStart: () => [rect.x, rect.y],
        handleMove: (x, y) => {
          (rect.x = x), (rect.y = y);
          onMoving && onMoving();
        },
        handleEnd: () => {
          onMoveEnd && onMoveEnd();
        },
      });
    }, [rect, onMoving, onMoveEnd]);
    return (
      <div
        {...others}
        className={classnames(className, vm.isMoving && styles.moving)}
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          ...style,
        }}
        {...vm.eventHandlers}
      />
    );
  }
);

const getNull = () => 0;
const updateNull = () => {};
const getLeft = (rect: Rect) => rect.x;
const getRight = (rect: Rect) => rect.x + rect.width;
const getTop = (rect: Rect) => rect.y;
const getBottom = (rect: Rect) => rect.y + rect.height;

function updateLeft(
  { rect, maxWidth, minWidth }: ResizeHandlerProps,
  left: number
) {
  const newWidth = Math.min(
    maxWidth,
    Math.max(minWidth, rect.x + rect.width - left)
  );
  rect.x = rect.x + rect.width - newWidth;
  rect.width = newWidth;
}
function updateRight(
  { rect, maxWidth, minWidth }: ResizeHandlerProps,
  right: number
) {
  rect.width = Math.min(maxWidth, Math.max(minWidth, right - rect.x));
}
function updateTop(
  { rect, maxHeight, minHeight }: ResizeHandlerProps,
  top: number
) {
  const newHeight = Math.min(
    maxHeight,
    Math.max(minHeight, rect.y + rect.height - top)
  );
  rect.y = rect.y + rect.height - newHeight;
  rect.height = newHeight;
}
function updateBottom(
  { rect, maxHeight, minHeight }: ResizeHandlerProps,
  bottom: number
) {
  rect.height = Math.min(maxHeight, Math.max(minHeight, bottom - rect.y));
}

const createHandler = ({
  getX = getNull,
  getY = getNull,
  updateX = updateNull,
  updateY = updateNull,
  className,
}: {
  getX?: (rect: Rect) => number;
  getY?: (rect: Rect) => number;
  updateX?: (props: ResizeHandlerProps, x: number) => void;
  updateY?: (props: ResizeHandlerProps, y: number) => void;
  className: string;
}) => {
  const Handler: FC<ResizeHandlerProps> = (props) => {
    const { rect, onMoving, onMoveEnd } = props;
    const vm = useMemo(() => {
      return new MovableViewModel({
        handleStart: () => [getX(rect), getY(rect)],
        handleMove: (x, y) => {
          updateX(props, x), updateY(props, y);
          onMoving && onMoving();
        },
        handleEnd: () => {
          onMoveEnd && onMoveEnd();
        },
      });
    }, [rect, onMoving, onMoveEnd]);
    return <div className={className} {...vm.eventHandlers} />;
  };
  return Handler;
};

export const ResizingLeft = createHandler({
  getX: getLeft,
  updateX: updateLeft,
  className: styles.left,
});
export const ResizingRight = createHandler({
  getX: getRight,
  updateX: updateRight,
  className: styles.right,
});
export const ResizingTop = createHandler({
  getY: getTop,
  updateY: updateTop,
  className: styles.top,
});
export const ResizingBottom = createHandler({
  getY: getBottom,
  updateY: updateBottom,
  className: styles.bottom,
});
export const ResizingLeftTop = createHandler({
  getX: getLeft,
  updateX: updateLeft,
  getY: getTop,
  updateY: updateTop,
  className: styles.lt,
});
export const ResizingRightTop = createHandler({
  getX: getRight,
  updateX: updateRight,
  getY: getTop,
  updateY: updateTop,
  className: styles.rt,
});
export const ResizingLeftBottom = createHandler({
  getX: getLeft,
  updateX: updateLeft,
  getY: getBottom,
  updateY: updateBottom,
  className: styles.lb,
});
export const ResizingRightBottom = createHandler({
  getX: getRight,
  updateX: updateRight,
  getY: getBottom,
  updateY: updateBottom,
  className: styles.rb,
});
export const Resizable: FC<MovableProps> = ({
  rect,
  maxWidth = Infinity,
  minWidth = 0,
  maxHeight = Infinity,
  minHeight = 0,
  children,
  onMoving,
  onMoveEnd,
  ...others
}) => {
  if (!rect) {
    return null;
  }
  const handlerProps = {
    rect,
    maxWidth,
    minWidth,
    maxHeight,
    minHeight,
    children,
    onMoving,
    onMoveEnd,
  };
  return (
    <Movable {...others} {...handlerProps}>
      {children}
      <ResizingLeft {...handlerProps} />
      <ResizingTop {...handlerProps} />
      <ResizingRight {...handlerProps} />
      <ResizingBottom {...handlerProps} />
      <ResizingLeftTop {...handlerProps} />
      <ResizingLeftBottom {...handlerProps} />
      <ResizingRightTop {...handlerProps} />
      <ResizingRightBottom {...handlerProps} />
    </Movable>
  );
};
