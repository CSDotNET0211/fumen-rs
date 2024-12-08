use crate::field::Field;
use crate::{DATA_TABLE, HEIGHT, WIDTH};
use crate::enums::{BlockType};

pub const PIECES: [[[i32; 2]; 4]; 8] = [
	//empty
	[[999, 999], [999, 999], [999, 999], [999, 999]],
	// Piece::I
	[[0, 0], [-1, 0], [1, 0], [2, 0]],
	// Piece::T
	[[0, 0], [-1, 0], [1, 0], [0, 1]],
	// Piece::O
	[[0, 0], [1, 0], [0, 1], [1, 1]],
	// Piece::L
	[[0, 0], [-1, 0], [1, 0], [1, 1]],
	// Piece::J
	[[0, 0], [-1, 0], [1, 0], [-1, 1]],
	// Piece::S
	[[0, 0], [-1, 0], [0, 1], [1, 1]],
	// Piece::Z
	[[0, 0], [1, 0], [0, 1], [-1, 1]],
];


pub fn get_prefix_data(raw_url: &str) -> (usize, String) {
	let at_index = raw_url.find('@').expect("'@' が見つかりません");
	let version = &raw_url[at_index - 3..at_index];
	(version.parse().expect("バージョンが数値じゃないんだけど"), raw_url[at_index + 1..].to_owned())
}

pub fn poll(data: &str) -> usize {
	let mut value = 0;
	let mut size = 1;
	for c in data.chars()
	{
		let data_num = DATA_TABLE[&c] as usize;
		value += data_num * size;
		size *= 64;
	}

	value
}

pub fn clear_lines(field: &mut Field) {
	let mut clear_pos = Vec::new();

	for y in 0..HEIGHT {
		let mut clear = true;
		for x in 0..WIDTH {
			if field.0[x + y * WIDTH] == BlockType::Empty {
				clear = false;
				break;
			}
		}
		if clear {
			clear_pos.push(y);
		}
	}

	for y in clear_pos {
		for yy in (1..=y).rev() {
			for x in 0..WIDTH {
				field.0[x + yy * WIDTH] = field.0[x + (yy - 1) * WIDTH];
			}
		}
		for x in 0..WIDTH {
			field.0[x] = BlockType::Empty;
		}
	}
}

pub fn check_valid_pos(field: &Field, mino_type: &BlockType, x: usize, y: usize) -> bool {
	if *mino_type == BlockType::Empty {
		return false;
	}

	for pos in get_mino_pos(mino_type, x, y) {
		if pos[0] < 0 || pos[0] >= WIDTH as i32 || pos[1] >= HEIGHT as i32 || pos[1] < 0 {
			return false;
		}

		if field.0[pos[0] as usize + pos[1] as usize * WIDTH] != BlockType::Empty {
			return false;
		}
	}

	true
}

pub fn get_mino_pos(mino_type: &BlockType, x: usize, y: usize) -> Vec<[i32; 2]> {
	let mut result_pos = Vec::new();

	if *mino_type == BlockType::Empty {
		return result_pos;
	}


	for pos in PIECES[*mino_type as usize] {
		let new_x = x as i32 + pos[0];
		let new_y = y as i32 + pos[1];

		result_pos.push([new_x, new_y]);
	}

	result_pos
}

pub fn place_mino(field: &mut Field, mino_type: &BlockType, x: usize, y: usize) {
	for pos in get_mino_pos(mino_type, x, y) {
		field.0[pos[0] as usize + pos[1] as usize * WIDTH] = *mino_type;
	}
}

pub fn raise_field(field: &mut Field) {
	for y in (1..HEIGHT).rev() {
		for x in 0..WIDTH {
			field.0[x + y * WIDTH] = field.0[x + (y - 1) * WIDTH];
		}
	}

	for x in 0..WIDTH {
		field.0[x] = BlockType::Empty;
	}
}

pub fn mirror_field(field: &mut Field) {
	for y in 0..HEIGHT {
		for x in 0..WIDTH / 2 {
			let temp = field.0[x + y * WIDTH];
			field.0[x + y * WIDTH] = field.0[WIDTH - 1 - x + y * WIDTH];
			field.0[WIDTH - 1 - x + y * WIDTH] = temp;
		}
	}
}


pub fn escape(input: &str) -> String {
	input
		.chars()
		.map(|c| {
			if c.is_ascii_alphanumeric() || "@*_+-./".contains(c) {
				c.to_string()
			} else if c as u32 <= 0xFF {
				format!("%{:02X}", c as u32)
			} else {
				format!("%u{:04X}", c as u32)
			}
		})
		.collect()
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn poll_test() {
		let result = poll("abc");
		assert_eq!(result, 26 + 27 * 64 + 28 * 4096);
	}

	#[test]
	fn poll_test2() {
		let result = poll("//");
		assert_eq!(result, 4095);
	}


	#[test]
	fn version_test() {
		let data = get_prefix_data("v115@cfB8HeC8GeA8IeA8IeA8IeA8IeA8IeA8AeB8GeC8Ge?C8IeA8IeA8geAgHtfA8IeA8IeA8IeA8JeA8JeA8JeA8WeC8?neAAAofAAQeAAFeAALeAASeAAAeAAGeAAAeAAIeAA1eAAAt?fAAIeAA2fAAA7eB8BeA8EeA8AeA8AeC8CeA8AeB8AeC8BeA?8EeB8BeA8EeB8CeA8BeA8AeB8CeA8AeB8AeB8DeA8BeC8De?B8AeC8HeB8EeA8AeA8AeA8EeA8AeA8AeA8EeA8AeA8AeA8E?eA8AeA8GeA8AeA8HeB8AeA8FeD8LeAAA");
		assert_eq!(data.0, 115);
	}
}
