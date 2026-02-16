import React from 'react'
import ReactDOM from 'react-dom/client'
import { Buffer } from 'buffer'
import './styles/neu.css'

const processShim = globalThis.process || {}
if (!processShim.env) processShim.env = {}
if (!processShim.version) processShim.version = 'v18.0.0'
if (!processShim.versions) processShim.versions = { node: '18.0.0' }
if (typeof processShim.nextTick !== 'function') {
    processShim.nextTick = (callback, ...args) => Promise.resolve().then(() => callback(...args))
}
if (typeof processShim.cwd !== 'function') processShim.cwd = () => '/'
processShim.browser = true
globalThis.process = processShim
if (!globalThis.Buffer) globalThis.Buffer = Buffer

if (!globalThis.global) globalThis.global = globalThis

import('./App.jsx').then(({ default: App }) => {
    ReactDOM.createRoot(document.getElementById('root')).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    )
})
