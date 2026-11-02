"""ゲームオーバー時に表示する正解の式を、出題で現れる4桁の並びごとに生成する。"""

import csv
import json
from itertools import permutations
from pathlib import Path

from build_question_table import solve_order


def main():
    """問題テーブルの各数値を4桁に埋めた全並びを解き、解ける並びだけをブラウザー用データに出力する。"""
    root = Path(__file__).resolve().parents[1]
    with (root / 'Game' / 'Question.csv').open(encoding='utf-8', newline='') as source:
        values = [int(row[0]) for row in csv.reader(source) if row]
    # ゲームは4桁に満たない値の上位桁を0で埋め、その0も並べ替えの対象にする。
    orders = sorted({order for value in values for order in permutations(str(value).zfill(4))})
    answers = {}
    for index, order in enumerate(orders):
        solution = solve_order(tuple(map(int, order)))
        if solution is not None:
            answers[''.join(order)] = solution.text
        if index % 500 == 0:
            print(f'Orders {index + 1}/{len(orders)}, solvable {len(answers)}', flush=True)
    with (root / 'Game' / 'answers.js').open('w', encoding='utf-8', newline='\n') as output:
        output.write('// 4桁の並びごとの正解の式。解けない並びは含めません。直接編集せず生成ツールで更新します。\n')
        output.write('globalThis.NumberPlateAnswerTable = ')
        json.dump(answers, output, ensure_ascii=False, separators=(',', ':'))
        output.write(' ;\n')
    print(f'Completed {len(answers)}/{len(orders)} solvable orders', flush=True)


if __name__ == '__main__':
    main()
