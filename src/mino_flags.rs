use crate::enums::{BlockType,  Rotation};
use crate::mino::Mino;
use crate::{HEIGHT,  WIDTH};
use crate::util::poll;

#[derive(Debug,Clone)]
pub struct MinoFlags {
	pub mino: Mino,
	pub raise: bool,
	pub mirror: bool,
	pub color: bool,
	pub comment: bool,
	pub lock: bool,

}

impl Default for MinoFlags {
	fn default() -> Self {
		Self {
			mino: Mino::default(),
			raise: false,
			mirror: false,
			color: false,
			comment: false,
			lock: false,
		}
	}
}

impl MinoFlags {
	pub fn decode(data: &str, offset: &mut usize) -> Self {
		let mut value = poll(&data[*offset..(*offset + 3)]);
		*offset += 3;

		let piece = BlockType::from_repr(value % 8).unwrap();
		value /= 8;
		let rotation = Rotation::from_repr(value % 4).unwrap();
		value /= 4;
		let position = value % (WIDTH * HEIGHT);
		value /= WIDTH * HEIGHT;
		let flag_raise = value % 2 == 1;
		value /= 2;
		let flag_mirror = value % 2 == 1;
		value /= 2;
		let flag_color = value % 2 == 1;
		value /= 2;
		let flag_comment = value % 2 == 1;
		value /= 2;
		let flag_lock = value % 2 == 0;

		Self {
			comment: flag_comment,
			mino: Mino::new(piece, rotation, position),
			raise: flag_raise,
			mirror: flag_mirror,
			color: flag_color,
			lock: flag_lock,
		}
	}
}