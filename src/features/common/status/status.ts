import { writable, type Writable } from "svelte/store";
import HistoryStatusPanel from "./components/history/statusPanel.svelte";
import OnlineStatusPanel from "./components/online/statusPanel.svelte";
import NotificationStatusPanel from "./components/notification/statusPanel.svelte";
import LoginStatusPanel from "./components/login/statusPanel.svelte";

import HistoryPopupPanel from "./components/history/popupPanel.svelte";
import OnlinePopupPanel from "./components/online/popupPanel.svelte";
import NotificationPopupPanel from "./components/notification/popupPanel.svelte";
import LoginPopupPanel from "./components/login/popupPanel.svelte";

export enum StatusPanelType {
	None,
	History,
	Online,
	Notifications,
	Login
}

export let currentOpenedStatus = writable<StatusPanelType>(StatusPanelType.None);
export let statusPanels = writable<any[] | null>(null);

const _statusPopupComponent: Writable<any> = writable(null);
export const statusPopupComponent = {
	subscribe: _statusPopupComponent.subscribe,
};
const StatusPopupPanels: Map<StatusPanelType, any> = new Map();

export function reloadStatusPanels(): void {
	StatusPopupPanels.set(StatusPanelType.History, HistoryPopupPanel);
	StatusPopupPanels.set(StatusPanelType.Online, OnlinePopupPanel);
	StatusPopupPanels.set(StatusPanelType.Notifications, NotificationPopupPanel);
	StatusPopupPanels.set(StatusPanelType.Login, LoginPopupPanel);

	statusPanels.set([HistoryStatusPanel, OnlineStatusPanel, LoginStatusPanel,]);

}

currentOpenedStatus.subscribe((statusType: StatusPanelType) => {
	if (statusType === StatusPanelType.None) {
		_statusPopupComponent.set(null);
	} else {
		_statusPopupComponent.set(StatusPopupPanels.get(statusType) || null);

	}
});