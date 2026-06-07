#!/usr/bin/env python3
"""Left/right selector for Pixelverse UI exposure mode."""

from __future__ import annotations

import curses
import os
import sys


OPTIONS = [
    ("localhost", "Localhost only", "Use http://localhost:5660 on this machine."),
    ("tailscale", "Tailscale", "Expose through host-side tailscale serve when available."),
    ("ngrok", "ngrok URL", "Display PIXELVERSE_NGROK_URL when it is set."),
]


def draw(stdscr, selected: int) -> None:
    stdscr.clear()
    stdscr.addstr(0, 0, "Select UI exposure mode with ←/→, Enter to start:")
    x = 0
    for index, (_, label, _) in enumerate(OPTIONS):
        text = f" {label} "
        mode = curses.A_REVERSE if index == selected else curses.A_NORMAL
        stdscr.addstr(2, x, text, mode)
        x += len(text) + 2
    stdscr.addstr(4, 0, OPTIONS[selected][2])
    stdscr.refresh()


def main(stdscr) -> str:
    curses.curs_set(0)
    selected = 0
    while True:
        draw(stdscr, selected)
        key = stdscr.getch()
        if key in (curses.KEY_LEFT, ord("h"), ord("a")):
            selected = (selected - 1) % len(OPTIONS)
        elif key in (curses.KEY_RIGHT, ord("l"), ord("d")):
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
        print("Unable to open interactive exposure selector; defaulting to localhost.", file=sys.stderr)
        print("Set PIXELVERSE_EXPOSURE_MODE=localhost|tailscale|ngrok for non-interactive selection.", file=sys.stderr)
        print("localhost")
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
