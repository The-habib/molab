import os
import sys
import asyncio
import logging
from typing import Dict, Optional, Callable, Any

logger = logging.getLogger("agent.pty")

class AgentPTYSession:
    def __init__(self, session_id: str, shell: str = "/bin/bash", cols: int = 80, rows: int = 24):
        self.session_id = session_id
        self.shell = shell
        self.cols = cols
        self.rows = rows
        self.master_fd: Optional[int] = None
        self.proc: Optional[asyncio.subprocess.Process] = None
        self.is_alive = False
        self._read_task: Optional[asyncio.Task] = None

    async def start(self, on_output: Callable[[str], Any], on_exit: Optional[Callable[[int], Any]] = None):
        is_posix = os.name == "posix"

        if is_posix:
            import pty
            import fcntl
            import termios
            import struct

            # Open pseudo-terminal
            master_fd, slave_fd = pty.openpty()
            self.master_fd = master_fd

            # Set initial size
            winsize = struct.pack("HHHH", self.rows, self.cols, 0, 0)
            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)

            # Determine shell
            target_shell = self.shell
            if not os.path.exists(target_shell):
                target_shell = "/bin/sh"

            env = os.environ.copy()
            env["TERM"] = "xterm-256color"
            env["COLORTERM"] = "truecolor"

            # Spawn subprocess connected to slave_fd
            self.proc = await asyncio.create_subprocess_exec(
                target_shell,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                env=env,
                preexec_fn=os.setsid
            )
            os.close(slave_fd)
            self.is_alive = True

            # Asynchronous reader for master_fd
            loop = asyncio.get_running_loop()

            def read_callback():
                try:
                    data = os.read(master_fd, 4096)
                    if data:
                        text = data.decode("utf-8", errors="replace")
                        if asyncio.iscoroutinefunction(on_output):
                            asyncio.create_task(on_output(text))
                        else:
                            on_output(text)
                    else:
                        self.stop()
                except (OSError, IOError):
                    self.stop()

            loop.add_reader(master_fd, read_callback)

            # Monitor process exit
            async def wait_exit():
                if self.proc:
                    code = await self.proc.wait()
                    self.is_alive = False
                    if on_exit:
                        if asyncio.iscoroutinefunction(on_exit):
                            await on_exit(code)
                        else:
                            on_exit(code)

            asyncio.create_task(wait_exit())

        else:
            # Windows fallback for local simulation
            target_shell = "powershell.exe"
            self.proc = await asyncio.create_subprocess_exec(
                target_shell,
                "-NoLogo",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )
            self.is_alive = True

            async def read_windows():
                while self.is_alive and self.proc and self.proc.stdout:
                    line = await self.proc.stdout.read(1024)
                    if not line:
                        break
                    text = line.decode("utf-8", errors="replace")
                    if asyncio.iscoroutinefunction(on_output):
                        await on_output(text)
                    else:
                        on_output(text)
                self.is_alive = False
                if on_exit and self.proc:
                    code = await self.proc.wait()
                    if asyncio.iscoroutinefunction(on_exit):
                        await on_exit(code)
                    else:
                        on_exit(code)

            self._read_task = asyncio.create_task(read_windows())

    def write_input(self, text: str):
        if not self.is_alive:
            return
        if os.name == "posix" and self.master_fd is not None:
            try:
                os.write(self.master_fd, text.encode("utf-8"))
            except Exception as e:
                logger.error(f"Error writing to master_fd: {e}")
        elif self.proc and self.proc.stdin:
            try:
                self.proc.stdin.write(text.encode("utf-8"))
            except Exception as e:
                logger.error(f"Error writing to windows process: {e}")

    def resize(self, cols: int, rows: int):
        self.cols = cols
        self.rows = rows
        if os.name == "posix" and self.master_fd is not None:
            try:
                import fcntl
                import termios
                import struct
                winsize = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
            except Exception as e:
                logger.error(f"Error resizing PTY: {e}")

    def stop(self):
        self.is_alive = False
        if os.name == "posix" and self.master_fd is not None:
            try:
                loop = asyncio.get_running_loop()
                loop.remove_reader(self.master_fd)
                os.close(self.master_fd)
            except Exception:
                pass
            self.master_fd = None

        if self.proc:
            try:
                self.proc.terminate()
            except Exception:
                pass


class AgentPTYManager:
    def __init__(self):
        self.sessions: Dict[str, AgentPTYSession] = {}

    async def open_session(self, session_id: str, shell: str, cols: int, rows: int, on_output, on_exit):
        if session_id in self.sessions:
            self.sessions[session_id].stop()
        sess = AgentPTYSession(session_id=session_id, shell=shell, cols=cols, rows=rows)
        self.sessions[session_id] = sess
        await sess.start(on_output=on_output, on_exit=on_exit)

    def write_input(self, session_id: str, data: str):
        if session_id in self.sessions:
            self.sessions[session_id].write_input(data)

    def resize(self, session_id: str, cols: int, rows: int):
        if session_id in self.sessions:
            self.sessions[session_id].resize(cols, rows)

    def close_session(self, session_id: str):
        if session_id in self.sessions:
            self.sessions[session_id].stop()
            del self.sessions[session_id]

agent_pty_manager = AgentPTYManager()
