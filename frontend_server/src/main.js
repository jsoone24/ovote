import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { createPinia } from 'pinia';
import { useAuthStore } from './stores/auth-store.js';
import axios from 'axios';
const dotenv = require('dotenv');
dotenv.config();

axios.defaults.baseURL = process.env.BACKEND_SERVER_URL; // Use your API domain
axios.interceptors.request.use(function (config) {
    config.withCredentials = true;
    config.headers['X-XSRF-TOKEN'] = getCookie('XSRF-TOKEN'); // Function to read cookies
    return config;
});
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Vuetify
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

const vuetify = createVuetify({
    components,
    directives,
    icons: {
        defaultSet: 'mdi',
    },
});

const app = createApp(App);
const pinia = createPinia();
app.use(router);
app.use(pinia);
app.use(vuetify);

const authStore = useAuthStore();
authStore.tryAutoLogin();

app.mount('#app');
