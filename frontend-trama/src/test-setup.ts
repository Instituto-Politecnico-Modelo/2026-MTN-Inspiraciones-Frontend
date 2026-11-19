import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

if (!HTMLDialogElement.prototype.showModal) {
	Object.defineProperties(HTMLDialogElement.prototype, {
		showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', '') } },
		close: { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open') } },
	})
}

afterEach(cleanup)
