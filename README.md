# Mobx + PureMVVM + YuriJS

## Why Mobx

See: [Introduce Mobx](https://mobx.js.org/README.html)

- Core conception is simple
- Powerful MVVM pattern
- Reusable MVVM methods/classes
- Extremly fast: Component-level leaf update

## Reusable MVVM methods/classes

It's important to reuse some common MVVM pattern.

There's many common patterns in [mobx-utils](https://github.com/mobxjs/mobx-utils).

You can write even more common patterns and reuse them, like:

- Write a pattern to implement a general paging query pattern. see [examples](https://github.com/meidengtech/yurijs/tree/master/examples/route/src/pages/page-list)
- Write a pattern to implement a target that can moved by mouse/touch starts with onMouseDown/onTouchDown event. see [examples](https://github.com/meidengtech/yurijs/tree/master/examples/route/src/pages/dnd)
- Write a pattern to support undo/redo
- Write a pattern to implement a general OT-based cooperation for any JSON object with [json-ot](https://github.com/ottypes/json1)

## PureMVVM (by @tdzl2003)

- _Pure Model_ is just _Plain Observable Object_
  - i.e. `observable(jsonObject)`
- _Pure View_ is any view that:
  - with no state
  - with no action
- _Pure ViewModel_ is viewmodel that:
  - for just one view

But why?

Because:

- _Pure Model_ make it easier to serialize/deserialize any data, and even more:
  - save history states
  - use IDL to share model definition with backend/microservices without any hand-written model code
  - cooperate it with json-ot
- _Pure View_ make it possible to use a template, which makes view code:
  - simpler, cleaner
  - less bug
- _Pure ViewModel_ makes your code:
  - easier to orgnanize

But it may leads to a very very big ViewModel?

Maybe, because ViewModel contains all "logic code", but you can:

- Use global store for shared states
- Use common MVVM pattern to reduce many many code
- Split big `page` into `widgets`, each has own view & viewModel
- Use `#region`/subclasses to split code, but only one root ViewModel for one View.

## YuriJS

> Yuri Gagarin: First man of Space

YuriJS = Vue Template + Mobx + React

YuriJS provides a loader that compiles vue template into react component, and use a Mobx ViewModel for data-binding.

index.template

```html
<div class="root">
  Hello, @yurijs!
  <div>
    <button @click="++counter">+</button>
    {{counter}}
    <button @click="--counter">-</button>
  </div>
</div>
```

index.vm.ts

```javascript
import { makeObservable, observable } from 'mobx';

export default class CounterViewModel {
  constructor() {
    makeObservable(this);
  }

  @observable
  counter = 0;
}
```

index.css

```less
.root {
  display: flex;
  flex-direction: column;
}
```

### Why YuriJS

- vue-compatible template
- react compatible, component friendly
  - compatible with antd or any other react component package
- observable props, element-level leaf update
  - You can write a real _big_ template with good performance for updating
- less code: no `useCallback`/`useMemo` needed more.
- hot reload while keeping state
- small, simple, easy, replacable
  - It's just react with vue template, you can replace it with raw react component any time

We even will provide a vue-template to miniapp/ReactNative compiler to run yurijs application on different platform in future.

### Usage with webpack:

Install dependencies:

```bash
npm install --save-dev \
    @yuri/template-loader \
    @yuri/hmr-template-loader
npm install --save \
    @yuri/runtime \
    @yuri/html \
    classnames mobx mobx-react-lite
# or with yarn:
yarn add --dev \
    @yuri/template-loader \
    @yuri/hmr-template-loader
yarn add \
    @yuri/runtime \
    @yuri/html \
    classnames mobx mobx-react-lite
# Omit @yuri/html if you like to use own component collection.
```

Add webpack rule in module/rules:

```js
  module.exports = {
    module: {
      rules: [
        // Add following lines:
        {
          test: /\.template$/,
          use: (__DEV__
            ? [
                {
                  loader: '@yurijs/hmr-template-loader',
                },
              ]
            : []
          ).concat([
            {
              loader: '@yurijs/template-loader',
              options: {
                cssModules: true,
              },
            },
          ]),
        },
        ...
      ]
    }
  }
```

Options:

- cssModules(boolean, default=false): use css module for class names
- styleExtension(string, default=.css): configure style sheet extension(.less/.scss)
- defaultNS(string, default=@yurijs/html): configure default component modules

### Usage with rollup:

Not implemented yet.

### Import extra components

Write a directive tag in template file:

```html
<!-- import as a namespace -->
<import module="antd" />
<antd:Button>Click Me</antd:Button>

<!-- import as a namespace with another name -->
<import module="antd" as="extra" />
<extra:Button>Click Me</extra:Button>

<!-- import components -->
<import module="antd" name="Button,Input" />
<button>Click Me</button>

<import module="../components" name="Button" />
<button>Click Me</button>
```

### Use with typescript

You can write a '.d.ts' to provide type support for user

```typescript
import { ComponentType } from 'react';

export interface HomeProps {}

declare const Home: ComponentType<HomeProps>;

export default Home;
```

### Highlight in VSCode

- Install official vue extension: [vetur](https://marketplace.visualstudio.com/items?itemName=octref.vetur)
- Open a file with .template extension
- CtrlOrCmd+Shift+P -> Change Language Mode -> Configure file association for '.template' -> Vue-html

### How to run examples

```bash
# install dependencies
yarn

# build runtime & html
yarn build

# run example with webpack
cd examples/simple
yarn start

```

### Currently limitation

- Component compatibility
  - Different v-model onXXXChange not supported(input/checkbox)
  - Logic with children(Tab/Select in some library)
  - Renderer props(Table/VirtualizedList in some library)
  - Not support import any default exports
  - Not support export with name
- Vue-HTML features
  - Event modifier
  - Falsy value behavior
  - Different import grammar
- Dev Experience:
  - HMR broken after life-cycle errors
  - Missing formatter
  - Missing auto complete
