"""Hardhat lokal. SQLite menyimpan payload, kontrak mengikat digest dan kunci peristiwa."""

import hashlib
import json
import urllib.request
from pathlib import Path


def rpc(method, params):
    body = json.dumps(dict(jsonrpc="2.0", id=1, method=method, params=params)).encode()
    req = urllib.request.Request(
        "http://127.0.0.1:8545", body, {"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=3) as response:
        result = json.load(response)
    if "error" in result:
        raise ValueError(result["error"]["message"])
    return result["result"]


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def context(directory):
    config = json.loads((Path(directory) / "contract.json").read_text())
    if rpc("eth_getCode", [config["address"], "latest"]) == "0x":
        raise ValueError("Kontrak tidak aktif pada node lokal")
    return config


def inspect(config, key):
    data = "0x" + config["selectors"]["evidence(bytes32)"] + key
    return rpc("eth_call", [{"to": config["address"], "data": data}, "latest"])


def commit(directory, event):
    config = context(directory)
    key = digest(event["id"])
    value = digest(event["payload"])
    existing = inspect(config, key)
    if int(existing, 16):
        if existing != "0x" + value:
            raise ValueError("Bukti berbeda dari catatan pesanan")
        logs = rpc(
            "eth_getLogs",
            [
                {
                    "address": config["address"],
                    "fromBlock": "0x0",
                    "toBlock": "latest",
                    "topics": [None, "0x" + key],
                }
            ],
        )
        tx = logs[0]["transactionHash"]
        archive_tx(directory, tx)
        return tx
    data = "0x" + config["selectors"]["record(bytes32,bytes32)"] + key + value
    tx = rpc(
        "eth_sendTransaction",
        [
            {
                "from": config["account"],
                "to": config["address"],
                "data": data,
                "gas": "0x40000",
            }
        ],
    )
    receipt = rpc("eth_getTransactionReceipt", [tx])
    if not receipt or receipt["status"] != "0x1":
        raise ValueError("Transaksi belum terkonfirmasi")
    archive_tx(directory, tx)
    return tx


def verify(directory, event):
    cfg = context(directory)
    receipt = rpc("eth_getTransactionReceipt", [event["tx"]])
    if not receipt:
        return False
    key = digest(event["id"])
    value = digest(event["payload"])
    logs = receipt.get("logs", [])
    linked = any(
        log["address"].lower() == cfg["address"].lower()
        and len(log["topics"]) == 2
        and log["topics"][1] == "0x" + key
        and log["data"] == "0x" + value
        for log in logs
    )
    return receipt["status"] == "0x1" and linked and inspect(cfg, key) == "0x" + value


def _rlp(item):
    """Ethereum RLP for the signed EIP-1559 transactions emitted by this demo."""
    if isinstance(item, int):
        item = item.to_bytes((item.bit_length() + 7) // 8, "big")
    if isinstance(item, list):
        content = b"".join(_rlp(value) for value in item)
        offset = 192
    else:
        content = item
        if len(content) == 1 and content[0] < 128:
            return content
        offset = 128
    size = len(content)
    if size < 56:
        return bytes([offset + size]) + content
    length = size.to_bytes((size.bit_length() + 7) // 8, "big")
    return bytes([offset + 55 + len(length)]) + length + content


def archive_tx(directory, tx_hash):
    tx = rpc("eth_getTransactionByHash", [tx_hash])
    if tx["type"] != "0x2" or tx["accessList"]:
        raise ValueError("Format transaksi lokal tidak sesuai")

    def num(key):
        return int(tx[key], 16)

    def blob(value):
        return bytes.fromhex((value or "0x")[2:])

    fields = [
        num("chainId"),
        num("nonce"),
        num("maxPriorityFeePerGas"),
        num("maxFeePerGas"),
        num("gas"),
        blob(tx["to"]),
        num("value"),
        blob(tx["input"]),
        [],
        num("v"),
        num("r"),
        num("s"),
    ]
    raw = "0x02" + _rlp(fields).hex()
    folder = Path(directory) / "journal"
    folder.mkdir(exist_ok=True)
    path = folder / f"{num('nonce'):08d}.json"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(canonical(dict(hash=tx_hash, raw=raw)))
    tmp.replace(path)


def restore(directory):
    for path in sorted((Path(directory) / "journal").glob("*.json")):
        record = json.loads(path.read_text())
        if rpc("eth_getTransactionReceipt", [record["hash"]]):
            continue
        actual = rpc("eth_sendRawTransaction", [record["raw"]])
        if actual != record["hash"]:
            raise ValueError("Hash transaksi pemulihan berbeda")
