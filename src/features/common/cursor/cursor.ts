export class Cursor {
	username: string;
	x: number;
	y: number;
	color: string;
	place: string;

	constructor(username: string, x: number, y: number, color: string, place: string) {
		this.username = username;
		this.x = x;
		this.y = y;
		this.color = color;
		this.place = place;
	}
}
