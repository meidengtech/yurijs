import * as React from 'react';
import * as ReactDOM from 'react-dom';
import styles from './index.less';
import Home from './home';

function App() {
  return <Home />;
}

const root = document.createElement('div');
root.className = styles.root;
document.body.appendChild(root);
ReactDOM.render(<App />, root);
