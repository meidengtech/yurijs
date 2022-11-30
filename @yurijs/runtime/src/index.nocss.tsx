import { observer } from 'mobx-react-lite';
import {
  cloneElement,
  ReactElement,
  Children,
  useMemo,
  SyntheticEvent,
} from 'react';
import * as React from 'react';
import { observable, action, runInAction } from 'mobx';

type EventProp = {
  handler: (...args: unknown[]) => void;
  modifiers: string[];
};

export const handleWithModifiers = function (props: EventProp[]) {
  return action(function ($event: SyntheticEvent, ...args: unknown[]) {
    for (const prop of props) {
      for (const key of prop.modifiers) {
        if (key === 'self') {
          if ($event.target !== $event.currentTarget) {
            break;
          }
        } else if (key === 'stop') {
          $event.stopPropagation();
        } else if (key === 'prevent') {
          $event.preventDefault();
        }
      }
      try {
        prop.handler($event, ...args);
      } catch (e) {
        if (e instanceof Error) {
          console.error(e.stack);
        } else {
          console.error(e);
        }
      }
    }
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
  }
);

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
      additionProps[key] = val;
    }
    return cloneElement(child, additionProps);
  }
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
  }
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
  }
);

export function useProps<T extends {}>(props: T): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const $props = useMemo(() => observable(props), []);
  React.useEffect(() => {
    runInAction(() => {
      Object.assign($props, props);
    });
  });
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
      }
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
  $props: PropTypes
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
