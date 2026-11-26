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
function Brand() {
  return (
    <div className="brand">
      <span className="mark">✚</span>PRC Connect
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
          : ["SOURCE", "DEST", "FINAL", "INSPECTION", "RESERVED"].includes(v)
            ? "warn"
            : "")
      }
    >
      {labels[v] || v}
    </span>
  );
}
function Stat({ title, value, sub }) {
  return (
    <div className="stat">
      <small>{title}</small>
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
        <div className="loginbox">
          <Brand />
          <h1>Masuk ke jejaring PRC</h1>
          <p>
            Kelola persediaan dan koordinasikan redistribusi antar fasilitas.
          </p>
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
          {err && <div className="notice error">{err}</div>}
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
  const queue = data.plans.filter(
    (p) => !["DONE", "REJECTED", "CANCELLED", "ALL_HELD"].includes(p.stage),
  );
  return (
    <div className="layout">
      <aside className="sidebar">
        <Brand />
        <nav>
          {views.map((v, i) => (
            <button
              key={v}
              className={"nav " + (v === page ? "active" : "")}
              onClick={() => go(v)}
            >
              <span>{["▦", "▤", "∿", "⇆", "◷"][i]}</span>
              {v}
            </button>
          ))}
        </nav>
        <div className="identity">
          <b>{user}</b>
          <small>
            {user === U ? "Koordinator jejaring" : "Petugas bank darah"}
          </small>
          <button onClick={logout}>Ganti akun</button>
        </div>
      </aside>
      <main className="main">
        <div className="top">
          <b>Operasional / {page}</b>
          <span>Simulasi · 25 November 2026</span>
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
                title="Stok tersedia"
                value={sum("currentStock")}
                sub="kantong di BDRS"
              />
              <Stat
                title="Mendekati kedaluwarsa"
                value={sum("near")}
                sub="sisa masa simpan 5–14 hari"
              />
              <Stat
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
              <table>
                <thead>
                  <tr>
                    {[
                      "Fasilitas",
                      "Tersedia",
                      "Prediksi " + period,
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
                        <b>{m.facilityId}</b>
                      </td>
                      <td>{m.currentStock}</td>
                      <td>{m.predictedDemand}</td>
                      <td>{m.potentialSurplus}</td>
                      <td>{m.potentialShortage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <p className="muted space">Belum ada aktivitas tercatat.</p>
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
    <p className="muted">
      Belum ada rencana. Koordinator UDD dapat membuat usulan dari menu
      Redistribusi.
    </p>
  );
}
function Inventory({ user, api, run, reload, nonce, busy, E }) {
  const [f, S] = useState(user === U ? F[0] : user),
    [bags, A] = useState([]),
    [id, I] = useState(""),
    [expiry, X] = useState("2026-12-20"),
    [status, V] = useState("AVAILABLE"),
    [query, Q] = useState("");
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
          <small>{bags.length} kantong · PRC O+</small>
        </div>
        <table>
          <thead>
            <tr>
              {["ID kantong", "Kedaluwarsa", "Status", "Pemakaian"].map((x) => (
                <th key={x}>{x}</th>
              ))}
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
          title="Perkiraan pemakaian"
          value={m.predictedDemand}
          sub={"kantong dalam " + period}
        />
        <Stat
          title="Stok tersedia"
          value={m.currentStock}
          sub={"Kiriman masuk · " + m.incoming}
        />
        <Stat title="Cadangan minimum" value="5" sub="kantong per BDRS" />
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
function Redistribution({ api, user, run, busy, period, data, open, reload }) {
  const [pairs, A] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (preview) document.getElementById("preview-title")?.focus();
  }, [preview]);

  async function search() {
    setPreview(null);
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
      },
      "Usulan " + id + " dibatalkan.",
    );
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
            Periode {period} · FEFO · Cadangan minimum 5 kantong
          </p>
          {pairs &&
            (!pairs.length ? (
              <p className="space">
                Belum ada pasangan yang memenuhi kriteria.
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
          <table className="space">
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
          <small>{data.plans.length} rencana</small>
        </div>
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
      {receive && (
        <section className="card">
          <h2>Konfirmasi penerimaan · {first ? "UDD" : "BDRS tujuan"}</h2>
          <p className="muted space">
            Masukkan ID kantong yang diterima, dipisahkan spasi atau koma.
          </p>
          <div className="stack space">
            <textarea
              aria-label="ID kantong diterima"
              value={entry}
              onChange={(e) => A(e.target.value)}
            />
            <div className="buttons">
              <button onClick={() => A(expected.join(", "))}>
                Isi daftar untuk simulasi
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("/prc-redistribution/handovers", "POST", {
                      orderId: p.orderId,
                      handoverStage: first
                        ? "SOURCE_TO_UDD"
                        : "UDD_TO_DESTINATION",
                      bloodBagIds: entry
                        .trim()
                        .split(/[\s,]+/)
                        .filter(Boolean),
                    });
                    await reload();
                  }, "Serah terima disimpan.")
                }
              >
                Konfirmasi penerimaan
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
                      <option value="READY_TO_FORWARD">Siap diteruskan</option>
                      <option value="ON_HOLD">Ditahan</option>
                    </select>
                  </td>
                  <td>
                    {held[b] === "ON_HOLD" && (
                      <input
                        aria-label={"Alasan " + b}
                        value={reasons[b] || ""}
                        onChange={(e) => Y({ ...reasons, [b]: e.target.value })}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      {p.inspections.length > 0 && (
        <section className="card">
          <h2>Hasil pemeriksaan UDD</h2>
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
