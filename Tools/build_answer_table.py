"""ゲームオーバー時に表示する模範解答を、問題ごとに1つ生成する。"""

import csv
import json
from itertools import permutations
from pathlib import Path

import build_question_table
from build_question_table import results, solve_order

# 記号1つの重み。どの組み合わせの難易度ポイントよりも大きくし、記号数の最小化を最優先にする。
SYMBOL_WEIGHT = 1000


def main():
    """数字の並べ替えを自由とし、配置する記号が最も少ない式を、問題を4桁に埋めた並びごとに出力する。"""
    root = Path(__file__).resolve().parents[1]
    with (root / 'Game' / 'Question.csv').open(encoding='utf-8', newline='') as source:
        values = sorted(int(row[0]) for row in csv.reader(source) if row)

    # 括弧は1組で2記号として数え、同じ記号数なら難易度ポイントの低い式を選ぶ。
    defaults = dict(build_question_table.COSTS)
    build_question_table.COSTS.update({
        'paren': 2 * SYMBOL_WEIGHT + defaults['paren'],
        'add': SYMBOL_WEIGHT + defaults['add'],
        'mul': SYMBOL_WEIGHT + defaults['mul'],
        'negative': SYMBOL_WEIGHT + defaults['negative'],
        'root': SYMBOL_WEIGHT + defaults['root'],
    })
    results.cache_clear()
    solutions = {}
    answers = {}
    try:
        for index, value in enumerate(values):
            # ゲームは4桁に満たない値の上位桁を0で埋め、その0も並べ替えの対象にする。
            original = str(value).zfill(4)
            best = None
            for order in sorted(set(permutations(original))):
                if order not in solutions:
                    solutions[order] = solve_order(tuple(map(int, order)))
                solution = solutions[order]
                if solution is None:
                    continue
                # 記号数・難易度ポイントが同じなら、出題時から位置の変わる数字が少ない並びを選ぶ。
                score = solution.cost + sum(a != b for a, b in zip(original, order))
                if best is None or score < best[0]:
                    best = (score, solution.text)
            if best is None:
                raise ValueError(f'No answer: {value}')
            answers[original] = best[1]
            if index % 500 == 0:
                print(f'Questions {index + 1}/{len(values)}', flush=True)
    finally:
        build_question_table.COSTS.update(defaults)
        results.cache_clear()
    with (root / 'Game' / 'answers.js').open('w', encoding='utf-8', newline='\n') as output:
        output.write('// 問題（4桁に埋めた出題時の並び）ごとの模範解答。直接編集せず生成ツールで更新します。\n')
        output.write('globalThis.NumberPlateAnswerTable = ')
        json.dump(answers, output, ensure_ascii=False, separators=(',', ':'))
        output.write(' ;\n')
    print(f'Completed {len(answers)} answers', flush=True)


if __name__ == '__main__':
    main()
