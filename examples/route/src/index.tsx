import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Router, Route, Switch } from 'react-router';
import styles from './index.less';
import { history } from './libs/history';
import {
  Counter,
  Dnd,
  FormPage,
  FromPromise,
  Home,
  LifeCycle,
  PageListPage,
} from './pages';

function App() {
  return (
    <Router history={history}>
      <Switch>
        <Route path="/" exact>
          <Home />
        </Route>
        <Route path="/counter" exact>
          <Counter />
        </Route>
        <Route path="/life-cycle" exact>
          <LifeCycle />
        </Route>
        <Route path="/from-promise" exact>
          <FromPromise />
        </Route>
        <Route path="/form" exact>
          <FormPage />
        </Route>
        <Route path="/page-list" exact>
          <PageListPage />
        </Route>
        <Route path="/dnd" exact>
          <Dnd />
        </Route>
      </Switch>
    </Router>
  );
}

const root = document.createElement('div');
root.className = styles.root;
document.body.appendChild(root);
ReactDOM.render(<App />, root);
