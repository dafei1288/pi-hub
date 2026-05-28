/**
 * Pi HUD Plugin — 随机谏言 (Random Quote)
 *
 * 每隔 10 秒从谏言库中随机选取一句显示在 HUD Line 3。
 *
 * 安装：复制到 .pi/pi-hud-plugins/quote.js 或 ~/.pi/agent/pi-hub-plugins/quote.js
 */

const quotes = [
	// 中国古训
	"学而不思则罔，思而不学则殆。—— 孔子",
	"知之为知之，不知为不知，是知也。—— 孔子",
	"三人行，必有我师焉。—— 孔子",
	"温故而知新，可以为师矣。—— 孔子",
	"己所不欲，勿施于人。—— 孔子",
	"工欲善其事，必先利其器。—— 孔子",
	"学而时习之，不亦说乎？—— 孔子",
	"君子和而不同，小人同而不和。—— 孔子",
	"道可道，非常道。—— 老子",
	"千里之行，始于足下。—— 老子",
	"上善若水，水善利万物而不争。—— 老子",
	"知人者智，自知者明。—— 老子",
	"大方无隅，大器晚成。—— 老子",
	"合抱之木，生于毫末。—— 老子",
	"天行健，君子以自强不息。—— 《周易》",
	"地势坤，君子以厚德载物。—— 《周易》",
	"博学之，审问之，慎思之，明辨之，笃行之。—— 《中庸》",
	"穷则独善其身，达则兼济天下。—— 孟子",
	"生于忧患，死于安乐。—— 孟子",
	"吾生也有涯，而知也无涯。—— 庄子",
	"锲而不舍，金石可镂。—— 荀子",
	"不积跬步，无以至千里。—— 荀子",
	"青，取之于蓝而青于蓝。—— 荀子",
	"纸上得来终觉浅，绝知此事要躬行。—— 陆游",
	"书山有路勤为径，学海无涯苦作舟。—— 韩愈",
	"业精于勤荒于嬉，行成于思毁于随。—— 韩愈",
	"读万卷书，行万里路。—— 董其昌",
	"路漫漫其修远兮，吾将上下而求索。—— 屈原",
	"不以规矩，不能成方圆。—— 孟子",
	"天下事以难而废者十之一，以惰而废者十之九。—— 颜之推",

	// 编程智慧
	"Talk is cheap. Show me the code. —— Linus Torvalds",
	"First, solve the problem. Then, write the code. —— John Johnson",
	"Code is like humor. When you have to explain it, it's bad. —— Cory House",
	"Make it work, make it right, make it fast. —— Kent Beck",
	"Simplicity is the soul of efficiency. —— Austin Freeman",
	"The best error message is the one that never shows up. —— Thomas Fuchs",
	"Any fool can write code that a computer can understand. Good programmers write code that humans can understand. —— Martin Fowler",
	"Don't repeat yourself. —— Andy Hunt & Dave Thomas",
	"Premature optimization is the root of all evil. —— Donald Knuth",
	"Programs must be written for people to read. —— Harold Abelson",
	"Fix the cause, not the symptom. —— Steve Maguire",
	"Optimism is an occupational hazard of programming. —— Kent Beck",
	"The most dangerous phrase in language: We've always done it this way. —— Grace Hopper",
	"It works on my machine. —— Every developer",
	"There are only two hard things in CS: cache invalidation and naming things. —— Phil Karlton",

	// AI 时代
	"The question isn't whether AI will transform work, but how we'll transform with it.",
	"The best way to predict the future is to invent it. —— Alan Kay",
	"Technology is nothing. What's important is that you have faith in people. —— Steve Jobs",
	"Stay hungry, stay foolish. —— Steve Jobs",
];

let lastIndex = -1;
let currentQuote = "";
let lastSwitchTime = 0;
const INTERVAL_MS = 10_000;

function pickQuote() {
	// Avoid repeating the same quote
	let idx;
	do {
		idx = Math.floor(Math.random() * quotes.length);
	} while (idx === lastIndex && quotes.length > 1);
	lastIndex = idx;
	return quotes[idx];
}

module.exports = {
	name: "random-quote",
	target: "line3",
	order: 50,

	render(_ctx, theme, _width) {
		const now = Date.now();
		if (now - lastSwitchTime >= INTERVAL_MS || !currentQuote) {
			currentQuote = pickQuote();
			lastSwitchTime = now;
		}
		return theme.fg("dim", `💬 ${currentQuote}`);
	},
};
