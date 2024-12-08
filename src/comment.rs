use crate::util::{poll};

pub struct Comment;

impl Comment {
	pub fn decode(data: &str, offset: &mut usize) -> String {
		let mut comment = "".to_owned();
		let comment_count = poll(&data[*offset..(*offset + 2)]);
		*offset += 2;

		let mut comment_converted = 0;
		while comment_converted < comment_count {
			let mut value = poll(&data[*offset..(*offset + 5)]);
			let mut comment_temp = "".to_owned();
			for i in (0..4).rev() {
				let ascii = (value / 96usize.pow(i)) as u8;
				value %= 96usize.pow(i);
				if ascii == 0 {
					continue;
				}

				comment_temp.push((ascii + 32) as char);

				if i == 0 {
					comment += &comment_temp.chars().rev().collect::<String>();
				}
			}

			*offset += 5;


			comment_converted += 4;
		}


		Self::unescape(&comment)
	}


	fn unescape(input: &str) -> String {
		let mut result = String::new();
		let mut chars = input.chars().peekable();

		while let Some(c) = chars.next() {
			if c == '%' {
				if chars.peek() == Some(&'u') {
					chars.next();
					let code_point: String = chars.by_ref().take(4).collect();
					if let Ok(num) = u32::from_str_radix(&code_point, 16) {
						if let Some(decoded_char) = char::from_u32(num) {
							result.push(decoded_char);
						}
					}
				} else {
					let code_point: String = chars.by_ref().take(2).collect();
					if let Ok(num) = u8::from_str_radix(&code_point, 16) {
						result.push(num as char);
					}
				}
			} else {
				result.push(c);
			}
		}

		result
	}
}