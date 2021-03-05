/* eslint-disable complexity */
const htmlparser2 = require('htmlparser2');
const babelParser = require('@babel/parser');
const camelCase = require('camelcase');
const { visit, namedTypes: n, builders: b } = require('ast-types');
const eventNameMap = require('./event-name-map');

const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g;
const identifierRE = /^[A-Za-z_]\w+$/;
const forAliasRE = /([^]*?)\s+(?:in|of)\s+([^]*)/;
const shortNS = {
  ':': 'v-bind',
  '@': 'v-on',
};

const modifierSymbol = '.';

function normalizeComponentName(name) {
  return name
    .split('.')
    .map((v) =>
      v
        .split('-')
        .map((v) => `${v[0].toUpperCase()}${v.substr(1)}`)
        .join('')
    )
    .join('.');
}

function parseType(name, namespaces, alias) {
  const id = name.indexOf(':');
  if (id === -1) {
    if (alias[name]) {
      return alias[name];
    }
    name = normalizeComponentName(name);
    if (alias[name]) {
      return alias[name];
    }
    return [namespaces.default, name];
  }
  const nspart = name.substr(0, id);
  const ns = namespaces[nspart];
  if (!ns) {
    throw new Error(`namespace \`${nspart}\` not found for: \`${name}\``);
  }
  return [ns, name.substr(id + 1)];
}

function parseModifiers(name) {
  const ret = {};
  const modifiersArr =
    name.indexOf(modifierSymbol) >= 0
      ? name.split(modifierSymbol).slice(1)
      : [];
  modifiersArr.length > 0 && modifiersArr.forEach((m) => (ret[m] = true));
  return ret;
}

function parsePropName(name, namespaces) {
  const split = name.split(modifierSymbol);
  if (shortNS[name[0]]) {
    return [shortNS[name[0]], split[0].substr(1), parseModifiers(name)];
  }
  const id = name.indexOf(':');
  if (id === -1) {
    return ['', name];
  }
  const nspart = name.substr(0, id);
  const ns = namespaces[nspart];
  if (!ns) {
    throw new Error(`namespace \`${nspart}\` not found for: \`${name}\``);
  }

  return [ns, split[0].substr(id + 1), parseModifiers(name)];
}

function parseEventHandler(value, variables) {
  value = value.trim();
  if (identifierRE.test(value)) {
    // method name
    return b.functionExpression(
      null,
      [],
      b.blockStatement([
        b.expressionStatement(
          b.callExpression(
            b.memberExpression(
              b.memberExpression(b.identifier('$proxy'), b.identifier(value)),
              b.identifier('apply')
            ),
            [b.identifier('$proxy'), b.identifier('arguments')]
          )
        ),
      ])
    );
  }
  const ast = parseExpression(value, variables);
  return b.functionExpression(
    null,
    [b.identifier('$event')],
    b.blockStatement([b.expressionStatement(ast)])
  );
}

function parseFor(value, variables) {
  const m = value.match(forAliasRE);
  if (!m) {
    throw new Error(`Bad for directive ${value}`);
  }
  return [
    m[1]
      .trim()
      .replace(/^\(|\)$/g, '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => !!v),
    parseExpression(m[2], variables),
  ];
}

function parseAttribs(el, attribs, namespaces) {
  // 提前处理v-if & v-for，确保变量有效区域正确。
  if (attribs['v-if'] != null) {
    el.cond = ['if', parseExpression(attribs['v-if'], el.variables)];
  } else if (attribs['v-else-if'] != null) {
    el.cond = ['else-if', parseExpression(attribs['v-else-if'], el.variables)];
  } else if (attribs['v-else'] != null) {
    el.cond = ['else'];
  }

  if (attribs['v-for']) {
    el.repeat = parseFor(attribs['v-for'], el.variables);
    el.variables = { ...el.variables };
    for (const item of el.repeat[0]) {
      el.variables[item] = true;
    }
  }

  for (const [key, value] of Object.entries(attribs)) {
    const [ns, name, modifiers] = parsePropName(key, namespaces);

    switch (ns) {
      case '': {
        switch (name) {
          case 'v-if':
          case 'v-else-if':
          case 'v-else':
          case 'v-for': {
            break;
          }
          case 'v-model': {
            el.model = parseExpression(value, el.variables);
            break;
          }
          case 'ref': {
            el.ref = parseExpression(value, el.variables);
            break;
          }
          default: {
            el.props[camelCase(name)] = value === '' ? true : value;
            break;
          }
        }
        break;
      }
      case 'v-bind': {
        el.bindings = el.bindings || {};
        el.bindings[camelCase(name)] = parseExpression(value, el.variables);
        break;
      }
      case 'v-on': {
        const propName = eventNameMap[name];
        el.handlers.push({
          event: propName,
          handler: parseEventHandler(`${value}`, {
            ...el.variables,
            $event: true,
          }),
          modifiers,
        });
        break;
      }
      default: {
        break;
      }
    }
  }
}

function parseExpression(exp, variables) {
  let ast = babelParser.parseExpression(exp);
  ast = visit(ast, {
    visitIdentifier(path) {
      this.traverse(path);
      const self = path.value;
      const parent = path.parentPath.value;

      if (n.Property.check(parent) || n.ObjectProperty.check(parent)) {
        if (self === parent.key) {
          return;
        }
      }
      if (n.MemberExpression.check(parent)) {
        if (self === parent.property) {
          return;
        }
      }
      if (n.FunctionDeclaration.check(parent)) {
        if (self === parent.id) {
          return;
        }
      }
      if (variables[self.name]) {
        return;
      }
      path.replace(b.memberExpression(b.identifier('$proxy'), self));
    },
  });

  return ast;
}

function parseText(text, variables) {
  text = text.trim();
  if (!text) {
    return [];
  }
  const pieces = [];
  let idx = 0;
  text.replace(defaultTagRE, (match, exp, nextIdx) => {
    if (nextIdx > idx) {
      pieces.push({
        kind: 'text',
        text: text.substring(idx, nextIdx),
      });
    }
    pieces.push({
      kind: 'expression',
      ast: parseExpression(exp, variables),
    });
    idx = nextIdx + match.length;
  });
  if (idx < text.length) {
    pieces.push({
      kind: 'text',
      text: text.substr(idx),
    });
  }
  return pieces;
}

function parseHtml(text, options, paths) {
  const root = {
    kind: 'component',
    tagName: '#document',
    viewModel: paths.viewModel,
    styleSheet: null,
    children: [],
    variables: {
      $props: true,
      $vm: true,
      $proxy: true,
    },
  };
  const stack = [root];

  const namespaces = {
    default: options.defaultNS || '@yurijs/html',
    'v-bind': 'v-bind',
    'v-on': 'v-on',
  };
  const alias = {
    import: ['@yurijs/directive', 'import'],
    'view-model': ['@yurijs/directive', 'view-model'],
  };

  let texts = [];

  function handleText() {
    if (texts.length <= 0) {
      return;
    }
    const top = stack[stack.length - 1];
    const pieces = parseText(texts.join(''), top.variables);
    if (pieces.length > 0 && !top.children) {
      throw new Error(`${top.kind} tag cannot have any children.`);
    }
    for (const item of pieces) {
      stack[stack.length - 1].children.push(item);
    }
    texts.splice(0);
  }

  const parser = new htmlparser2.Parser(
    {
      onopentag(name, attribs) {
        handleText();
        const type = parseType(name, namespaces, alias);
        if (type[0] === '@yurijs/directive') {
          if (type[1] === 'import') {
            if (!attribs.module) {
              throw new Error(`Bad import directive, ${attribs}`);
            }
            if (attribs.name) {
              for (const name of attribs.name.split(',')) {
                const as = attribs.as || name;
                alias[normalizeComponentName(as)] = [attribs.module, name];
              }
            } else {
              const alias = attribs.alias || attribs.module;
              namespaces[alias] = attribs.module;
            }
          } else if (type[1] === 'view-model') {
            if (attribs.disable != null) {
              root.viewModel = null;
            } else {
              if (!attribs.module) {
                throw new Error(`Bad view-model directive, ${attribs}`);
              }
              root.viewModel = attribs.module;
            }
          }
          // push stack for future pop.
          stack.push({
            kind: 'directive',
            tagName: name,
          });
          return;
        }
        const top = stack[stack.length - 1];
        if (!top.children) {
          throw new Error(`${top.kind} tag cannot have any children.`);
        }

        const el = {
          kind: 'element',
          tagName: name,
          type,
          props: {},
          handlers: [],
          model: null,
          bindings: null,
          cond: null,
          repeat: null,
          ref: null,
          children: [],
          variables: top.variables,
        };
        parseAttribs(el, attribs, namespaces, root.props);
        if (el.props.class || (el.bindings && el.bindings.class)) {
          root.styleSheet = paths.styleSheet;
        }
        top.children.push(el);
        stack.push(el);
      },
      ontext(text) {
        texts.push(text);
      },
      onclosetag() {
        handleText();
        stack.pop();
      },
    },
    {
      xmlMode: true,
      decodeEntities: true,
      recognizeSelfClosing: true,
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
    }
  );
  parser.write(text);
  parser.end();
  return root;
}
exports.parseHtml = parseHtml;
