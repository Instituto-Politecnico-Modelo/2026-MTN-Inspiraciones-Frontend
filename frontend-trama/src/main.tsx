import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { createAppRoutes } from './App'
import './styles/app.css'
import './styles/places.css'

const root = document.getElementById('root')
if (!root) throw new Error('No se encontro el contenedor de Trama.')

const router = createBrowserRouter(createAppRoutes())
createRoot(root).render(<StrictMode><RouterProvider router={router} /></StrictMode>)