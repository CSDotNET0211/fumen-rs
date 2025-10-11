interface UpdateStore<T> {
	subscribe: (callback: (value: T) => void) => void;
	set: (value: T) => void;
	setQuietly: (value: T) => void;
	update: (callback: (value: T) => T) => void;
	updateQuietly: (callback: (value: T) => T) => void;
	get: () => T;
}


export const createUpdateStore = <T>(initialValue: T): UpdateStore<T> => {
	let internalValue = initialValue;
	const subscribers: ((value: T) => void)[] = [];

	const notifySubscribers = () => {
		subscribers.forEach(callback => callback(internalValue));
	};

	return {
		subscribe: (callback) => {
			subscribers.push(callback);
			callback(internalValue);

			// Return unsubscribe function
			return () => {
				const index = subscribers.indexOf(callback);
				if (index > -1) {
					subscribers.splice(index, 1);
				}
			};
		},
		set: (value) => {
			internalValue = value;
			notifySubscribers();
		},
		setQuietly: (value) => {
			internalValue = value;
		},
		update: (callback) => {
			internalValue = callback(internalValue);
			notifySubscribers();
		},
		updateQuietly: (callback) => {
			internalValue = callback(internalValue);
		},
		get: () => {
			return internalValue;
		},
	};
};