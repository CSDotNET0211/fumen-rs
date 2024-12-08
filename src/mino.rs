use crate::enums::{BlockType, Rotation};

#[derive(Debug,Clone)]
pub struct Mino {
	pub kind: BlockType,
	pub rotation: Rotation,
	pub position: usize,
}

impl Mino {
	pub fn new(kind: BlockType, rotation: Rotation, position: usize) -> Self {
		Self {
			kind,
			rotation,
			position,
		}
	}
}

impl Default for Mino {
	fn default() -> Self {
		Self {
			kind: BlockType::Empty,
			rotation: Rotation::North,
			position: 0,
		}
	}
}