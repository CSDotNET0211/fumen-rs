import { writable, type Writable } from 'svelte/store';

interface InternalUpdateStore<T> {
	subscribe: Writable<T>['subscribe'];
	setValue: (value: T) => void;
	setQuietly: (value: T) => void;
	update: (callback: (value: T) => T) => void; // 👈 ここにupdateを追加
	updateQuietly: (callback: (value: T) => T) => void;
	getValue: () => T;
}

export function internalUpdateStore<T>(initialValue: T): InternalUpdateStore<T> {
	let internalValue = initialValue;
	const { subscribe, set, update } = writable(internalValue); // 👈 内部でupdateも受け取る

	return {
		subscribe,
		setValue: (value) => {
			internalValue = value;
			set(value);
		},
		setQuietly: (value) => {
			internalValue = value;
		},
		// ここで従来のupdateメソッドを公開
		update: (callback) => {
			internalValue = callback(internalValue);
			update(callback); // 内部のwritableストアのupdateを呼び出す
		},
		updateQuietly: (callback) => {
			internalValue = callback(internalValue);
		},
		getValue: () => internalValue,
	};
}
