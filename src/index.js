import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Main from './pages/Main';
import reportWebVitals from './reportWebVitals';
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import Settings from './pages/Settings';
import PluginSettings from './pages/PluginSettings';
import DanmmakuWin from './pages/DanmmakuWin';
import Injector from './pages/Injector';
import { WsRemote } from './lib/WsUtils';

const Buffer = require('buffer/').Buffer
window["Buffer"] = Buffer
window.WsRemote=WsRemote;
window.remote=new WsRemote(document.location.pathname)

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes> 
        <Route path="/" element={<Main />} />
        <Route path="settings" element={<Settings/>} />
        <Route path="pluginSettings" element={<PluginSettings/>} />
        <Route path="danmmakuWin" element={<DanmmakuWin/>}/>
        <Route path="inject" element={<Injector/>}/>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
