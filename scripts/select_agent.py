#!/usr/bin/env python3
"""Tiny arrow-key selector for run.sh."""

from __future__ import annotations

import curses
import os
import sys


OPTIONS = [
    ("codex", "Codex"),
    ("gemini-cli", "Gemini CLI"),
    ("claude-code", "Claude Code"),
    ("ollama", "Local Ollama models"),
    ("hermes", "Hermes Agent"),
    ("generic", "Generic webhook/API agent"),
]


def draw(stdscr, selected: int) -> None:
    stdscr.clear()
    stdscr.addstr(0, 0, "Select agent source with ↑/↓, Enter to start:")
    for index, (_, label) in enumerate(OPTIONS):
        marker = ">" if index == selected else " "
        mode = curses.A_REVERSE if index == selected else curses.A_NORMAL
        stdscr.addstr(index + 2, 0, f"{marker} {label}", mode)
    stdscr.refresh()


def main(stdscr) -> str:
    curses.curs_set(0)
    selected = 0
    while True:
        draw(stdscr, selected)
        key = stdscr.getch()
        if key in (curses.KEY_UP, ord("k")):
            selected = (selected - 1) % len(OPTIONS)
        elif key in (curses.KEY_DOWN, ord("j")):
            selected = (selected + 1) % len(OPTIONS)
        elif key in (10, 13, curses.KEY_ENTER):
            return OPTIONS[selected][0]
        elif key in (27, ord("q")):
            raise SystemExit(130)


if __name__ == "__main__":
    original_stdout = None
    tty_fd = None
    try:
        original_stdout = os.dup(1)
        tty_fd = os.open("/dev/tty", os.O_RDWR)
        os.dup2(tty_fd, 0)
        os.dup2(tty_fd, 1)
        selected = curses.wrapper(main)
        os.dup2(original_stdout, 1)
        print(selected)
    except (OSError, curses.error):
        if original_stdout is not None:
            try:
                os.dup2(original_stdout, 1)
            except OSError:
                pass
        for index, (_, label) in enumerate(OPTIONS, start=1):
            print(f"{index}. {label}", file=sys.stderr)
        print("Select agent source [1]: ", end="", file=sys.stderr, flush=True)
        choice = sys.stdin.readline().strip() or "1"
        try:
            index = int(choice) - 1
        except ValueError:
            index = 0
        print(OPTIONS[max(0, min(len(OPTIONS) - 1, index))][0])
    finally:
        if tty_fd is not None:
            try:
                os.close(tty_fd)
            except OSError:
                pass
        if original_stdout is not None:
            try:
                os.close(original_stdout)
            except OSError:
                pass
