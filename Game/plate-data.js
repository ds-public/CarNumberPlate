"use strict" ;

/// <summary>ナンバープレート上段に表示する地域名と分類番号を管理します。</summary>
class NumberPlateData
{
	/// <summary>国土交通省の地域名一覧と2020年・2025年の追加分を合わせた138種類。</summary>
	static m_regionNames = Object.freeze( [
		"札幌", "函館", "旭川", "室蘭", "釧路", "帯広", "北見", "苫小牧", "知床", "十勝",
		"青森", "八戸", "弘前",
		"岩手", "盛岡", "平泉",
		"宮城", "仙台",
		"秋田",
		"山形", "庄内",
		"福島", "会津", "いわき", "郡山", "白河",
		"水戸", "土浦", "つくば",
		"宇都宮", "とちぎ", "那須", "日光",
		"群馬", "高崎", "前橋",
		"大宮", "熊谷", "春日部", "所沢", "川越", "川口", "越谷",
		"千葉", "習志野", "袖ヶ浦", "野田", "成田", "柏", "松戸", "市川", "船橋", "市原",
		"品川", "練馬", "足立", "多摩", "八王子", "世田谷", "杉並", "板橋", "江東", "葛飾", "江戸川",
		"横浜", "川崎", "相模", "湘南",
		"新潟", "長岡", "上越",
		"富山",
		"石川", "金沢",
		"福井",
		"山梨", "富士山",
		"長野", "松本", "諏訪", "安曇野", "南信州",
		"岐阜", "飛騨",
		"静岡", "浜松", "沼津", "伊豆",
		"名古屋", "三河", "尾張小牧", "豊橋", "一宮", "岡崎", "豊田", "春日井",
		"三重", "鈴鹿", "四日市", "伊勢志摩",
		"滋賀",
		"京都",
		"大阪", "なにわ", "和泉", "堺",
		"神戸", "姫路",
		"奈良", "飛鳥",
		"和歌山",
		"鳥取",
		"島根", "出雲",
		"岡山", "倉敷",
		"広島", "福山",
		"山口", "下関",
		"徳島",
		"香川", "高松",
		"愛媛",
		"高知",
		"福岡", "北九州", "筑豊", "久留米",
		"佐賀",
		"長崎", "佐世保",
		"熊本",
		"大分",
		"宮崎",
		"鹿児島", "奄美",
		"沖縄"
	] ) ;

	/// <summary>登録自動車の数字のみの分類番号。従来の1・2桁と3桁を区別して保持します。</summary>
	static m_classificationNumbers = Object.freeze( [
		...Array.from( { length: 10 }, ( _, index ) => String( index ) ),
		...Array.from( { length: 100 }, ( _, index ) => String( index ).padStart( 2, "0" ) ),
		...Array.from( { length: 1000 }, ( _, index ) => String( index ).padStart( 3, "0" ) )
	] ) ;

	/// <summary>東北運輸局のかな文字一覧にある、登録自動車の全用途のひらがな。</summary>
	static m_hiragana = "あいうえかきくけこさすせそたちつてとなにぬねのはひふほまみむめもやゆよらりるれろわを" ;

	/// <summary>ナンバープレートの色の区分と出現率（％）。保有台数の割合に近い値とします。</summary>
	static m_plateTypes = Object.freeze( [
		{ name: "white", rate: 57 },
		{ name: "yellow", rate: 40 },
		{ name: "green", rate: 2.5 },
		{ name: "black", rate: .5 }
	] ) ;

	/// <summary>ひらがなを等確率で1文字選びます。</summary>
	/// <returns>ひらがな1文字。</returns>
	static CreateRandomHiragana()
	{
		return this.m_hiragana[ Math.floor( Math.random() * this.m_hiragana.length ) ] ;
	}

	/// <summary>出現率に従ってナンバープレートの色の区分を選びます。</summary>
	/// <returns>white・yellow・green・blackのいずれか。</returns>
	static CreateRandomPlateType()
	{
		let threshold = Math.random() * 100 ;
		for( const type of this.m_plateTypes )
		{
			threshold -= type.rate ;
			if( threshold < 0 )
			{
				return type.name ;
			}
		}
		return this.m_plateTypes[ 0 ].name ;
	}

	/// <summary>地域名と分類番号をそれぞれ等確率で選び、上段の表示を生成します。</summary>
	/// <returns>地域名と分類番号を空白で区切った文字列。</returns>
	static CreateRandomHeader()
	{
		const region = this.m_regionNames[ Math.floor( Math.random() * this.m_regionNames.length ) ] ;
		const classification = this.m_classificationNumbers[ Math.floor( Math.random() * this.m_classificationNumbers.length ) ] ;
		return `${ region } ${ classification }` ;
	}
}

globalThis.NumberPlateData = NumberPlateData ;

if( typeof module !== "undefined" )
{
	module.exports = NumberPlateData ;
}
