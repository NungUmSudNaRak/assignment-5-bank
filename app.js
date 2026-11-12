import { BrowserProvider, Contract, formatEther, parseEther } from "https://cdn.jsdelivr.net/npm/ethers@6.15.0/+esm";
const address = "0xe09a15f3aC2Ef6652Cc1Edc776fB11294CC2eDF8";
const hoodi = "0x88bb0";
const abi = ["function deposit() payable", "function withdraw(uint256)", "function checkBlance() view returns (uint256)"];
const wallet = window.ethereum?.providers?.find(p => p.isMetaMask) ?? window.ethereum;
const el = id => document.getElementById(id);
const controls = ["deposit", "withdraw", "check"].map(el);
let bank, busy = false;
el("contract").textContent = address;
function sync() {
  controls.forEach(button => button.disabled = busy || !bank);
  el("connect").disabled = busy;
}
function reset() {
  bank = undefined;
  el("account").textContent = "ยังไม่ได้เชื่อมต่อ";
  el("balance").textContent = "—";
  sync();
}
function action(fn) {
  return async () => {
    if (busy) return;
    busy = true;
    sync();
    try { await fn(); }
    catch (e) { el("status").textContent = e.shortMessage ?? e.message; }
    finally { busy = false; sync(); }
  };
}
async function refresh() {
  const current = bank;
  const value = await current.checkBlance();
  if (current === bank) el("balance").textContent = formatEther(value) + " ETH";
}
el("connect").onclick = action(async () => {
  reset();
  if (!wallet?.isMetaMask) throw new Error("กรุณาเปิดเว็บในเบราว์เซอร์ที่มี MetaMask");
  await wallet.request({method:"eth_requestAccounts"});
  if (await wallet.request({method:"eth_chainId"}) !== hoodi) {
    await wallet.request({method:"wallet_switchEthereumChain",params:[{chainId:hoodi}]});
  }
  const provider = new BrowserProvider(wallet);
  if (await provider.getCode(address) === "0x") throw new Error("ไม่พบสัญญาบน Hoodi");
  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  bank = new Contract(address, abi, signer);
  el("account").textContent = account;
  await refresh();
  el("status").textContent = "เชื่อมต่อแล้ว";
});
el("check").onclick = action(refresh);
for (const name of ["deposit", "withdraw"]) {
  el(name).onclick = action(async () => {
    const amount = parseEther(el("amount").value.trim());
    if (amount <= 0n) throw new Error("ระบุจำนวนมากกว่า 0");
    if (await wallet.request({method:"eth_chainId"}) !== hoodi || !bank) throw new Error("เชื่อมต่อ Hoodi อีกครั้ง");
    const current = bank;
    el("status").textContent = "รอยืนยันใน MetaMask";
    const tx = name === "deposit" ? await current.deposit({value:amount}) : await current.withdraw(amount);
    el("status").textContent = "รอยืนยันธุรกรรม " + tx.hash;
    await tx.wait();
    if (current === bank) await refresh();
    el("status").textContent = "ธุรกรรมสำเร็จ " + tx.hash;
  });
}
wallet?.on?.("accountsChanged", reset);
wallet?.on?.("chainChanged", reset);
