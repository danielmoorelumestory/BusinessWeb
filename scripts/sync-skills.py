"""Sync the investment skills from .agents/skills to the other tools' skill directories."""
from pathlib import Path
from shutil import copytree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.agents' / 'skills'
LEGACY_SKILLS = ('stock-research-expert', 'tencent-stock-research-team')

# Codex and Antigravity share .agents; sync the unified skill and its legacy names.
for platform in ('.claude', '.opencode', '.codebuddy'):
    for skill in ('stock-analysis',) + LEGACY_SKILLS:
        if not (SOURCE / skill / 'SKILL.md').is_file():
            raise FileNotFoundError(SOURCE / skill / 'SKILL.md')
        copytree(SOURCE / skill, ROOT / platform / 'skills' / skill, dirs_exist_ok=True)
        print(f'{platform}/skills/{skill}: synced')
