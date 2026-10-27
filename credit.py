from collections import defaultdict
import json
import re


def remove_js_comments(text: str) -> str:
    """文字列リテラル内 ("...", '...') 以外のコメント (//... や /*...*/) のみを安全に除去する"""
    result = []
    i = 0
    in_str = None
    while i < len(text):
        char = text[i]

        if not in_str:
            if char in ('"', "'", "`"):
                in_str = char
                result.append(char)
                i += 1
                continue
            # 1行コメント (//...) のスキップ（URL内の // はここを通らない）
            if char == "/" and i + 1 < len(text) and text[i + 1] == "/":
                nl = text.find("\n", i)
                if nl == -1:
                    break
                i = nl
                continue
            # 複数行コメント (/*...*/) のスキップ
            if char == "/" and i + 1 < len(text) and text[i + 1] == "*":
                end_c = text.find("*/", i + 2)
                if end_c == -1:
                    break
                i = end_c + 2
                continue
        else:
            if char == in_str and text[i - 1] != "\\":
                in_str = None

        result.append(char)
        i += 1
    return "".join(result)


def extract_js_object(js_text: str, var_name: str) -> str:
    """変数名から対応する最外枠の { ... } を括弧の深さ(depth)をカウントして正確に切り出す"""
    match = re.search(rf"{re.escape(var_name)}\s*=", js_text)
    if not match:
        raise ValueError(f"変数 {var_name} が見つかりませんでした。")

    brace_start = js_text.find("{", match.end())
    if brace_start == -1:
        raise ValueError(
            f"{var_name} の開始括弧 '{{' が見つかりませんでした。"
        )

    depth = 0
    in_str = None
    in_line_comment = False
    in_block_comment = False
    i = brace_start

    while i < len(js_text):
        char = js_text[i]
        if not in_str:
            if in_line_comment:
                if char == "\n":
                    in_line_comment = False
                i += 1
                continue
            if in_block_comment:
                if char == "*" and i + 1 < len(js_text) and js_text[i + 1] == "/":
                    in_block_comment = False
                    i += 2
                    continue
                i += 1
                continue
            if char == "/" and i + 1 < len(js_text):
                if js_text[i + 1] == "/":
                    in_line_comment = True
                    i += 2
                    continue
                elif js_text[i + 1] == "*":
                    in_block_comment = True
                    i += 2
                    continue

        if char in ('"', "'", "`"):
            if not in_str:
                in_str = char
            elif in_str == char and js_text[i - 1] != "\\":
                in_str = None
            i += 1
            continue

        if not in_str:
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return js_text[brace_start : i + 1]
        i += 1
    raise ValueError(f"{var_name} の閉じ括弧が見つかりませんでした。")


def js_to_py_dict(raw_str: str) -> dict:
    """JSオブジェクト文字列を安全にJSON辞書に変換"""
    # 1. URL以外の本物のコメントのみを除去
    text = remove_js_comments(raw_str)

    # 2. クォートされていないキー（0:, name: 等）を "キー": に変換
    text = re.sub(r'(?<=[{,\s\n])([a-zA-Z0-9_]+)\s*:', r'"\1":', text)

    # 3. 末尾の余分なカンマ (, } や , ]) を除去
    text = re.sub(r",\s*([}\]])", r"\1", text)

    return json.loads(text)


def generate_markdown(js_content: str) -> str:
    bgm_infos = js_to_py_dict(extract_js_object(js_content, "window.bgmInfos"))
    author_urls = js_to_py_dict(
        extract_js_object(js_content, "window.authorUrls")
    )
    license_urls = js_to_py_dict(
        extract_js_object(js_content, "window.licenseUrls")
    )

    tree = defaultdict(lambda: defaultdict(list))
    for item in bgm_infos.values():
        author = item.get("author", "Unknown")
        lic = item.get("license", "Unknown")
        title = item.get("title", "Untitled")
        tree[author][lic].append(title)

    lines = []
    for author, licenses in tree.items():
        author_url = author_urls.get(author, "")
        lines.append(f"- {author} ({author_url})")

        for lic_name, titles in licenses.items():
            lic_info = license_urls.get(lic_name, {})
            en_url = (
                lic_info.get("en", "") if isinstance(lic_info, dict) else ""
            )
            lines.append(f"  - {lic_name} ({en_url})")

            for title in titles:
                lines.append(f"    - {title}")

    return "\n".join(lines)


# 読み込みと実行
with open("bgmInfo.js", "r", encoding="utf-8") as f:
    js_code = f.read()

markdown_result = generate_markdown(js_code)

with open("credits.md", "w", encoding="utf-8") as f:
    f.write(markdown_result)

print("生成が完了しました！")