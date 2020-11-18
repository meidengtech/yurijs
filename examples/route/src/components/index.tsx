export * from '@yurijs/html/dist/es/html';
import * as React from 'react';

export { ObserverItem } from './ObserverItem';
export { Resizable } from './resizable';
export { Link } from 'react-router-dom';

export const Input: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & {
    onValueChange?: (v: string) => void;
  }
> = ({ onValueChange, ...others }) => {
  const handleChange = React.useCallback(
    (ev) => {
      onValueChange && onValueChange(ev.target.value);
    },
    [onValueChange]
  );
  return <input {...others} onChange={handleChange} />;
};
