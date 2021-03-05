import { observer } from 'mobx-react-lite';
import {
  cloneElement,
  ReactElement,
  Children,
  useMemo,
  CSSProperties,
  SyntheticEvent
} from 'react';
import classnames from 'classnames';
import * as React from 'react';
import { observable, action } from 'mobx';
import { ClassValue } from 'classnames/types';

type TEvent = SyntheticEvent & KeyboardEvent;

type TEventProp = {
  handler: (e: TEvent) => void,
  modifiers: { [key: string]: boolean }
}

const keyCodes: { [key: string]: number | Array<number> } = {
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  up: 38,
  left: 37,
  right: 39,
  down: 40,
  'delete': [8, 46],
};

const isMatchedKey = <T extends keyof typeof keyCodes>(code: number, key: T) => {
  if (Array.isArray(keyCodes[key])) {
    const codes = keyCodes[key] as number[];
    return codes.some((c: number) => c === code);
  }
  return code === keyCodes[key];
};

export const handleWithModifiers = function(props: TEventProp[]) {
  return action(function($event: TEvent) {
    props.forEach(function(prop: TEventProp) {
      const keys = Object.keys(prop.modifiers);

      // 没有 modifiers，正常执行
      if (keys.length === 0) {
        prop.handler($event);
        return;
      }

      if ('self' in prop.modifiers && $event.target !== $event.currentTarget) {
        return;
      }

      if ('stop' in prop.modifiers) {
        $event.stopPropagation();
      }

      if ('prevent' in prop.modifiers) {
        $event.preventDefault();
      }

      // 假如是点击事件
      if ('button' in $event) {
        prop.handler($event);
        return;
      }

      // 假如是键盘事件且匹配到目标 key
      keys.some((key) => {
        const isMatched = isMatchedKey($event.keyCode, key);
        isMatched && (prop.handler($event));
        return isMatched;
      })
    });
  });
};


/**
 * 文本中的 {{ }} 内嵌表达式
 */
export const TextBlockBinding = observer(
  ({ children }: { children: () => ReactElement }) => {
    const ret = children();
    if (ret === undefined) {
      return null;
    }
    return ret;
  },
);

export function mergeStyle(
  target: CSSProperties,
  styles: CSSProperties | Array<CSSProperties>,
): CSSProperties {
  if (Array.isArray(styles)) {
    for (const item of styles) {
      mergeStyle(target, item);
    }
    return target;
  }
  if (styles && typeof styles === 'object') {
    Object.assign(target, styles);
  }
  return target;
}

/**
 * 绑定属性，这里假设others的数量及字段名、表达式都是固定的。
 */
export const PropertyBinding = observer(
  ({
    children,
    ...others
  }: {
    children: React.ReactElement;
    [key: string]: unknown | (() => unknown);
  }) => {
    const child = Children.only(children);
    const additionProps: Record<string, unknown> = {};
    for (const key of Object.keys(others)) {
      // TODO: 这里是否应当使用computed优化？
      let val = others[key];
      if (typeof val === 'function') {
        val = val();
      }
      if (key === 'style') {
        additionProps[key] = mergeStyle({}, [child.props.style, val]);
      } else if (key === 'className') {
        additionProps[key] = classnames(
          val as ClassValue,
          child.props.className,
        );
      } else {
        additionProps[key] = val;
      }
    }
    return cloneElement(child, additionProps);
  },
);

export const CondBinding = observer(
  ({
    children,
    cond,
  }: {
    children: React.ReactElement;
    cond: () => number | undefined;
  }) => {
    let index = cond();
    const childArr = Children.toArray(children);
    if (index == null) {
      index = childArr.length;
    }
    return (Children.toArray(children)[index] as ReactElement) || null;
  },
);

const RepeatBindingItem = <T extends unknown>({
  children,
  data,
  index,
}: {
  children: (data: T, index: number) => React.ReactNode;
  data: T;
  index: number;
}) => {
  return useMemo(() => {
    return <>{children(data, index)}</>;
  }, [children, data, index]);
};

export const RepeatBinding = observer(
  <T extends unknown>({
    children,
    data,
    keyFunc,
  }: {
    children: (data: T, index: number) => React.ReactNode;
    data: () => T[];
    keyFunc: (data: T, index: number) => string | number;
  }) => {
    return (
      <>
        {data().map((v, i) => (
          <RepeatBindingItem
            data={v}
            index={i}
            key={keyFunc ? keyFunc(v, i) : i}
          >
            {children}
          </RepeatBindingItem>
        ))}
      </>
    );
  },
);

export function computeClassName(
  expr: ClassValue,
  styles?: { [key: string]: string },
): string {
  if (typeof expr !== 'string') {
    expr = classnames(expr);
  }
  if (styles) {
    expr = expr
      .split(/\s+/)
      .map((v) => styles[v])
      .filter((v) => v)
      .join(' ');
  }
  return expr;
}

export function useProps<T>(props: T): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const $props = useMemo(() => observable(props), []);
  Object.assign($props, props);
  return $props;
}

const $global = (function (this: Record<string, unknown> | void) {
  // Any env with no "strict" limited.
  if (this) {
    return this;
  }
  // browser, electron, etc..
  if (typeof window !== 'undefined') {
    return window;
  }
  // Node, react native, etc..
  if (typeof global !== 'undefined') {
    return global;
  }
  throw new Error('Unable to get global object');
})() as Record<string, unknown>;

export function useProxy<
  PropTypes extends Record<string, unknown>,
  ViewModel extends Record<string, unknown>
>(props: PropTypes, vm?: ViewModel): PropTypes & ViewModel {
  return useMemo(() => {
    return new Proxy(
      {},
      {
        get(target, key: string) {
          if (vm && key in vm) {
            const ret = vm[key];
            if (typeof ret === 'function') {
              return ret.bind(vm);
            }
            return ret;
          }
          if (props && key in props) {
            return props[key];
          }
          return $global[key];
        },
        set(target, key: string, value) {
          if (vm && key in vm) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (vm as any)[key] = value;
          } else {
            $global[key] = value;
          }
          return true;
        },
        deleteProperty() {
          throw new Error('Cannot delete property in template.');
        },
      },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, [props, vm]) as any;
}

interface ViewModel {
  mounted?: () => void;
  beforeUnmount?: () => void;
}

interface ViewModelFactory<PropTypes> {
  new (props: PropTypes): ViewModel;
}

export function useViewModel<PropTypes>(
  ViewModel: ViewModelFactory<PropTypes>,
  $props: PropTypes,
): ViewModel {
  const vm = useMemo(() => {
    return new ViewModel($props);
  }, [ViewModel, $props]);
  React.useLayoutEffect(() => {
    if (typeof vm.mounted === 'function') {
      vm.mounted();
    }
    return () => {
      if (typeof vm.beforeUnmount === 'function') {
        vm.beforeUnmount();
      }
    };
  }, [vm]);
  return vm;
}
