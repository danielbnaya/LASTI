const fs = require("node:fs");
const solc = require("solc");
const path = require("node:path");
const dir = process.env.PRC_DATA || "data";
const configPath = path.join(dir, "contract.json");
async function rpc(method, params = []) {
  const res = await fetch("http://127.0.0.1:8545", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw Error(data.error.message);
  return data.result;
}
async function deploy() {
  if ((await rpc("eth_chainId")) !== "0x7a69")
    throw Error("Gunakan node Hardhat lokal 31337.");
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(configPath)) {
    const old = JSON.parse(fs.readFileSync(configPath));
    if ((await rpc("eth_getCode", [old.address, "latest"])) !== "0x") {
      console.log("Kontrak tersedia:", old.address);
      return;
    }
    if (fs.existsSync(path.join(dir, "prc.sqlite")))
      throw Error(
        "Node dimulai ulang. Arsipkan folder data untuk sesi demo baru atau pulihkan node lama.",
      );
  }
  const file = "PRCRedistributionLedger.sol";
  const input = {
    language: "Solidity",
    sources: { [file]: { content: fs.readFileSync("chain/" + file, "utf8") } },
    settings: {
      evmVersion: "paris",
      outputSelection: {
        "*": { "*": ["evm.bytecode.object", "evm.methodIdentifiers"] },
      },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const evm = output.contracts[file].PRCRedistributionLedger.evm;
  const [account] = await rpc("eth_accounts");
  const tx = await rpc("eth_sendTransaction", [
    { from: account, data: "0x" + evm.bytecode.object, gas: "0x300000" },
  ]);
  const receipt = await rpc("eth_getTransactionReceipt", [tx]);
  if (receipt?.status !== "0x1") throw Error("Deployment gagal");
  const config = {
    account,
    address: receipt.contractAddress,
    deployTx: tx,
    selectors: evm.methodIdentifiers,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("Kontrak aktif:", config.address);
}
deploy().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
