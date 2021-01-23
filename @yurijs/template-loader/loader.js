const { getOptions } = require('loader-utils');
const { parseHtml } = require('./parser');
const { render, runtimeModule } = require('./render');

module.exports = function loader(source) {
  const options = getOptions(this);

  const ast = parseHtml(source, options, {
    source: this.resource,
    viewModel: this.resource.replace(/\..*$/, '.vm'),
    styleSheet: this.resource.replace(
      /\..*$/,
      options.styleExtension || '.css'
    ),
  });
  const [imports, jsx] = render(ast, options);

  const ret = `
import React, { createElement, Fragment, useMemo } from 'react';
import { action } from 'mobx';
import { useProps, useProxy, useViewModel } from ${JSON.stringify(
    runtimeModule
  )};
${
  ast.viewModel ? `import ViewModel from ${JSON.stringify(ast.viewModel)};` : ''
}
${
  // css modules
  ast.styleSheet && options.cssModules
    ? `import styles from ${JSON.stringify(ast.styleSheet)}`
    : ''
}
${
  // import style module only.
  ast.styleSheet && !options.cssModules
    ? `import ${JSON.stringify(ast.styleSheet)}`
    : ''
}

${imports}

export default function Template(_props) {
  const $props = useProps(_props);
  ${ast.viewModel ? `var $vm = useViewModel(ViewModel, $props)` : ''}
  var $proxy = useProxy($props, ${ast.viewModel ? `$vm, ` : ''});
  return useMemo(function() {
    return ${jsx};
  }, ${this.hot ? `[Template, $proxy]` : '[$proxy]'});
}
`;
  return ret;
};
