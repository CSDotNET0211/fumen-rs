import { writable } from "svelte/store";
import { History } from "../../history";

export const history = writable<History>(new History());