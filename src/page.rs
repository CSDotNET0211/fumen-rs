use crate::{WIDTH};
use crate::comment::Comment;
use crate::enums::BlockType;
use crate::field::Field;
use crate::mino_flags::MinoFlags;
use crate::util::{check_valid_pos, clear_lines, mirror_field, place_mino, raise_field};

#[derive(Debug, Clone)]
pub struct Page {
	pub field: Field,
	pub mino_flags: MinoFlags,
	pub comment: String,
}

impl Page {
	pub fn decode(data: &str, offset: &mut usize, prev_board: Option<&Page>, repeat_count: &mut usize) -> Self {
		let mut page = Page::default();
		let mut prev_board_temp;

		let prev_board = if let Some(prev_board) = prev_board {
			prev_board_temp = (*prev_board).clone();

			if prev_board_temp.mino_flags.lock {
				if prev_board_temp.mino_flags.mino.kind != BlockType::Empty {
					let x = prev_board_temp.mino_flags.mino.position % WIDTH;
					let y = prev_board_temp.mino_flags.mino.position / WIDTH;

					if check_valid_pos(&mut prev_board_temp.field, &prev_board_temp.mino_flags.mino.kind, x, y) {
						place_mino(&mut prev_board_temp.field, &prev_board_temp.mino_flags.mino.kind, x, y);
					}
				}

				clear_lines(&mut prev_board_temp.field);

				if prev_board_temp.mino_flags.raise {
					raise_field(&mut prev_board_temp.field);
				}

				if prev_board_temp.mino_flags.mirror {
					mirror_field(&mut prev_board_temp.field);
				}
			}
			Some(&prev_board_temp)
		} else { None };

		page.field = Field::decode(data, offset, prev_board, repeat_count);
		page.mino_flags = MinoFlags::decode(data, offset);


		if page.mino_flags.comment {
			page.comment = Comment::decode(data, offset);
		} else if let Some(prev_board) = prev_board {
			page.comment = prev_board.comment.clone();
		}

		page
	}
}

impl Default for Page {
	fn default() -> Self {
		Self {
			field: Field::default(),
			comment: "".to_owned(),
			mino_flags: MinoFlags::default(),
		}
	}
}


#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn decode_comment_test() {
		let result = Comment::decode(&"DABUYCA", &mut 0);
		assert_eq!(result, "abc".to_owned());
	}


	#[test]
	fn comment_japanese_test() {
		let result = Comment::decode(&"SAlvs2A21DfETY9KBlvs2AYbAAA", &mut 0);
		assert_eq!(result, "どうも".to_owned());
	}
}
