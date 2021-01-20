module.exports = function loader() {
  const resourcePath = this.resourcePath;

  const templateLoaderOptions = {
    defaultNS: '@yurijs/html',
    styleExtension: '.less',
    cssModules: true,
  };

  const templateLoader = `-!@yurijs/template-loader?${JSON.stringify(templateLoaderOptions)}!${resourcePath}`;

  if (!this.hot) {
    return `
    import Component from ${JSON.stringify(templateLoader)};
    export default Component;
    `;
  }
  return `
  import { observable, action } from 'mobx';
  import { observer } from 'mobx-react-lite';
  import { createElement } from 'react';
  import RawComponent from ${JSON.stringify(templateLoader)};

  var component = observable.box(RawComponent);

  export default observer(function HMRComponent(props) {
    var Comp = component.get();
    return Comp(props);
  })

  if (module.hot) {
    module.hot.accept(${JSON.stringify(templateLoader)}, action(() => {
      component.set(RawComponent)
    }))
  }

  `;
};
