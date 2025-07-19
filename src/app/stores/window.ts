import { writable, type Writable } from "svelte/store";
import FieldWindow from "../../features/windows/field/fieldWindow.svelte";
import SplashWindow from "../../features/windows/splash/splashWindow.svelte";
import PreferencesWindow from "../../features/windows/preferences/preferencesWindow.svelte";
import CanvasWindow from "../../features/windows/canvas/canvasWindow.svelte";

export enum WindowType {
	Field,
	Splash,
	Preferences,
	Canvas
}

const Windows: Map<WindowType, any> = new Map();
const _windowComponent: Writable<any> = writable(null);


export let currentWindow = writable(WindowType.Field);
export const windowComponent = {
	subscribe: _windowComponent.subscribe,
};
export let WindowFadeDuration = writable(300);

export async function initializeWindows(): Promise<void> {
	Windows.set(WindowType.Field, FieldWindow);
	Windows.set(WindowType.Splash, SplashWindow);
	Windows.set(WindowType.Preferences, PreferencesWindow);
	Windows.set(WindowType.Canvas, CanvasWindow);

}

currentWindow.subscribe(async (windowType: WindowType) => {
	if (Windows.has(windowType)) {
		_windowComponent.set(Windows.get(windowType));
	} else {
		_windowComponent.set(null);
	}
});
