"""Peluncur lokal lintas platform. Menjalankan satu node, satu kontrak, dan satu server."""

import argparse, json, os, shutil, socket, subprocess, sys, time, webbrowser
from pathlib import Path
import ledger

BASE = Path(__file__).resolve().parent
os.chdir(BASE)
DATA = Path(os.environ.get("PRC_DATA", BASE / "data")).resolve()
os.environ["PRC_DATA"] = str(DATA)


def port_open(port):
    with socket.socket() as s:
        s.settimeout(0.25)
        return s.connect_ex(("127.0.0.1", port)) == 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--test", action="store_true", help="Uji integrasi di folder data sementara"
    )
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if args.test:
        import tempfile

        temp = tempfile.TemporaryDirectory(prefix="prc-test-")
        directory = Path(temp.name)
        os.environ["PRC_DATA"] = str(directory)
        if port_open(8545):
            raise RuntimeError("Tutup node demo sebelum menjalankan uji terisolasi.")
    else:
        directory = DATA
    directory.mkdir(exist_ok=True, parents=True)
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Instal Node.js 22 LTS terlebih dahulu.")
    cli = BASE / "node_modules/hardhat/internal/cli/cli.js"
    if not cli.exists():
        raise RuntimeError("Jalankan npm ci di folder proyek.")
    if not args.test and port_open(8000):
        raise RuntimeError("Port 8000 sedang dipakai.")
    child = None
    logfile = (directory / "hardhat.log").open("a", encoding="utf8")
    try:
        if not port_open(8545):
            child = subprocess.Popen(
                [node, str(cli), "node", "--hostname", "127.0.0.1"],
                stdout=logfile,
                stderr=subprocess.STDOUT,
            )
        for _ in range(80):
            if child and child.poll() is not None:
                raise RuntimeError("Hardhat berhenti. Lihat hardhat.log.")
            if port_open(8545):
                break
            time.sleep(0.15)
        if ledger.rpc("eth_chainId", []) != "0x7a69":
            raise RuntimeError("Port 8545 harus memakai jaringan lokal 31337.")
        ledger.restore(directory)
        subprocess.run([node, "chain/deploy.cjs"], check=True)
        cfg = json.loads((directory / "contract.json").read_text())
        ledger.archive_tx(directory, cfg["deployTx"])
        if args.test:
            return subprocess.call([sys.executable, "tests/demo.py"])
        if not args.no_browser:
            import threading

            threading.Timer(2, lambda: webbrowser.open("http://127.0.0.1:8000")).start()
        import uvicorn

        print(
            "Dashboard http://127.0.0.1:8000 · API http://127.0.0.1:8000/docs",
            flush=True,
        )
        uvicorn.run("app:app", host="127.0.0.1", port=8000)
    finally:
        if child:
            child.terminate()
            try:
                child.wait(timeout=6)
            except subprocess.TimeoutExpired:
                child.kill()
        logfile.close()
        if args.test:
            temp.cleanup()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print("Gagal menjalankan prototipe:", e, file=sys.stderr)
        sys.exit(1)
