import { render } from 'solid-js/web';
import { App } from './ui/App';
import './ui/base.css';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root element');

// /about/ comes with its view prerendered; the app renders its own.
root.replaceChildren();
render(() => <App />, root);
