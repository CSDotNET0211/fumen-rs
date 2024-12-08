use strum_macros::{EnumIter, FromRepr};

#[derive(FromRepr, EnumIter, Copy, Clone, Debug, PartialEq)]
pub enum BlockType {
	Empty = 0,
	I = 1,
	L = 2,
	O = 3,
	Z = 4,
	T = 5,
	J = 6,
	S = 7,
	Gray = 8,
}


#[derive(FromRepr, Copy, Clone, Debug)]
pub enum Rotation {
	South = 0,
	East = 1,
	North = 2,
	West = 3,
}
