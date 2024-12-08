use crate::page::Page;

#[derive(Debug)]
pub struct Fumen {
	pub version: usize,
	pub pages: Vec<Page>,
}

impl Default for Fumen {
	fn default() -> Self {
		Self {
			version: 0,
			pages: Vec::new(),
		}
	}
}