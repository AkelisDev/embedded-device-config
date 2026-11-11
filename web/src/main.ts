import { createApp } from 'vue';
import App from './App.vue';
import { loadConfig } from './config';
import { connectLive } from './live';
import './style.css';

loadConfig();
connectLive();
createApp(App).mount('#app');
