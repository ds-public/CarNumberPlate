"""整数になる平方根と有理数の厳密計算で、出題可能な値を抽出する。"""

import csv
import json
from fractions import Fraction
from functools import cache
from itertools import combinations, combinations_with_replacement
from math import isqrt
from pathlib import Path


def roots(value, expression):
    """元の値と、整数になる平方根の有限な連鎖を返す。"""
    yield value, expression
    while value.denominator == 1 and value > 1:
        root = isqrt(value.numerator)
        if root * root != value:
            break
        value = Fraction(root)
        expression = f"sqrt({expression})"
        yield value, expression


def partitions(digits):
    """重複を除いた二分割を返す。左右の演算順は計算時に扱う。"""
    seen = set()
    for size in range(1, len(digits)):
        for indices in combinations(range(len(digits)), size):
            selected = set(indices)
            left = tuple(digits[i] for i in indices)
            right = tuple(digits[i] for i in range(len(digits)) if i not in selected)
            key = tuple(sorted((left, right)))
            if key not in seen:
                seen.add(key)
                yield key


def operations(left, right):
    """四則演算を両方向に適用し、値と検証可能な式を返す。"""
    a, expression_a = left
    b, expression_b = right
    yield a + b, f"({expression_a}+{expression_b})"
    yield a - b, f"({expression_a}-{expression_b})"
    yield b - a, f"({expression_b}-{expression_a})"
    yield a * b, f"({expression_a}*{expression_b})"
    if b:
        yield a / b, f"({expression_a}/{expression_b})"
    if a:
        yield b / a, f"({expression_b}/{expression_a})"


@cache
def results(digits):
    """部分集合で作れる全有理数を、代表式とともに保存する。"""
    found = {}
    if len(digits) == 1:
        found.update(roots(Fraction(digits[0]), str(digits[0])))
    else:
        for left, right in partitions(digits):
            for a in results(left).items():
                for b in results(right).items():
                    for value, expression in operations(a, b):
                        for rooted, rooted_expression in roots(value, expression):
                            found.setdefault(rooted, rooted_expression)
    return found


def solve(digits):
    """最終演算と平方根の連鎖が10になる式を探索する。"""
    for left, right in partitions(digits):
        for a in results(left).items():
            for b in results(right).items():
                for value, expression in operations(a, b):
                    for rooted, rooted_expression in roots(value, expression):
                        if rooted == 10:
                            return rooted_expression
    return None


def main():
    """桁の組み合わせ単位で探索し、数値の昇順でCSVを出力する。"""
    witnesses = {}
    for length in range(2, 5):
        for digits in combinations_with_replacement(range(10), length):
            expression = solve(digits)
            if expression is not None:
                witnesses["".join(map(str, digits))] = expression
        print(f"Completed {length} digits: {len(witnesses)} solvable combinations", flush=True)
    values = [value for value in range(19, 10000)
              if "".join(sorted(str(value))) in witnesses]
    root = Path(__file__).resolve().parents[1]
    with (root / "Game" / "Question.csv").open("w", newline="", encoding="utf-8") as output:
        csv.writer(output).writerows((value,) for value in values)
    with (root / "Documents" / "解答例.json").open("w", encoding="utf-8") as output:
        json.dump(witnesses, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(f"Questions: {len(values)}; first: {values[0]}; last: {values[-1]}")
    # ゲームが読む難易度付きCSVとJavaScriptも必ず同期する。
    from build_question_table import main as build_table
    build_table()


if __name__ == "__main__":
    main()
