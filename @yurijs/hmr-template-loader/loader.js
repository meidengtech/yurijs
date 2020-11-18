const { getRemainingRequest } = require('loader-utils');

module.exports = function loader() {
  const remaining = '-!' + getRemainingRequest(this);

  if (!this.hot) {
    return `
    import Component from ${JSON.stringify(remaining)};
    export default Component;
    `;
  }
  return `
  import { observable, action } from 'mobx';
  import { observer } from 'mobx-react-lite';
  import { createElement } from 'react';
  import RawComponent from ${JSON.stringify(remaining)};

  var component = observable.box(RawComponent);

  export default observer(function HMRComponent(props) {
    var Comp = component.get();
    return Comp(props);
  })

  if (module.hot) {
    module.hot.accept(${JSON.stringify(remaining)}, action(() => {
      component.set(RawComponent)
    }))
  }

  `;
};
