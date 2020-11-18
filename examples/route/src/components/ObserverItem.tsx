import * as React from 'react';
import classnames from 'classnames';
import styles from './ObserverItem.less';

interface ObserverItemProps extends React.HTMLAttributes<HTMLDivElement> {
  onIntersect: () => void;
}

export const ObserverItem: React.FC<ObserverItemProps> = ({
  onIntersect,
  className,
  ...others
}) => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        let intersect = false;
        for (const item of entries) {
          if (item.isIntersecting) {
            intersect = true;
          }
        }
        if (intersect) {
          onIntersect && onIntersect();
        }
      },
      {
        threshold: 0.5,
      },
    );
    observer.observe(ref.current as HTMLDivElement);
    return () => {
      observer.disconnect();
    };
  }, [onIntersect]);

  return (
    <div
      {...others}
      ref={ref}
      className={classnames(className, styles.observer)}
    ></div>
  );
};
