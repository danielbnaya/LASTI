import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
const U = "UDD-001",
  F = ["BDRS-001", "BDRS-002", "BDRS-003"],
  base = "/api/v1";
const labels = {
  SOURCE: "Menunggu BDRS asal",
  DEST: "Menunggu BDRS tujuan",
  FINAL: "Menunggu UDD",
  TO_UDD: "Menuju UDD",
  INSPECTION: "Pemeriksaan UDD",
  TO_DEST: "Menuju BDRS tujuan",
  DONE: "Selesai",
  ALL_HELD: "Seluruh kantong ditahan",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
  AVAILABLE: "Tersedia",
  RESERVED: "Direservasi",
  PENDING_INSPECTION: "Menunggu pemeriksaan",
  READY_TO_FORWARD: "Siap diteruskan",
  ON_HOLD: "Ditahan",
  USED: "Terpakai",
  PATIENT_RESERVED: "Reservasi pasien",
  APPROVAL: "Persetujuan akhir",
  SOURCE_TO_UDD: "BDRS asal → UDD",
  UDD_TO_DESTINATION: "UDD → BDRS tujuan",
};
const views = [
  "Ringkasan",
  "Persediaan",
  "Prediksi AI",
  "Redistribusi",
  "Notifikasi",
];
const iconPaths = {
  overview: "M3 3h7v7H3z M14 3h7v4h-7z M3 14h7v7H3z M14 11h7v10h-7z",
  bag: "M7 4h10l2 3v10l-3 3H8l-3-3V7z M10 2v2m4-2v2M9 11h6m-3-3v6m0 6v2",
  chart: "M3 3v17h18 M6 15l4-6 4 3 6-7",
  route: "M3 7h16m-4-4 4 4-4 4 M21 17H5m4-4-4 4 4 4",
  bell: "M5 16h14l-2-3V9a5 5 0 0 0-10 0v4z M10 20a2 2 0 0 0 4 0",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 6v6l4 2",
  facility: "M4 21V6h10v15m0-12h5v12M2 21h20M8 10h2m-2 4h2m-2 7v-3h2v3",
  calendar: "M3 6h18v15H3z M7 3v6m10-6v6M3 11h18",
  exit: "M10 4H4v16h6m2-12 4 4-4 4m-4-4h13",
  layers: "M3 8l9-5 9 5-9 5z M3 12l9 5 9-5M3 16l9 5 9-5",
};
const viewIcons = ["overview", "bag", "chart", "route", "bell"];
function Icon({ name }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}
function NetworkDiagram() {
  return (
    <div className="network-diagram" aria-hidden="true">
      <div className="network-hub">
        <span className="mark">✚</span>UDD
      </div>
      <div className="network-links" />
      <div className="network-sites">
        {F.map((f) => (
          <div key={f}>
            <Icon name="facility" />
            <span>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="mark" aria-hidden="true">
        ✚
      </span>
      <span>
        PRC <em>Connect</em>
      </span>
    </div>
  );
}
function Tag({ v }) {
  return (
    <span
      className={
        "tag " +
        (["ON_HOLD", "REJECTED", "CANCELLED", "ALL_HELD"].includes(v)
          ? "bad"
          : [
                "SOURCE",
                "DEST",
                "FINAL",
                "INSPECTION",
                "RESERVED",
                "PENDING_INSPECTION",
                "Menunggu",
                "PATIENT_RESERVED",
              ].includes(v)
            ? "warn"
            : "")
      }
    >
      {labels[v] || v}
    </span>
  );
}
function Stat({ title, value, sub, icon, featured }) {
  return (
    <div className={"stat" + (featured ? " featured" : "")}>
      <div className="stat-title">
        {title}
        <Icon name={icon} />
      </div>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}
function App() {
  const [token, T] = useState(sessionStorage.prc || ""),
    [data, D] = useState(null),
    [page, P] = useState("Ringkasan"),
    [who, W] = useState(U),
    [pass, Q] = useState("demo-prc"),
    [err, E] = useState(""),
    [msg, M] = useState(""),
    [busy, B] = useState(false),
    [period, H] = useState("30d"),
    [focus, K] = useState(""),
    [nonce, N] = useState(0);
  async function api(path, method = "GET", body, auth = token) {
    const r = await fetch(base + path, {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + auth,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const v = await r.json();
    if (!r.ok) {
      if (r.status === 401 && auth) {
        sessionStorage.removeItem("prc");
        T("");
        D(null);
      }
      throw Error(
        typeof v.detail === "string"
          ? v.detail
          : "Input belum sesuai. Periksa semua kolom.",
      );
    }
    return v;
  }
  function go(p) {
    P(p);
    E("");
    M("");
    K("");
  }
  async function reload() {
    D(await api("/dashboard?period=" + period));
    N((n) => n + 1);
  }
  useEffect(() => {
    let live = true;
    if (token)
      api("/dashboard?period=" + period)
        .then((v) => {
          if (live) D(v);
        })
        .catch((e) => {
          if (live) E(e.message);
        });
    return () => {
      live = false;
    };
  }, [token, period]);
  async function run(fn, success = "") {
    if (busy) return;
    B(true);
    E("");
    M("");
    try {
      await fn();
      if (success) M(success);
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  async function login(e) {
    e.preventDefault();
    await run(async () => {
      let v = await api(
        "/login",
        "POST",
        { facilityId: who, password: pass },
        "",
      );
      sessionStorage.prc = v.token;
      T(v.token);
      go("Ringkasan");
    });
  }
  async function logout() {
    await run(async () => {
      await api("/logout", "POST");
      sessionStorage.removeItem("prc");
      D(null);
      T("");
      go("Ringkasan");
    });
  }
  if (!token || !data)
    return (
      <div className="login">
        <div className="login-shell">
          <div className="login-intro">
            <Brand />
            <NetworkDiagram />
            <div>
              <h2>Jejaring bank darah</h2>
              <p>Koordinasi stok PRC antara UDD dan tiga BDRS.</p>
            </div>
          </div>
          <div className="loginbox">
            <h1>Masuk ke jejaring PRC</h1>
            <p>Pilih akun fasilitas untuk membuka ruang kerja Anda.</p>
            <form className="stack" onSubmit={login}>
              <label>
                Akun fasilitas
                <select value={who} onChange={(e) => W(e.target.value)}>
                  {[U, ...F].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label>
                Kata sandi
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => Q(e.target.value)}
                  required
                />
              </label>
              <button className="primary" disabled={busy}>
                Masuk ke dashboard
              </button>
              <small>
                Akun simulasi kelompok · Sandi awal <code>demo-prc</code>
              </small>
            </form>
            {err && (
              <div role="alert" className="notice error">
                {err}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  const user = data.user,
    props = { api, run, busy, reload, user, data, nonce, period, H, M, E };
  const selected = data.plans.find((p) => p.id === focus);
  const open = (p) => {
    P("Redistribusi");
    K(p.id);
    E("");
    M("");
  };
  const sum = (k) => data.metrics.reduce((s, m) => s + m[k], 0);
  const scale = Math.max(
    1,
    ...data.metrics.flatMap((m) => [m.currentStock, m.predictedDemand]),
  );
  const queue = data.plans.filter(
    (p) => !["DONE", "REJECTED", "CANCELLED", "ALL_HELD"].includes(p.stage),
  );
  return (
    <div className="layout">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Menu utama">
          {views.map((v, i) => (
            <button
              key={v}
              aria-current={v === page ? "page" : undefined}
              className={"nav " + (v === page ? "active" : "")}
              onClick={() => go(v)}
            >
              <Icon name={viewIcons[i]} />
              {v}
            </button>
          ))}
        </nav>
        <div className="identity">
          <div className="account-logo">
            <Icon name="facility" />
          </div>
          <div className="account-text">
            <b>{user}</b>
            <small>
              {user === U ? "Koordinator jejaring" : "Petugas bank darah"}
            </small>
          </div>
          <button onClick={logout}>
            <Icon name="exit" />
            Ganti akun
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="top">
          <div className="crumb">
            Operasional <span>/</span> <b>{page}</b>
          </div>
          <span className="sim-date">
            <Icon name="calendar" />
            Simulasi · 25 November 2026
          </span>
        </div>
        <header>
          <h1>
            {selected && page === "Redistribusi"
              ? selected.orderId || selected.id
              : page === "Ringkasan"
                ? "Ringkasan jejaring"
                : page}
          </h1>
          <p>
            {
              {
                Ringkasan: "Ketersediaan PRC dan proses redistribusi aktif.",
                Persediaan:
                  "Catat stok, reservasi pasien, dan pemakaian per kantong.",
                "Prediksi AI":
                  "Perkiraan pemakaian berdasarkan riwayat harian setiap fasilitas.",
                Redistribusi: "Dari usulan pelepasan hingga bukti penerimaan.",
                Notifikasi:
                  "Aktivitas terbaru yang berkaitan dengan fasilitas Anda.",
              }[page]
            }
          </p>
        </header>
        {err && (
          <div role="alert" className="notice error">
            {err}
          </div>
        )}
        {msg && (
          <div role="status" className="notice">
            {msg}
          </div>
        )}
        {page === "Ringkasan" && (
          <>
            <div className="grid">
              <Stat
                featured
                icon="bag"
                title="Stok tersedia"
                value={sum("currentStock")}
                sub="kantong di BDRS"
              />
              <Stat
                icon="clock"
                title="Mendekati kedaluwarsa"
                value={sum("near")}
                sub="sisa masa simpan 5–14 hari"
              />
              <Stat
                icon="route"
                title="Rencana aktif"
                value={queue.length}
                sub="dalam proses koordinasi"
              />
            </div>
            <section className="card">
              <div className="cardhead">
                <h2>Persediaan per fasilitas</h2>
                <button onClick={() => go("Prediksi AI")}>
                  Lihat prediksi →
                </button>
              </div>
              <div className="table-scroll">
                <table className="stock-summary">
                  <thead>
                    <tr>
                      {[
                        "Fasilitas",
                        "Tersedia",
                        "Prediksi " + parseInt(period) + " hari",
                        "Surplus",
                        "Kekurangan",
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.metrics.map((m) => (
                      <tr key={m.facilityId}>
                        <td>
                          <span className="facility-id">
                            <Icon name="facility" />
                            {m.facilityId}
                          </span>
                        </td>
                        {[m.currentStock, m.predictedDemand].map((n, i) => (
                          <td
                            key={i}
                            data-label={
                              i
                                ? "Prediksi " + parseInt(period) + " hari"
                                : "Tersedia"
                            }
                          >
                            <span className="quantity">
                              {n}
                              <span
                                aria-hidden="true"
                                className={"meter meter-" + i}
                              >
                                <i style={{ width: (100 * n) / scale + "%" }} />
                              </span>
                            </span>
                          </td>
                        ))}
                        <td data-label="Surplus">
                          <span
                            className={
                              m.potentialSurplus ? "balance surplus" : "zero"
                            }
                          >
                            {m.potentialSurplus}
                          </span>
                        </td>
                        <td data-label="Kekurangan">
                          <span
                            className={
                              m.potentialShortage ? "balance shortage" : "zero"
                            }
                          >
                            {m.potentialShortage}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="card">
              <div className="cardhead">
                <h2>Rencana aktif</h2>
                <button onClick={() => go("Redistribusi")}>
                  Buka redistribusi →
                </button>
              </div>
              <Plans plans={queue} open={open} />
            </section>
          </>
        )}
        {page === "Persediaan" && <Inventory {...props} />}
        {page === "Prediksi AI" && <Prediction {...props} />}
        {page === "Redistribusi" &&
          (selected ? (
            <Detail
              key={selected.id + selected.stage}
              {...props}
              p={selected}
              back={() => K("")}
            />
          ) : (
            <Redistribution {...props} open={open} />
          ))}
        {page === "Notifikasi" && (
          <section className="card">
            <h2>Riwayat aktivitas</h2>
            {data.notes.length ? (
              <ul className="timeline">
                {data.notes.map((n) => (
                  <li key={n.id}>
                    {n.message}
                    <br />
                    <small>{new Date(n.at).toLocaleString("id-ID")}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty space">
                <Icon name="bell" />
                <p>Belum ada aktivitas tercatat.</p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
function Plans({ plans, open, onCancel, busy }) {
  const [pending, setPending] = useState(null);
  return plans.length ? (
    plans.map((p) => (
      <div className="order" key={p.id}>
        <div>
          <b>{p.orderId || p.id}</b> · {p.src} → {p.dst}
          <br />
          <small>{p.bags.length} kantong · </small>
          <Tag v={p.stage} />
        </div>
        <div className="row">
          <button onClick={() => open(p)}>Detail →</button>
          {onCancel &&
            p.stage === "SOURCE" &&
            !p.decisions.length &&
            (pending === p.id ? (
              <>
                <button disabled={busy} onClick={() => setPending(null)}>
                  Kembali
                </button>
                <button
                  className="alertbtn"
                  disabled={busy}
                  onClick={() => {
                    setPending(null);
                    onCancel(p.id);
                  }}
                >
                  Ya, batalkan {p.id}
                </button>
              </>
            ) : (
              <button
                className="alertbtn"
                disabled={busy}
                onClick={() => setPending(p.id)}
              >
                Batalkan usulan
              </button>
            ))}
        </div>
      </div>
    ))
  ) : (
    <div className="empty">
      <Icon name="route" />
      <div>
        <b>Belum ada rencana</b>
        <p>Usulan dari koordinator UDD akan muncul di sini.</p>
      </div>
    </div>
  );
}
function Inventory({ user, api, run, reload, nonce, busy, E, M }) {
  const [f, S] = useState(user === U ? F[0] : user),
    [bags, A] = useState([]),
    [id, I] = useState(""),
    [expiry, X] = useState("2026-12-20"),
    [status, V] = useState("AVAILABLE"),
    [query, Q] = useState(""),
    [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    let alive = true;
    api("/facilities/" + f + "/prc-stock")
      .then((a) => alive && A(a))
      .catch((e) => E(e.message));
    return () => {
      alive = false;
    };
  }, [f, nonce]);
  const stock = "/facilities/" + f;

  function resetStock() {
    run(async () => {
      const result = await api("/prc-stock/reset", "POST");
      setConfirmReset(false);
      Q("");
      I("");
      M(
        `Stok kembali ke ${result.stockCount} kantong awal. ${result.removedPlans} rencana dihapus.`,
      );
      await reload();
    });
  }

  return (
    <>
      <section className="card">
        <div className="forms">
          <label>
            Fasilitas
            <select value={f} onChange={(e) => S(e.target.value)}>
              {(user === U ? [...F, U] : [user]).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Cari ID kantong
            <input
              value={query}
              onChange={(e) => Q(e.target.value)}
              placeholder="PRC-0021"
            />
          </label>
        </div>
      </section>
      <section className="card">
        <h2>Tambah atau perbarui kantong</h2>
        <form
          className="forms space"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api(stock + "/prc-stock", "PUT", {
                bags: [{ bloodBagId: id, expiresAt: expiry, status }],
              });
              I("");
              await reload();
            }, "Data kantong disimpan.");
          }}
        >
          <label>
            ID kantong
            <input
              required
              pattern="PRC-[0-9]{4,10}"
              value={id}
              onChange={(e) => I(e.target.value)}
              placeholder="PRC-0100"
            />
          </label>
          <label>
            Kedaluwarsa
            <input
              type="date"
              required
              value={expiry}
              onChange={(e) => X(e.target.value)}
            />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => V(e.target.value)}>
              <option value="AVAILABLE">Tersedia</option>
              <option value="PATIENT_RESERVED">Reservasi pasien</option>
            </select>
          </label>
          <button className="primary" disabled={busy}>
            Simpan
          </button>
        </form>
      </section>
      <section className="card">
        <div className="cardhead">
          <h2>Daftar kantong</h2>
          <div className="row">
            <small>{bags.length} kantong · PRC O+</small>
            {user === U && (
              <button
                className="alertbtn"
                disabled={busy}
                aria-expanded={confirmReset}
                onClick={() => setConfirmReset(!confirmReset)}
              >
                Reset stok darah
              </button>
            )}
          </div>
        </div>
        {confirmReset && (
          <div className="notice">
            <h3>Kembalikan stok seluruh fasilitas ke data awal?</h3>
            <p>
              Reset memulihkan 73 kantong simulasi awal di tiga BDRS. Kantong
              tambahan dan seluruh daftar redistribusi di aplikasi akan dihapus.
              Riwayat pemakaian untuk prediksi tetap tersimpan.
            </p>
            <div className="row space">
              <button disabled={busy} onClick={() => setConfirmReset(false)}>
                Kembali ke persediaan
              </button>
              <button className="alertbtn" disabled={busy} onClick={resetStock}>
                Ya, reset stok darah
              </button>
            </div>
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {["ID kantong", "Kedaluwarsa", "Status", "Pemakaian"].map(
                  (x) => (
                    <th key={x}>{x}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {bags
                .filter((b) => b.id.includes(query.toUpperCase()))
                .map((b) => (
                  <tr key={b.id}>
                    <td>{b.id}</td>
                    <td>{b.expiry}</td>
                    <td>
                      <Tag v={b.status} />
                    </td>
                    <td>
                      {["AVAILABLE", "PATIENT_RESERVED"].includes(b.status) && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await api(stock + "/prc-usage", "POST", {
                                bloodBagIds: [b.id],
                              });
                              await reload();
                            }, "Pemakaian tercatat.")
                          }
                        >
                          Catat terpakai
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function Prediction({ data, period, H, user, api, run, busy, reload }) {
  const [f, S] = useState(data.facilities[0]);
  let m = data.metrics.find((x) => x.facilityId === f) || data.metrics[0];
  let max = Math.max(...m.daily, 1);
  return (
    <>
      <section className="card">
        <div className="forms">
          <label>
            Fasilitas
            <select value={f} onChange={(e) => S(e.target.value)}>
              {data.facilities.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Horizon
            <select value={period} onChange={(e) => H(e.target.value)}>
              {[7, 14, 30].map((n) => (
                <option key={n} value={n + "d"}>
                  {n} hari
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api("/prc-predictions", "POST", {
                  facilityId: f,
                  period,
                });
                await reload();
              }, "Prediksi dari model selesai dihitung.")
            }
          >
            Jalankan prediksi
          </button>
        </div>
      </section>
      <div className="grid space">
        <Stat
          featured
          icon="chart"
          title="Perkiraan pemakaian"
          value={m.predictedDemand}
          sub={"kantong dalam " + parseInt(period) + " hari"}
        />
        <Stat
          icon="bag"
          title="Stok tersedia"
          value={m.currentStock}
          sub={"Kiriman masuk · " + m.incoming}
        />
        <Stat
          icon="layers"
          title="Cadangan minimum"
          value="5"
          sub="kantong per BDRS"
        />
      </div>
      <section className="card">
        <h2>Prediksi harian · {m.facilityId}</h2>
        <div className="chart" aria-label="Prediksi harian">
          {m.daily.map((v, i) => (
            <i
              key={i}
              title={"Hari " + (i + 1) + ": " + v.toFixed(2) + " kantong"}
              style={{ height: 4 + (94 * v) / max + "%" }}
            />
          ))}
        </div>
        <div className="row between tiny muted">
          <span>Hari 1</span>
          <span>Hari {m.daily.length}</span>
        </div>
        <div className="notice">
          Potensi surplus <b>{m.potentialSurplus}</b> kantong · Potensi
          kekurangan <b>{m.potentialShortage}</b> kantong
        </div>
      </section>
      <section className="card">
        <h2>Evaluasi regresi linear</h2>
        <p className="space">
          Latih pada {m.train} hari awal, uji pada {m.test} hari terakhir. MAE
          model <b>{m.mae}</b> kantong/hari. MAE pembanding rata-rata{" "}
          <b>{m.baseline}</b>.
        </p>
        <small>
          Prediksi operasional memakai model yang dilatih kembali pada seluruh
          riwayat simulasi.
        </small>
      </section>
    </>
  );
}
function Redistribution({
  api,
  user,
  run,
  busy,
  period,
  data,
  open,
  reload,
  M,
}) {
  const [pairs, A] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (preview) document.getElementById("preview-title")?.focus();
  }, [preview]);

  async function search() {
    setPreview(null);
    A(null);
    A(await api("/prc-redistribution/recommendations?period=" + period));
  }

  function cancel(id) {
    run(
      async () => {
        try {
          await api(
            "/prc-redistribution/plans/" + encodeURIComponent(id) + "/cancel",
            "POST",
          );
        } finally {
          await reload();
        }
        await search();
      },
      "Usulan " + id + " dibatalkan.",
    );
  }
  function resetRedistribution() {
    run(async () => {
      const result = await api("/prc-redistribution/reset", "POST");
      setConfirmReset(false);
      M(
        `${result.removedPlans} rencana dihapus dari daftar. ` +
          `${result.restoredBags} kantong dikembalikan ke persediaan asal.`,
      );
      await reload();
      await search();
    });
  }

  return (
    <>
      {user === U && (
        <section className="card">
          <div className="cardhead">
            <h2>Kandidat redistribusi</h2>
            <button
              className="primary"
              disabled={busy}
              onClick={() => run(search)}
            >
              Cari rekomendasi
            </button>
          </div>
          <p className="muted">
            Periode {parseInt(period)} hari · FEFO · Cadangan minimum 5 kantong
          </p>
          <small>
            Pasangan yang masih diproses dapat dilihat di Daftar rencana.
          </small>
          {pairs &&
            (!pairs.length ? (
              <p className="space">
                Belum ada pasangan baru yang memenuhi kriteria.
              </p>
            ) : (
              pairs.map((r) => (
                <div
                  className="order"
                  key={r.sourceFacilityId + r.destinationFacilityId}
                >
                  <div>
                    <b>
                      {r.sourceFacilityId} → {r.destinationFacilityId}
                    </b>
                    <br />
                    <small>
                      {r.bloodBagIds.length} kantong memenuhi kriteria
                    </small>
                  </div>
                  <button
                    disabled={busy}
                    aria-expanded={preview === r}
                    onClick={() => setPreview(r)}
                  >
                    Buat usulan
                  </button>
                </div>
              ))
            ))}
        </section>
      )}
      {preview && (
        <section className="card" aria-labelledby="preview-title">
          <div className="cardhead">
            <h2 id="preview-title" tabIndex={-1}>
              Ringkasan kantong untuk redistribusi
            </h2>
            <small>{preview.bags.length} kantong</small>
          </div>
          <p>
            {preview.sourceFacilityId} → {preview.destinationFacilityId}
          </p>
          <div className="table-scroll space">
            <table>
              <thead>
                <tr>
                  <th>ID kantong</th>
                  <th>Tanggal kedaluwarsa</th>
                </tr>
              </thead>
              <tbody>
                {preview.bags.map((bag) => (
                  <tr key={bag.bloodBagId}>
                    <td>{bag.bloodBagId}</td>
                    <td>{bag.expiresAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row space">
            <button disabled={busy} onClick={() => setPreview(null)}>
              Kembali ke rekomendasi
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const plan = await api(
                    "/prc-redistribution/recommendations",
                    "POST",
                    preview,
                  );
                  await reload();
                  open(plan);
                })
              }
            >
              Konfirmasi buat usulan
            </button>
          </div>
        </section>
      )}
      <section className="card">
        <div className="cardhead">
          <h2>Daftar rencana</h2>
          <div className="row">
            <small>{data.plans.length} rencana</small>
            {user === U && data.plans.length > 0 && (
              <button
                className="alertbtn"
                disabled={busy}
                aria-expanded={confirmReset}
                onClick={() => setConfirmReset(!confirmReset)}
              >
                Reset data redistribusi
              </button>
            )}
          </div>
        </div>
        {confirmReset && (
          <div className="notice">
            <h3>Mulai ulang pengujian redistribusi?</h3>
            <p>
              Seluruh usulan, pesanan, dan riwayat redistribusi di aplikasi akan
              dihapus. Kantong yang terpengaruh dikembalikan ke persediaan
              awalnya, kecuali yang sudah dipakai atau dicadangkan untuk pasien.
              Bukti lama tetap tercatat di blockchain.
            </p>
            <div className="row space">
              <button disabled={busy} onClick={() => setConfirmReset(false)}>
                Kembali ke daftar
              </button>
              <button
                className="alertbtn"
                disabled={busy}
                onClick={resetRedistribution}
              >
                Ya, reset redistribusi
              </button>
            </div>
          </div>
        )}
        <Plans
          plans={data.plans}
          open={open}
          busy={busy}
          onCancel={user === U ? cancel : null}
        />
      </section>
    </>
  );
}
function Detail({ p, user, api, run, reload, busy, back, M }) {
  const [reason, R] = useState(""),
    [held, H] = useState({}),
    [reasons, Y] = useState({}),
    [entry, A] = useState(""),
    [receiptResult, setReceiptResult] = useState(""),
    [affected, setAffected] = useState(""),
    [receiptReason, setReceiptReason] = useState(""),
    [verified, V] = useState({});
  const approvals = {
    SOURCE: [p.src, "SOURCE_CONFIRMATION"],
    DEST: [p.dst, "DESTINATION_CONFIRMATION"],
    FINAL: [U, "UDD_FINAL_APPROVAL"],
  };
  const [owner, approvalStage] = approvals[p.stage] || [];
  async function decide(decision) {
    await api("/prc-redistribution/approvals", "POST", {
      recommendationId: p.id,
      approvalStage,
      decision,
      note: reason,
    });
    await reload();
  }
  const first = p.stage === "TO_UDD",
    receive =
      (first && user === U) || (p.stage === "TO_DEST" && user === p.dst);
  const expected = first
    ? p.bags
    : p.inspections
        .filter((i) => i.result === "READY_TO_FORWARD")
        .map((i) => i.bag);
  const discrepancy = !first && receiptResult === "DISCREPANCY";
  const parseIds = (value) =>
    value
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);

  function submitReceipt() {
    const bloodBagIds = parseIds(entry);
    run(
      async () => {
        if (discrepancy) {
          await api("/prc-redistribution/receipt-discrepancies", "POST", {
            orderId: p.orderId,
            receivedBagIds: bloodBagIds,
            affectedBagIds: parseIds(affected),
            reason: receiptReason.trim(),
          });
          setAffected("");
          setReceiptReason("");
        } else {
          await api("/prc-redistribution/handovers", "POST", {
            orderId: p.orderId,
            handoverStage: first ? "SOURCE_TO_UDD" : "UDD_TO_DESTINATION",
            bloodBagIds,
          });
        }
        await reload();
      },
      discrepancy
        ? "Ketidaksesuaian dilaporkan ke UDD."
        : "Serah terima disimpan.",
    );
  }

  return (
    <>
      <div className="row">
        <button onClick={back}>← Daftar rencana</button>
        <Tag v={p.stage} />
      </div>
      <section className="card">
        <div className="cardhead">
          <h2>
            {p.src} → {p.dst}
          </h2>
          <small>{p.id}</small>
        </div>
        <p>
          Melalui {U} · {p.bags.length} kantong direncanakan
        </p>
        <details>
          <summary>ID kantong dalam rencana</summary>
          {p.bags.map((b) => (
            <span className="pill" key={b}>
              {b}
            </span>
          ))}
        </details>
      </section>
      <section className="card">
        <h2>Persetujuan tiga pihak</h2>
        <ol className="timeline">
          {[
            [p.src, "SOURCE_CONFIRMATION", "Pelepasan"],
            [p.dst, "DESTINATION_CONFIRMATION", "Kesediaan menerima"],
            [U, "UDD_FINAL_APPROVAL", "Persetujuan akhir"],
          ].map(([f, s, name]) => {
            let d = p.decisions.find((x) => x.stage === s);
            return (
              <li key={s}>
                <b>{f}</b> · {name}{" "}
                <Tag
                  v={
                    d
                      ? d.decision === "APPROVED"
                        ? "Disetujui"
                        : "REJECTED"
                      : "Menunggu"
                  }
                />
                {d && (
                  <div className="tiny muted">
                    {new Date(d.at).toLocaleString("id-ID")} {d.note}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {owner === user && (
          <div className="forms">
            <label>
              Catatan keputusan
              <input
                value={reason}
                onChange={(e) => R(e.target.value)}
                placeholder="Wajib jika ditolak"
              />
            </label>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(() => decide("APPROVED"), "Keputusan disimpan.")
              }
            >
              Setujui rencana
            </button>
            <button
              className="alertbtn"
              disabled={busy}
              onClick={() => run(() => decide("REJECTED"), "Rencana ditolak.")}
            >
              Tolak rencana
            </button>
          </div>
        )}
      </section>
      {p.inspections.length > 0 && (
        <section className="card">
          <h2>Hasil pemeriksaan UDD</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID kantong</th>
                  <th>Keputusan</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {p.inspections.map((i) => (
                  <tr key={i.bag}>
                    <td>{i.bag}</td>
                    <td>
                      <Tag v={i.result} />
                    </td>
                    <td>{i.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {p.receiptReports?.length > 0 && (
        <section className="card">
          <h2>Laporan ketidaksesuaian penerimaan</h2>
          {p.stage === "TO_DEST" && (
            <p className="muted space">
              Menunggu tindak lanjut UDD dan BDRS. Kiriman belum masuk stok
              BDRS.
            </p>
          )}
          <ul className="timeline">
            {p.receiptReports.map((report) => (
              <li key={report.id}>
                <b>{report.actor}</b> ·{" "}
                {new Date(report.at).toLocaleString("id-ID")}
                <p>ID bermasalah: {report.affected.join(", ")}</p>
                <p>
                  ID yang tercatat tiba:{" "}
                  {report.received.join(", ") || "Tidak ada"}
                </p>
                <p>Alasan: {report.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {receive && (
        <section className="card">
          <h2>Konfirmasi penerimaan · {first ? "UDD" : "BDRS tujuan"}</h2>
          <div className="stack space">
            {!first && (
              <label>
                Hasil pemeriksaan penerimaan
                <select
                  value={receiptResult}
                  onChange={(e) => setReceiptResult(e.target.value)}
                >
                  <option value="">Pilih hasil pemeriksaan</option>
                  <option value="MATCH">Kiriman sesuai</option>
                  <option value="DISCREPANCY">Ada ketidaksesuaian</option>
                </select>
              </label>
            )}
            <label>
              ID kantong diterima
              <textarea
                aria-label="ID kantong diterima"
                value={entry}
                onChange={(e) => A(e.target.value)}
                placeholder="Pisahkan ID dengan spasi atau koma"
              />
            </label>
            {discrepancy && (
              <>
                <p className="muted">
                  Masukkan ID yang benar-benar tiba. Kosongkan jika tidak ada
                  kantong yang tiba. Selisih dengan daftar UDD akan dicatat
                  otomatis.
                </p>
                <label>
                  ID kantong bermasalah yang sudah tiba
                  <textarea
                    value={affected}
                    onChange={(e) => setAffected(e.target.value)}
                    placeholder="Isi jika ada masalah pada kantong yang tercatat tiba"
                  />
                </label>
                <label>
                  Alasan ketidaksesuaian
                  <textarea
                    maxLength={400}
                    required
                    value={receiptReason}
                    onChange={(e) => setReceiptReason(e.target.value)}
                  />
                </label>
              </>
            )}
            <div className="buttons">
              <button disabled={busy} onClick={() => A(expected.join(", "))}>
                Isi daftar untuk simulasi
              </button>
              <button
                className="primary"
                disabled={
                  busy ||
                  (!first && !receiptResult) ||
                  (discrepancy && !receiptReason.trim())
                }
                onClick={submitReceipt}
              >
                {discrepancy
                  ? "Laporkan ketidaksesuaian"
                  : "Konfirmasi penerimaan"}
              </button>
            </div>
          </div>
        </section>
      )}
      {p.stage === "INSPECTION" && user === U && (
        <section className="card">
          <h2>Pemeriksaan per kantong</h2>
          <p className="muted space">
            Konfirmasi hasil pemeriksaan untuk setiap kantong.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Kantong</th>
                  <th>Hasil</th>
                  <th>Alasan ditahan</th>
                </tr>
              </thead>
              <tbody>
                {p.bags.map((b) => (
                  <tr key={b}>
                    <td>{b}</td>
                    <td>
                      <select
                        aria-label={"Hasil " + b}
                        value={held[b] || ""}
                        onChange={(e) => H({ ...held, [b]: e.target.value })}
                      >
                        <option value="">Pilih hasil</option>
                        <option value="READY_TO_FORWARD">
                          Siap diteruskan
                        </option>
                        <option value="ON_HOLD">Ditahan</option>
                      </select>
                    </td>
                    <td>
                      {held[b] === "ON_HOLD" && (
                        <input
                          aria-label={"Alasan " + b}
                          value={reasons[b] || ""}
                          onChange={(e) =>
                            Y({ ...reasons, [b]: e.target.value })
                          }
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="primary space"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api("/prc-redistribution/inspections", "POST", {
                  orderId: p.orderId,
                  items: p.bags.map((b) => ({
                    bloodBagId: b,
                    result: held[b],
                    reason: reasons[b] || "",
                  })),
                });
                await reload();
              }, "Hasil pemeriksaan disimpan.")
            }
          >
            Simpan hasil pemeriksaan
          </button>
        </section>
      )}
      {p.orderId && (
        <section className="card">
          <div className="cardhead">
            <h2>Riwayat blockchain</h2>
            <small>Hardhat lokal · chain 31337</small>
          </div>
          {p.events.map((e) => (
            <div className="order" key={e.id}>
              <div>
                <b>{labels[e.payload.event]}</b> · {e.payload.quantity} kantong
                <div className="tiny muted">
                  {e.payload.by} ·{" "}
                  {new Date(e.payload.at).toLocaleString("id-ID")}
                </div>
                <div className="hash">
                  {e.tx || "Menunggu pencatatan pada node lokal"}
                </div>
                <details>
                  <summary>Daftar kantong</summary>
                  {e.payload.bloodBagIds.join(", ")}
                </details>
              </div>
              {e.tx ? (
                <button
                  className={
                    verified[e.id] === "Bukti berbeda" ? "alertbtn" : ""
                  }
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      let r = await api(
                        "/ledger/verify/" + p.orderId + "/" + e.payload.event,
                      );
                      V({
                        ...verified,
                        [e.id]: r.verified
                          ? "Terverifikasi ✓"
                          : "Bukti berbeda",
                      });
                    })
                  }
                >
                  {verified[e.id] || "Verifikasi"}
                </button>
              ) : (
                user === U && (
                  <button
                    onClick={() =>
                      run(async () => {
                        let r = await api("/ledger/retry", "POST");
                        await reload();
                        M(
                          r.pending
                            ? "Node belum siap. Pastikan Hardhat dan kontrak aktif."
                            : "Pencatatan selesai.",
                        );
                      })
                    }
                  >
                    Coba catat ulang
                  </button>
                )
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
