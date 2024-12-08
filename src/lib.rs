pub mod fumen;
mod page;
mod mino;
pub mod enums;
mod mino_flags;
mod util;
mod comment;
mod field;

use std::collections::HashMap;
use std::sync::LazyLock;
use crate::fumen::Fumen;
use crate::page::Page;
use crate::util::get_prefix_data;

pub static DATA_TABLE: LazyLock<HashMap<char, u8>> = LazyLock::new(|| {
	let mut table = HashMap::new();
	table.insert('A', 0);
	table.insert('B', 1);
	table.insert('C', 2);
	table.insert('D', 3);
	table.insert('E', 4);
	table.insert('F', 5);
	table.insert('G', 6);
	table.insert('H', 7);
	table.insert('I', 8);
	table.insert('J', 9);
	table.insert('K', 10);
	table.insert('L', 11);
	table.insert('M', 12);
	table.insert('N', 13);
	table.insert('O', 14);
	table.insert('P', 15);
	table.insert('Q', 16);
	table.insert('R', 17);
	table.insert('S', 18);
	table.insert('T', 19);
	table.insert('U', 20);
	table.insert('V', 21);
	table.insert('W', 22);
	table.insert('X', 23);
	table.insert('Y', 24);
	table.insert('Z', 25);
	table.insert('a', 26);
	table.insert('b', 27);
	table.insert('c', 28);
	table.insert('d', 29);
	table.insert('e', 30);
	table.insert('f', 31);
	table.insert('g', 32);
	table.insert('h', 33);
	table.insert('i', 34);
	table.insert('j', 35);
	table.insert('k', 36);
	table.insert('l', 37);
	table.insert('m', 38);
	table.insert('n', 39);
	table.insert('o', 40);
	table.insert('p', 41);
	table.insert('q', 42);
	table.insert('r', 43);
	table.insert('s', 44);
	table.insert('t', 45);
	table.insert('u', 46);
	table.insert('v', 47);
	table.insert('w', 48);
	table.insert('x', 49);
	table.insert('y', 50);
	table.insert('z', 51);
	table.insert('0', 52);
	table.insert('1', 53);
	table.insert('2', 54);
	table.insert('3', 55);
	table.insert('4', 56);
	table.insert('5', 57);
	table.insert('6', 58);
	table.insert('7', 59);
	table.insert('8', 60);
	table.insert('9', 61);
	table.insert('+', 62);
	table.insert('/', 63);
	table
});

pub const WIDTH: usize = 10;
pub const HEIGHT: usize = 24;




pub fn parse(raw_url: &str) -> Fumen {
	let mut offset = 0usize;
	let mut data = Fumen::default();
	let prefix_data = get_prefix_data(raw_url);
	data.version = prefix_data.0;

	let mut data_str = prefix_data.1;
	data_str = data_str.replace("?", "");

	let mut repeat_count = 0;

	while offset != data_str.len() {
		let prev_field: Option<_>;
		if data.pages.len() > 0 {
			prev_field = Option::from(&data.pages[data.pages.len() - 1]);
		} else {
			prev_field = None;
		}

		data.pages.push(Page::decode(&data_str, &mut offset, prev_field, &mut repeat_count));
	}
	data
}


#[cfg(test)]
mod tests {
	use super::*;


	#[test]
	fn test() {
		parse("v115@vhAAgH");
	}

	#[test]
	fn test2() {
		parse("v115@xgRpHeRpIewhglBeQ4AeywAewhglBtR4g0wwBewhhl?BtQ4i0AewhJeAgWBARAAAASgglQ4HeglR4Cewhh0AehlQ4w?wBewhg0CezwAewhg0AtBeywRpwhBtCeQ4g0RpwhAtSpAeQ4?g0BtxhglQpBeQ4h0BtwhilAeQ4JeAAPBASAAAA0fhlwhBeR?4CeAtglwhAeR4CeBtglwhAeg0RpBeAtg0xhAeg0RpCeg0xh?h0wwQ4hlAeh0whQpxwQ4glEeRpwwQ4glAtDeQpxwQ4BtEex?wAeAtieAAPCAzxAAAUfAtg0glQ4EeBtg0glR4DeAth0hlQ4?EeRph0Q4whAexhAeRpAtg0Q4yhCeBtg0Q4whglxwBeAtBeQ?4whglxwFehlQpHeRpIeQpYewwHexwIewwKeAAPCA0xAAAUf?R4BtEeR4glg0BtDeili0EeQawSg0whA8whAeB8APQawSg0y?hB8AeAPgHglh0xhC8AewSwwDeA8CexSCeQ4BeC8AACeQ4Ce?A8AeBABeQ4CeB8AeAAIeBAFeC8wSGeA8wwwSGeB8wwKeAAP?EA0B25AJfRpAeAtFeRpBtFeh0AtglQ4Eeg0ilR4Deg0xhBt?Q4AewhBexhg0glBtAewhBei0ilAewhCexwCeQ4whCexwCeQ?4IeQ4IeQ4jewwHeywKeAAPCA1xAAAreBtIeBtGeRph0FeRp?g0hlEexwg0AtglEexwBtglAeQ4CehlAtg0whAeR4Begli0y?hQ4BeglDexhQ4HewhQ4HewhQ4IeQ4rewwIexwHewwQpLeAA?PCA2xAAA/eBtIeBtGexwhlFexwglh0GeglAeg0Ieg0AewhI?exhHeQ4whHeQ4IeQ4IeQ42eRpLeAAA/eBAIeBAGeDAFeEAE?eEAEeCARLwhAAAeh0CARLwhBAg0AeBAiHwDwSAAg0AtBAgH?BewDxSBtCACewSQaAtA8BeAADeQaQ4B8CADeQaAeA8AeBAE?eC8CAEeB8BeAAEeC8BAFeA8BeAAKeAAPCATzAAADfAtHeBt?HeAtglg0Feilg0Dezhh0EeRpxwR4AehlAeRpxwS4glCei0Q?4QpQ4glAtBeg0BeQ4RpBtFeQpwhAtHexhIewhYewwHexwIe?wwKeAAPCAUzAAADfAtHeBtHeAthlFeh0hlDeyhwShlEeRpA?tg0glQ4AeB8AeQpwhh0glR4A8AeRaR4hlA8Q4B8AewSwwCe?whA8CexSCexhAeC8AADewhBeA8AeBAFeB8AeAAIeBAFeC8w?SGeA8wwwSGeB8wwKeAAPEAUD25A6eg0Ieg0Heh0EeBtAehl?EeQ4CtglEeR4BtglDeRpQ4Ath0AewhBeRpilg0AewhBeT4g?lg0AewhCexwCexhCexwCexhIewhsewwHeywKeAAPCAVzAAA?weAtGeglBtEeilAtglEeRph0glEeRpg0hlEeBti0Q4DewhB?tAeg0R4CexhBeg0whQ4BexwwhCewhQ4BexwDewhQ4HewhQ4?IeQ4rewwIexwHewwQpLeAAPCAWzAAAEfAtGeg0BtEei0AtF?exwhlFexwglIeglBewhIexhHeQ4whHeQ4IeQ4IeQ42eRpLe?AAAEfAAGeCAEeEAEeEAEeEAEeFADeGACeGABeHABeHABeHA?CeIAAeHACeHABeHACeHAAeDAJeAAPQClPBBC5sDfE2CqHBl?vs2A2HEfEWbdzBl/3RBjJEfEV75ABlvs2AY0DfETYOwBlP5?2BxpDfEToXOBlvs2AWoDfEToH6AlvV6BUuDfETIEBClvs2A?YuDfEToHVBlvs2AUuDfETYdzBlvs2AYrDfEToXOBlvs2A4E?EfETIs9Blvs2AVDEfEToABB");
	}

	#[test]
	fn test3() {
		parse("v115@vhAhPJ");
	}
}
