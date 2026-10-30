"""配置可能な式の最小コストを求め、難易度順の問題テーブルを生成する。"""

import csv
import json
import re
from dataclasses import dataclass
from fractions import Fraction
from functools import cache
from itertools import permutations
from math import isqrt
from pathlib import Path


@dataclass(frozen=True, slots=True)
class Expression:
    """値・記号コスト・優先順位・両端の記号数を保持する。"""

    value: Fraction
    cost: int
    text: str
    precedence: int
    head: int
    tail: int


def wrap(item):
    """子の演算順を保つために括弧を付ける。"""
    return Expression(item.value, item.cost + 2, f"({item.text})", 4,
                      item.head, item.tail)


def has_required_separators(text):
    """0を挟んだ非0数字や部分式の間にも、演算記号を必須にする。"""
    operands = [False]
    for symbol in text:
        if symbol in '+-*/':
            operands[-1] = False
        elif symbol == ')':
            if len(operands) > 1:
                operands.pop()
        elif symbol == '(' or symbol in '123456789':
            if operands[-1]:
                return False
            operands[-1] = True
            if symbol == '(':
                operands.append(False)
    return True


def separator_context(text):
    """連結時の省略可否に影響する、両端の区間の非0数字を記録する。"""
    sections = re.split(r'[+*/()\-]', text)
    return (any(symbol in '123456789' for symbol in sections[0]),
            any(symbol in '123456789' for symbol in sections[-1]), omitted_sign(text))


def omitted_sign(text):
    """末尾の加減算用の0の後へ引き継ぐ符号を返す。"""
    match = re.search(r'([+-]*0+)$', text)
    if match is None:
        return 1
    if match.start() > 0 and text[match.start() - 1] in '*/√':
        return 1
    return -1 if match.group().count('-') % 2 else 1


def join(a, b, operator):
    """優先順位と桁間の記号上限を守って式を連結する。"""
    if operator == '' and not (a.text.endswith('0') or b.text.startswith('0')):
        return None
    precedence = 1 if operator in ('', '+', '-') else 2
    if a.precedence < precedence:
        a = wrap(a)
    negative_omission = operator == '' and omitted_sign(a.text) == -1
    if b.precedence < precedence or ((operator in ('-', '/') or negative_omission) and b.precedence == precedence):
        b = wrap(b)
    if a.tail + len(operator) + b.head > 2:
        return None
    text = f'{a.text}{operator}{b.text}'
    if not has_required_separators(text):
        return None
    if operator in ('', '+'):
        value = a.value - b.value if negative_omission else a.value + b.value
    elif operator == '-':
        value = a.value - b.value
    elif operator == '*':
        value = a.value * b.value
    else:
        if b.value == 0:
            return None
        value = a.value / b.value
    return Expression(value, a.cost + b.cost + (precedence if operator else 0),
                      text, precedence, a.head, b.tail)


def unary(item):
    """整数平方根と単項マイナスを最小コストで閉包する。"""
    pending = [item]
    best = {}
    while pending:
        current = pending.pop()
        key = (current.value, current.precedence, current.head, current.tail,
               current.text.startswith('0'), current.text.endswith('0'), separator_context(current.text))
        if key in best and best[key].cost <= current.cost:
            continue
        best[key] = current
        operand = wrap(current) if current.precedence < 3 else current
        if current.value != 0:
            negative = Expression(-current.value, operand.cost + 1, '-' + operand.text,
                                  3, min(3, operand.head + 1), operand.tail)
            pending.append(negative)
        value = current.value
        if value.denominator == 1 and value > 1:
            root = isqrt(value.numerator)
            if root * root == value:
                pending.append(Expression(Fraction(root), operand.cost + 4,
                                          '√' + operand.text, 3,
                                          min(3, operand.head + 1), operand.tail))
    return best.values()


def store(found, item):
    """同じ値と配置条件の式は、最小コストのものだけを残す。"""
    variants = found.setdefault(item.value, {})
    key = (item.precedence, item.head, item.tail,
           item.text.startswith('0'), item.text.endswith('0'), separator_context(item.text))
    previous = variants.get(key)
    if previous is None or item.cost < previous.cost:
        variants[key] = item


@cache
def results(digits):
    """数字の順番を固定した部分式を列挙する。"""
    found = {}
    if len(digits) == 1:
        for item in unary(Expression(Fraction(digits[0]), 0, str(digits[0]), 4, 0, 0)):
            store(found, item)
        return found
    for split in range(1, len(digits)):
        for left in results(digits[:split]).values():
            for right in results(digits[split:]).values():
                for a in left.values():
                    for b in right.values():
                        for operator in ('', '+', '-', '*', '/'):
                            combined = join(a, b, operator)
                            if combined is not None:
                                for item in unary(combined):
                                    store(found, item)
    return found


def solve_order(digits):
    """最終値10、または最後の平方根の直前値100を逆算して探索する。"""
    best = None
    # 4桁以下の四則演算で到達する分子・分母は9999以下なので、10000以上は不要。
    for split in range(1, len(digits)):
        left = results(digits[:split])
        right = results(digits[split:])
        for a_value, a_variants in left.items():
            for target in map(Fraction, (10, 100, -10, -100)):
                candidates = [('', target - a_value), ('', a_value - target), ('+', target - a_value), ('-', a_value - target)]
                if a_value:
                    candidates.extend([('*', target / a_value), ('/', a_value / target)])
                for operator, b_value in candidates:
                    b_variants = right.get(b_value)
                    if b_variants is None:
                        continue
                    for a in a_variants.values():
                        for b in b_variants.values():
                            item = join(a, b, operator)
                            if item is None:
                                continue
                            for final in unary(item):
                                if final.value == 10 and (best is None or final.cost < best.cost):
                                    best = final
    return best


def main():
    """既存の出題候補をすべて採点し、CSVと解答例を更新する。"""
    root = Path(__file__).resolve().parents[1]
    path = root / 'Game' / 'Question.csv'
    with path.open(encoding='utf-8', newline='') as source:
        values = sorted(int(row[0]) for row in csv.reader(source) if row)
    groups = {}
    for value in values:
        groups.setdefault(tuple(sorted(map(int, str(value)))), []).append(value)
    rows = []
    witnesses = {}
    for index, (digits, numbers) in enumerate(groups.items()):
        solutions = [(order, solve_order(order)) for order in sorted(set(permutations(digits)))]
        solutions = [(order, solution) for order, solution in solutions if solution is not None]
        if not solutions:
            raise ValueError(f'No playable solution: {digits}')
        for number in numbers:
            original = tuple(map(int, str(number)))
            order, solution = min(solutions, key=lambda pair: pair[1].cost +
                                  sum(a != b for a, b in zip(original, pair[0])))
            difficulty = len(digits) + solution.cost + sum(a != b for a, b in zip(original, order))
            rows.append((number, difficulty))
            witnesses[str(number)] = {'difficulty': difficulty, 'expression': solution.text}
        if index % 50 == 0:
            print(f'Groups {index + 1}/{len(groups)}, questions {len(rows)}', flush=True)
    rows.sort(key=lambda row: (row[1], row[0]))
    with path.open('w', encoding='utf-8', newline='') as output:
        csv.writer(output).writerows(rows)
    with (root / 'Game' / 'questions.js').open('w', encoding='utf-8') as output:
        output.write('// Question.csv から生成した難易度順の問題テーブル。直接編集せず生成ツールで更新します。\n')
        output.write('globalThis.NumberPlateQuestionTable = ')
        json.dump(rows, output, separators=(',', ':'))
        output.write(' ;\n')
    with (root / 'Documents' / '難易度別解答例.json').open('w', encoding='utf-8') as output:
        json.dump(witnesses, output, ensure_ascii=False, indent=2)
        output.write('\n')
    print(f'Completed {len(rows)} questions, difficulty {rows[0][1]}-{rows[-1][1]}', flush=True)


if __name__ == '__main__':
    main()
