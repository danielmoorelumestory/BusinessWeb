"""ROUND2 数据 provider 包。

每个子模块（domestic、supplemental）暴露 ``collect(indices, as_of, offline=False) -> dict``，输出与
``data/providers/<name>.json`` 同构（schema 见 ROUND2.md）。fetch_data.py 默认只读取这些缓存文件，
仅在显式 ``--collect-providers`` 时才导入并调用在线 collect。本文件不含逻辑，只作包标记。
"""
