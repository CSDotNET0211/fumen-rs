use crate::enums::BlockType;
use crate::{HEIGHT, WIDTH};
use crate::page::Page;
use crate::util::poll;


#[derive(Clone,Debug)]
pub struct Field(pub [BlockType; WIDTH * HEIGHT]);

impl Field {
	pub fn decode(data: &str, offset: &mut usize, prev_board: Option<&Page>, repeat_count: &mut usize) -> Self {
		let mut field = Field::default();

		let mut total_count = 0;

		if *repeat_count != 0 {
			field = prev_board.unwrap().field.clone();
			*repeat_count -= 1;
			return field;
		}

		while total_count != 240 {
			let value = poll(&data[*offset..*offset + 2]);
			*offset += 2;

			let diff = value / 240;
			let count = value % 240;

			for i in 0..count + 1 {
				if prev_board.is_some() {
					field.0[total_count + i] = BlockType::from_repr(prev_board.unwrap().field.0[total_count + i] as usize + diff - 8).unwrap();
				} else {
					field.0[total_count + i] = BlockType::from_repr(diff - 8).unwrap();
				}
			}

			total_count += count + 1;


			if count == 240 - 1 {
				*repeat_count = poll(&data[*offset..*offset + 2]);
				*offset += 1;
				break;
			}
		}

		field
	}
}

impl Default for Field {
	fn default() -> Self {
		Field([BlockType::Empty; WIDTH * HEIGHT])
	}
}