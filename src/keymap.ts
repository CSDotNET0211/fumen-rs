export class Keymap {
	Right: string | undefined;
	Left: string | undefined;
	RotateCW: string | undefined;
	RotateCCW: string | undefined;
	Rotate180: string | undefined;
	Hold: string | undefined;
	HardDrop: string | undefined;
	SoftDrop: string | undefined;

	constructor(
		right: string,
		left: string,
		rotatecw: string,
		rotateccw: string,
		rotate180: string,
		hold: string,
		harddrop: string,
		softdrop: string,
	) {
		this.HardDrop = harddrop;
		this.SoftDrop = softdrop;
		this.Left = left;
		this.Right = right;
		this.Rotate180 = rotate180;
		this.RotateCW = rotatecw;
		this.RotateCCW = rotateccw;
		this.Hold = hold;
	}

	static default(): Keymap {
		let obj = new Keymap(
			"ArrowRight",
			"ArrowLeft",
			"c",
			"x",
			"v",
			"z",
			"ArrowUp",
			"ArrowDown",
		);
		return obj;
	}
}