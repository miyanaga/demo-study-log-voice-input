import { createApp } from 'vue'
import App from './App.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [{ name: 'Main', path: '/', component: () => import('./views/Main.vue') }],
})

createApp(App).use(router).mount('#app')
