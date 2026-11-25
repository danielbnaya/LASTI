"""Peluncur lokal lintas platform. Menjalankan satu node, satu kontrak, dan satu server."""

import argparse, json, os, shutil, socket, subprocess, sys, time
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
    parser.add_argument("--port", type=int, default=8000, help="Port HTTP dashboard (default 8000)")
    parser.add_argument("--no-browser", action="store_true", help=argparse.SUPPRESS)
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
    if not 1 <= args.port <= 65535 or args.port == 8545:
        raise RuntimeError("Pilih port HTTP 1-65535 selain 8545 (Hardhat).")
    if not args.test and port_open(args.port):
        raise RuntimeError(f"Port {args.port} sedang dipakai. Coba start.py --port {8001 if args.port != 8001 else 8002}.")
    print("Memeriksa node blockchain lokal di port 8545 ...", flush=True)
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
                raise RuntimeError(f"Hardhat berhenti. Periksa {directory / 'hardhat.log'}.")
            if port_open(8545):
                break
            time.sleep(0.15)
        else:
            raise RuntimeError(f"Hardhat belum siap di port 8545. Periksa {directory / 'hardhat.log'}.")
        if ledger.rpc("eth_chainId", []) != "0x7a69":
            raise RuntimeError("Port 8545 harus memakai jaringan lokal 31337.")
        ledger.restore(directory)
        subprocess.run([node, "chain/deploy.cjs"], check=True)
        cfg = json.loads((directory / "contract.json").read_text())
        ledger.archive_tx(directory, cfg["deployTx"])
        if args.test:
            return subprocess.call([sys.executable, "tests/demo.py"])
        print("Menyiapkan dashboard. Tunggu pesan 'Uvicorn running on' di bawah.", flush=True)
        import uvicorn

        uvicorn.run("app:app", host="127.0.0.1", port=args.port)
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
