/* eslint-disable complexity */
const { print } = require('recast');
const { builders: b } = require('ast-types');
const styleToObject = require('style-to-object');
const eventNameMap = require('./event-name-map');

const runtimeModule = '@yurijs/runtime';
exports.runtimeModule = runtimeModule;

function renderImports(map) {
  const lines = [];
  for (const [ns, names] of Object.entries(map)) {
    const alias = [];
    for (const [name, id] of Object.entries(names)) {
      alias.push(`${name} as _${id}, `);
    }
    lines.push(`import { ${alias.join('')}} from ${JSON.stringify(ns)};\n`);
  }
  return lines.join('');
}

function combineHandlers(handlers) {
  const ret = {};
  for (let i = 0; i < handlers.length; i++) {
    const current = handlers[i];
    // 处理右键事件
    if (current.event === eventNameMap.click && 'right' in current.modifiers) {
      current.event = eventNameMap.contextmenu;
    }

    const { handler, modifiers, event } = current;
    const props = { handler, modifiers };

    (ret[event] || (ret[event] = [])).push(props);
  }
  return ret;
}

function renderNode(node) {
  if (node.kind === 'text') {
    return b.stringLiteral(node.text);
  }
  if (node.kind === 'expression') {
    return node.ast;
  }
  if (node.kind === 'elementIterator') {
    return b.functionExpression(
      null,
      node.names.map((v) => b.identifier(v)),
      b.blockStatement([b.returnStatement(renderNode(node.element))])
    );
  }
  if (node.kind === 'condition') {
    return b.callExpression(b.identifier('createElement'), [
      b.identifier(node.type),
      b.objectExpression([
        b.objectProperty(
          b.literal('cond'),
          b.functionExpression(
            null,
            [],
            b.blockStatement([
              ...node.conds.map((v, i) =>
                b.ifStatement(v, b.returnStatement(b.literal(i)))
              ),
              ...(node.hasElse
                ? [b.returnStatement(b.literal(node.conds.length))]
                : []),
            ])
          )
        ),
      ]),
      ...node.children.map(renderNode),
    ]);
  }
  const { type, props, handlers, children } = node;
  return b.callExpression(b.identifier('createElement'), [
    b.identifier(type),
    b.objectExpression([
      ...Object.entries(props).map(([k, v]) =>
        b.objectProperty(b.literal(k), v)
      ),
      ...Object.entries(handlers).map(([k, v]) =>
        b.objectProperty(
          b.literal(k),
          b.callExpression(b.identifier('handleWithModifiers'), [
            b.arrayExpression([
              ...v.map((p) => {
                return b.objectExpression([
                  b.objectProperty(b.literal('handler'), p.handler),
                  b.objectProperty(
                    b.literal('modifiers'),
                    b.arrayExpression([
                      ...Object.entries(p.modifiers).map(([mk, mv]) =>
                        b.literal(mk)
                      ),
                    ])
                  ),
                ]);
              }),
            ]),
          ])
        )
      ),
    ]),
    ...children.map(renderNode),
  ]);
}

function renderEntryNodes(nodes) {
  const asts = nodes.map(renderNode);
  if (asts.length === 0) {
    return 'null';
  }
  if (asts.length === 1) {
    return print(asts[0]).code;
  }
  return print(
    b.callExpression(b.identifier('createElement'), [
      b.identifier('Fragment'),
      b.objectExpression([]),
      ...asts,
    ])
  ).code;
}

function expressionToGetterFunction(ast) {
  return b.functionExpression(
    null,
    [],
    b.blockStatement([b.returnStatement(ast)])
  );
}

function jsonToObjectAst(obj) {
  if (
    typeof obj === 'string' ||
    typeof obj === 'number' ||
    typeof obj === 'boolean' ||
    obj == null
  ) {
    return b.literal(obj);
  }

  if (Array.isArray(obj)) {
    return b.arrayExpression(obj.map(jsonToObjectAst));
  }
  if (typeof obj === 'object') {
    return b.objectExpression(
      Object.entries(obj).map(([k, v]) =>
        b.objectProperty(b.literal(k), jsonToObjectAst(v))
      )
    );
  }
  throw new Error('jsonToObjectAst with bad argument ' + obj);
}

function render(ast, options) {
  const importMap = {};

  let importId = 0;

  function addRequirement(ns, name) {
    if (importMap[ns] == null) {
      importMap[ns] = Object.create(null);
    }
    if (importMap[ns][name] == null) {
      const id = importId++;
      importMap[ns][name] = id;
    }
    return `_${importMap[ns][name]}`;
  }

  // 处理children，并处理v-if
  function visitChildren(children) {
    const ret = [];
    let lastCondition = null;
    for (let child of children) {
      const transformed = visit(child);
      if (!child.cond) {
        lastCondition = null;
        ret.push(transformed);
        continue;
      }

      switch (child.cond[0]) {
        case 'if': {
          const type = addRequirement(runtimeModule, 'CondBinding');
          lastCondition = {
            kind: 'condition',
            type,
            conds: [child.cond[1]],
            hasElse: false,
            children: [transformed],
          };
          ret.push(lastCondition);
          break;
        }
        case 'else-if': {
          lastCondition.conds.push(child.cond[1]);
          lastCondition.children.push(transformed);
          break;
        }
        case 'else': {
          lastCondition.hasElse = true;
          lastCondition.children.push(transformed);
          lastCondition = null;
          break;
        }
        default: {
          throw new Error('Internal Error.');
        }
      }
    }
    return ret;
  }

  // 解析原始ast，完成部分翻译 并引入需要的组件。
  function visit(node) {
    if (node.kind === 'expression') {
      const type = addRequirement(runtimeModule, 'TextBlockBinding');
      return {
        type,
        props: {},
        handlers: {},
        children: [
          {
            kind: 'expression',
            ast: expressionToGetterFunction(node.ast),
          },
        ],
      };
    }
    if (node.kind !== 'element') {
      return node;
    }

    // element
    const [ns, name] = node.type;
    const dot = name.indexOf('.');
    const importName = dot >= 0 ? name.slice(0, dot) : name;
    const subName = dot >= 0 ? name.slice(dot) : '';
    const type = addRequirement(ns, importName) + subName;

    const props = {};
    for (const [key, value] of Object.entries(node.props)) {
      if (key === 'class') {
        if (options.cssModules) {
          const computeClassname = addRequirement(
            runtimeModule,
            'computeClassName'
          );
          props.className = b.callExpression(b.identifier(computeClassname), [
            b.literal(value),
            b.identifier('styles'),
          ]);
        } else {
          props.className = b.literal(value);
        }
      } else if (key === 'style') {
        const style = styleToObject(value);
        props.style = jsonToObjectAst(style);
      } else {
        props[key] = b.literal(value);
      }
    }
    let ret = {
      type,
      props,
      handlers: combineHandlers(node.handlers),
      children: visitChildren(node.children),
    };

    if (node.ref) {
      props.ref = node.ref;
    }
    if (node.model) {
      props.onValueChange = b.callExpression(b.identifier('action'), [
        b.functionExpression(
          null,
          [b.identifier('value')],
          b.blockStatement([
            b.expressionStatement(
              b.assignmentExpression('=', node.model, b.identifier('value'))
            ),
          ])
        ),
      ]);
    }

    if (node.bindings || node.model) {
      // 动态属性绑定
      const type = addRequirement(runtimeModule, 'PropertyBinding');
      const props = {};
      if (node.bindings) {
        for (const [key, value] of Object.entries(node.bindings)) {
          if (key === 'class') {
            const computeClassname = addRequirement(
              runtimeModule,
              'computeClassName'
            );
            if (options.cssModules) {
              props.className = expressionToGetterFunction(
                b.callExpression(b.identifier(computeClassname), [
                  value,
                  b.identifier('styles'),
                ])
              );
            } else {
              props.className = expressionToGetterFunction(
                b.callExpression(b.identifier(computeClassname), [value])
              );
            }
          } else if (key === 'key' && node.repeat) {
            // repeat组件的key单独处理
          } else {
            props[key] = expressionToGetterFunction(value);
          }
        }
      }
      if (node.model) {
        props.value = expressionToGetterFunction(node.model);
      }
      ret = {
        kind: 'element',
        type,
        props,
        handlers: {},
        children: [ret],
      };
    }

    if (node.repeat) {
      // List rendering
      const type = addRequirement(runtimeModule, 'RepeatBinding');
      const props = {
        data: expressionToGetterFunction(node.repeat[1]),
      };
      if (node.bindings && node.bindings.key) {
        props.keyFunc = b.functionExpression(
          null,
          node.repeat[0].map((v) => b.identifier(v)),
          b.blockStatement([b.returnStatement(node.bindings.key)])
        );
      }
      ret = {
        kind: 'element',
        type,
        props,
        handlers: {},
        children: [
          {
            kind: 'elementIterator',
            names: node.repeat[0],
            element: ret,
          },
        ],
      };
    }
    return ret;
  }
  const nodes = visitChildren(ast.children);

  return [renderImports(importMap), renderEntryNodes(nodes)];
}
exports.render = render;
