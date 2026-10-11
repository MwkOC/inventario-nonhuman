import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Boxes,
  Users,
  LogIn,
  LogOut,
  UserRoundCheck,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Plus,
  Bell,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  X,
  Menu,
  ArrowRight,
  Package,
  Clock3,
  Check,
  Download,
  Upload,
  SlidersHorizontal,
  Mail,
  ShieldCheck,
  History,
  Cpu,
  CheckCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import "./style.css";

let csrf = "";
async function api(action, body, form = false) {
  const response = await fetch(`/api/${action}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body === undefined
        ? {}
        : {
            ...(!form ? { "Content-Type": "application/json" } : {}),
            "X-CSRFToken": csrf,
            "Idempotency-Key": crypto.randomUUID(),
          },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "No se pudo completar la solicitud." }));
  if (data.csrf) csrf = data.csrf;
  if (!response.ok)
    throw Object.assign(new Error(data.error || "Error de conexion"), {
      status: response.status,
    });
  return data;
}
const roles = {
  admin: "Administrador",
  member: "Miembro",
  external: "Externo",
};
const initials = (name) =>
  (name || "")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "short",
        timeZone: "America/Lima",
      }).format(new Date(value))
    : "—";
const hour = (value) =>
  value
    ? new Intl.DateTimeFormat("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Lima",
      }).format(new Date(value))
    : "—";
const dayKey = (value) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(
    new Date(value),
  );
function Badge({ children, tone = "green" }) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
function Avatar({ name, small = false }) {
  return (
    <span className={`avatar ${small ? "small" : ""}`}>{initials(name)}</span>
  );
}
function Empty({ text = "Todavia no hay registros." }) {
  return (
    <div className="empty">
      <Package size={28} />
      <p>{text}</p>
    </div>
  );
}
function IconButton({ icon: Icon, label, onClick, ...props }) {
  return (
    <button
      className="icon-btn"
      title={label}
      aria-label={label}
      onClick={onClick}
      {...props}
    >
      <Icon size={18} />
    </button>
  );
}
function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <IconButton icon={X} label="Cerrar" onClick={onClose} />
      </div>
      {children}
    </dialog>
  );
}
function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
function Login({ onLogin, demo }) {
  const params = new URLSearchParams(location.search);
  const [mode, setMode] = useState(params.has("token") ? "reset" : "login");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mode === "login") {
        const r = await api("login", data);
        onLogin(r.user);
      } else if (mode === "recover") {
        await api("recover", data);
        setMessage(
          "Si el correo tiene una cuenta activa, recibiras un enlace para recuperar tu acceso.",
        );
      } else {
        await api("set-password", {
          ...data,
          uid: params.get("uid"),
          token: params.get("token"),
        });
        history.replaceState(null, "", "/");
        setMode("login");
        setMessage("Contrasena guardada. Ya puedes iniciar sesion.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-brand">
        <span className="wordmark">NONHUMAN</span>
        <span className="muted">LABORATORIO</span>
      </div>
      <main className="login-box">
        <div className="login-mark">
          <Cpu size={30} />
        </div>
        <h1>
          {mode === "login"
            ? "Iniciar sesion"
            : mode === "recover"
              ? "Recupera tu acceso"
              : "Crea tu contrasena"}
        </h1>
        <p className="muted">
          {mode === "login"
            ? "Acceso al laboratorio"
            : mode === "recover"
              ? "Ingresa el correo asociado a tu cuenta."
              : "Elige una contrasena de al menos 10 caracteres."}
        </p>
        <form onSubmit={submit}>
          {mode === "login" ? (
            <>
              <Field
                label="DNI"
                name="dni"
                inputMode="numeric"
                pattern="[0-9]{8}"
                maxLength={8}
                required
                autoComplete="username"
              />
              <Field
                label="Contrasena"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </>
          ) : mode === "recover" ? (
            <Field
              label="Correo personal"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          ) : (
            <Field
              label="Nueva contrasena"
              name="password"
              type="password"
              minLength={10}
              required
              autoComplete="new-password"
            />
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="form-success" role="status">
              {message}
            </div>
          )}
          <button className="btn primary wide" disabled={busy}>
            {busy
              ? "Un momento…"
              : mode === "login"
                ? "Iniciar sesion"
                : mode === "recover"
                  ? "Enviar enlace"
                  : "Guardar contrasena"}
            <ArrowRight size={17} />
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setMode(mode === "login" ? "recover" : "login");
            setMessage("");
            setError("");
          }}
        >
          {mode === "login"
            ? "Olvide mi contrasena"
            : "Volver al inicio de sesion"}
        </button>
        {demo && (
          <div className="demo-access">
            <Badge tone="amber">Entorno de demostracion</Badge>
            <p>
              Admin <b>10000001</b> · Miembro <b>10000006</b>
              <br />
              Externo <b>10000016</b>
            </p>
            <p>
              Contrasena: <code>NonHuman2026!</code>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null),
    [data, setData] = useState(null),
    [ready, setReady] = useState(false),
    [demo, setDemo] = useState(false);
  const [page, setPage] = useState("dashboard"),
    [theme, setTheme] = useState(
      localStorage.getItem("nh-theme") ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    );
  const [menu, setMenu] = useState(false),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [category, setCategory] = useState("Todos"),
    [view, setView] = useState("grid"),
    [cart, setCart] = useState({}),
    [week, setWeek] = useState(0),
    [peopleFilter, setPeopleFilter] = useState("all");
  const [importRows, setImportRows] = useState(null),
    [importBusy, setImportBusy] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("nh-theme", theme);
  }, [theme]);
  useEffect(() => {
    api("session")
      .then((r) => {
        setUser(r.user);
        setDemo(r.demo);
        setPage(r.user?.role === "admin" ? "dashboard" : "attendance");
      })
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
  }, []);
  async function refresh() {
    try {
      const d = await api("state");
      setData(d);
      setUser(d.user);
    } catch (e) {
      if (e.status === 401) {
        setUser(null);
        setData(null);
        api("session").catch(() => {});
      }
      setError(e.message);
    }
  }
  useEffect(() => {
    if (user) {
      refresh();
      const id = setInterval(refresh, 30000);
      return () => clearInterval(id);
    }
  }, [user?.id]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  function navigate(p) {
    setPage(p);
    setSearch("");
    setMenu(false);
    setCategory("Todos");
  }
  function open(m) {
    setError("");
    setModal(m);
  }
  async function act(action, body = {}, close = true) {
    setBusy(true);
    setError("");
    try {
      const r = await api(action, body);
      await refresh();
      if (close) setModal(null);
      setToast(
        r.open_visits
          ? `Salida registrada. Tienes ${r.open_visits} visita(s) abierta(s). Recuerda registrar su salida.`
          : "Registro guardado",
      );
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function signout() {
    await api("logout", {});
    setUser(null);
    setData(null);
    setPage("dashboard");
    setCart({});
  }
  function download(rows, name) {
    const keys = Object.keys(rows[0] || {});
    const clean = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""') +
      '"';
    const content = [
      keys.map(clean).join(","),
      ...rows.map((r) => keys.map((k) => clean(r[k])).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!ready)
    return (
      <div className="loading">
        NONHUMAN <span>Cargando…</span>
      </div>
    );
  if (!user)
    return (
      <Login
        demo={demo}
        onLogin={(u) => {
          setUser(u);
          setPage(u.role === "admin" ? "dashboard" : "attendance");
        }}
      />
    );
  if (!data)
    return (
      <div className="loading">
        NONHUMAN{" "}
        {error ? (
          <button onClick={refresh}>{error} · Reintentar</button>
        ) : (
          <span>Cargando laboratorio…</span>
        )}
      </div>
    );
  const admin = user.role === "admin",
    external = user.role === "external";
  const items = data.items || [],
    loans = data.loans || [],
    visits = data.visits || [],
    people = data.people || [],
    notifications = data.notifications || [];
  const pending = loans.filter((l) => !l.consumable && l.returned < l.quantity);
  const unread = notifications.filter((n) => !n.read).length;
  const activeVisits = visits.filter((v) => !v.exited);
  const nav = [
    ...(admin ? [["dashboard", "Resumen", LayoutDashboard]] : []),
    ["attendance", "Mi asistencia", LogIn],
    ...(!external
      ? [
          ["inventory", "Inventario", Boxes],
          ["loans", admin ? "Prestamos" : "Mis prestamos", ArrowUpRight],
          ["visits", "Visitas", UserRoundCheck],
        ]
      : []),
    ...(admin
      ? [
          ["people", "Personas", Users],
          ["notifications", "Notificaciones", Bell],
          ["history", "Actividad", History],
        ]
      : []),
  ];
  const filteredItems = items.filter(
    (i) =>
      (category === "Todos" || i.category === category) &&
      `${i.name} ${i.code} ${i.location}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const current = new Date();
  const limaDate = new Date(
    current.toLocaleString("en-US", { timeZone: "America/Lima" }),
  );
  const monday = new Date(
    limaDate.getFullYear(),
    limaDate.getMonth(),
    limaDate.getDate() - ((limaDate.getDay() + 6) % 7) + week * 7,
    12,
  );
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      key,
      name: ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"][i],
      Miembros: data.attendance.filter(
        (a) => dayKey(a.entered) === key && a.role !== "external",
      ).length,
      Externos: data.attendance.filter(
        (a) => dayKey(a.entered) === key && a.role === "external",
      ).length,
      Visitas: visits.filter((v) => dayKey(v.entered) === key).length,
    };
  });
  const weekTotal = days.reduce(
    (s, d) => s + d.Miembros + d.Externos + d.Visitas,
    0,
  );
  const inside = data.attendance.filter((a) => !a.exited);
  const low = items.filter((i) => i.available <= i.minimum);
  function productImage(item) {
    return (
      <div className="product-image">
        <img
          src={item.image || "/assets/placeholder.png"}
          alt={item.name}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/assets/placeholder.png";
          }}
        />
      </div>
    );
  }
  function loanTable(list) {
    return list.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Articulo</th>
              {admin && <th>Responsable</th>}
              <th>Cantidad</th>
              <th>Devolucion</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((l) => {
              const left = l.quantity - l.returned,
                late = l.due && new Date(l.due) < new Date();
              return (
                <tr key={l.id}>
                  <td>
                    <strong>{l.item}</strong>
                    <small>{l.reason}</small>
                  </td>
                  {admin && (
                    <td>
                      <span className="person-inline">
                        <Avatar name={l.name} small />
                        {l.name}
                      </span>
                    </td>
                  )}
                  <td>
                    {l.consumable ? l.quantity : `${left} / ${l.quantity}`}
                  </td>
                  <td>{date(l.due)}</td>
                  <td>
                    <Badge
                      tone={
                        l.consumable
                          ? "gray"
                          : !left
                            ? "green"
                            : late
                              ? "red"
                              : "amber"
                      }
                    >
                      {l.consumable
                        ? "Consumo"
                        : !left
                          ? "Devuelto"
                          : late
                            ? "Vencido"
                            : "En prestamo"}
                    </Badge>
                  </td>
                  <td>
                    {left > 0 && !l.consumable && l.user_id === user.id && (
                      <button
                        className="btn small-btn"
                        onClick={() => open({ type: "return", loan: l })}
                      >
                        Devolver
                        <ArrowDownLeft size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty text="No hay prestamos para mostrar." />
    );
  }
  return (
    <div className="app-shell">
      {menu && (
        <div className="sidebar-backdrop" onClick={() => setMenu(false)} />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate(admin ? "dashboard" : "attendance");
          }}
          className="brand"
        >
          <span className="wordmark">NONHUMAN</span>
          <span className="brand-sub">LABORATORIO</span>
        </a>
        <div className="workspace">
          <div className="workspace-logo">
            <Cpu size={20} />
          </div>
          <div>
            <strong>Laboratorio</strong>
            <small>NonHuman · Lima</small>
          </div>
          <span className="status-dot" />
        </div>
        <span className="nav-caption">MENU</span>
        <nav>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => navigate(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {key === "notifications" && unread > 0 && (
                <b className="nav-count">{unread}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="theme-switch"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            <span>{theme === "light" ? "Modo oscuro" : "Modo claro"}</span>
            <span className="switch-track">
              <i />
            </span>
          </button>
          <div className="user-block">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <small>{roles[user.role]}</small>
            </div>
            <IconButton icon={LogOut} label="Cerrar sesion" onClick={signout} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              icon={Menu}
              label="Abrir menu"
              onClick={() => setMenu(true)}
            />
            <span>Laboratorio</span>
            <ChevronRight size={13} />
            <strong>
              {nav.find((n) => n[0] === page)?.[1] || "Mi asistencia"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="top-date">
              {new Intl.DateTimeFormat("es-PE", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date())}
            </span>
            {demo && <span className="demo-label">DEMO</span>}
            {admin && (
              <button
                className="icon-btn notification-bell"
                aria-label="Notificaciones"
                onClick={() => navigate("notifications")}
              >
                <Bell size={18} />
                {unread > 0 && <i />}
              </button>
            )}
            <Avatar name={user.name} small />
          </div>
        </header>
        <main className="main-content">
          {error && !modal && (
            <div className="form-error global-error" role="alert">
              {error}
              <button onClick={() => setError("")}>Cerrar</button>
            </div>
          )}
          {page === "dashboard" && admin && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    Resumen
                    <span className="heading-dot">.</span>
                  </h1>
                </div>
                <button
                  className="btn"
                  onClick={() =>
                    download(data.attendance, "asistencia-nonhuman")
                  }
                >
                  <Download size={16} />
                  Exportar reporte
                </button>
              </div>
              <div className="metrics">
                <Metric
                  label="Entradas esta semana"
                  value={weekTotal}
                  icon={LogIn}
                  detail="Miembros, externos y visitas"
                />
                <Metric
                  label="Personas en el lab"
                  value={inside.length + activeVisits.length}
                  icon={Users}
                  detail={`${activeVisits.length} visitas en curso`}
                  green
                />
                <Metric
                  label="Articulos disponibles"
                  value={items.reduce((s, i) => s + i.available, 0)}
                  icon={Boxes}
                  detail={`${items.length} referencias en inventario`}
                />
                <Metric
                  label="Prestamos activos"
                  value={pending.length}
                  icon={ArrowUpRight}
                  detail={`${pending.filter((l) => new Date(l.due) < new Date()).length} pendientes de devolucion vencidos`}
                  amber
                />
              </div>
              <div className="dashboard-top">
                <section className="panel chart-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Actividad del laboratorio</h2>
                      <p>Ingresos durante la semana</p>
                    </div>
                    <div className="week-control">
                      <IconButton
                        icon={ChevronLeft}
                        label="Semana anterior"
                        onClick={() => setWeek(week - 1)}
                      />
                      <span>
                        {date(days[0].key + "T12:00:00-05:00")} –{" "}
                        {date(days[6].key + "T12:00:00-05:00")}
                      </span>
                      <IconButton
                        icon={ChevronRight}
                        label="Semana siguiente"
                        onClick={() => setWeek(week + 1)}
                        disabled={week >= 0}
                      />
                    </div>
                  </div>
                  <div className="chart-summary">
                    <strong>{weekTotal}</strong>
                    <span>ingresos registrados</span>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={days}
                        barSize={24}
                        margin={{ top: 10, right: 0, left: -25, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 5"
                          vertical={false}
                          stroke="var(--border)"
                        />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--muted)", fontSize: 12 }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--muted)", fontSize: 11 }}
                        />
                        <Tooltip
                          itemStyle={{ color: "var(--text)" }}
                          cursor={{ fill: "var(--hover)" }}
                          contentStyle={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            color: "var(--text)",
                          }}
                        />
                        <Bar
                          isAnimationActive={false}
                          dataKey="Miembros"
                          stackId="a"
                          fill="var(--chart-green)"
                        />
                        <Bar
                          isAnimationActive={false}
                          dataKey="Externos"
                          stackId="a"
                          fill="var(--chart-lime)"
                        />
                        <Bar
                          isAnimationActive={false}
                          dataKey="Visitas"
                          stackId="a"
                          fill="var(--chart-gray)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="legend-green" />
                      Miembros
                    </span>
                    <span>
                      <i className="legend-lime" />
                      Externos
                    </span>
                    <span>
                      <i className="legend-gray" />
                      Visitas
                    </span>
                  </div>
                </section>
                <section className="panel presence-panel">
                  <div className="section-heading">
                    <h2>Ahora en el laboratorio</h2>
                    <Badge>{inside.length + activeVisits.length} dentro</Badge>
                  </div>
                  <div className="presence-list">
                    {inside.slice(0, 5).map((a) => (
                      <div className="presence-person" key={a.id}>
                        <Avatar name={a.name} />
                        <div>
                          <strong>{a.name}</strong>
                          <small>
                            {roles[a.role]} · Desde {hour(a.entered)}
                          </small>
                        </div>
                        <span className="status-dot" />
                      </div>
                    ))}
                    {!inside.length && (
                      <Empty text="No hay personas registradas dentro." />
                    )}
                  </div>
                  <button
                    className="panel-link"
                    onClick={() => navigate("attendance")}
                  >
                    Ver asistencia
                    <ArrowRight size={15} />
                  </button>
                </section>
              </div>
              <div className="section-heading standalone">
                <div>
                  <h2>Prestamos en seguimiento</h2>
                  <p>Equipos y componentes fuera del inventario disponible</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("loans")}
                >
                  Ver todos
                  <ArrowRight size={15} />
                </button>
              </div>
              <section className="panel">
                {loanTable(pending.slice(0, 4))}
              </section>
              <div className="dashboard-bottom">
                <section className="panel">
                  <div className="section-heading">
                    <h2>Actividad reciente</h2>
                    <History size={17} />
                  </div>
                  {data.events.slice(0, 4).map((e) => (
                    <div className="activity-row" key={e.id}>
                      <span className={`event-icon ${e.kind}`}>
                        <ArrowUpRight size={16} />
                      </span>
                      <div>
                        <strong>{e.name}</strong>
                        <p>{e.text}</p>
                      </div>
                      <time>{hour(e.created)}</time>
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <h2>Atencion al inventario</h2>
                    <Badge tone="amber">{low.length} referencias</Badge>
                  </div>
                  {low.length ? (
                    low.slice(0, 3).map((i) => (
                      <div className="low-row" key={i.id}>
                        <Package size={20} />
                        <div>
                          <strong>{i.name}</strong>
                          <small>{i.location}</small>
                        </div>
                        <b>
                          {i.available}
                          <small> disponibles</small>
                        </b>
                      </div>
                    ))
                  ) : (
                    <div className="stock-good">
                      <ShieldCheck size={30} />
                      <strong>Todo en orden</strong>
                      <p>No hay articulos por debajo del minimo.</p>
                    </div>
                  )}
                  <button
                    className="panel-link"
                    onClick={() => navigate("inventory")}
                  >
                    Revisar inventario
                    <ArrowRight size={15} />
                  </button>
                </section>
              </div>
            </>
          )}
          {page === "attendance" && (
            <>
              <PageHeading title="Asistencia" />
              <section className="attendance-action panel">
                <div className="attendance-symbol">
                  <LogIn size={30} />
                </div>
                <div>
                  <Badge tone={data.inside ? "green" : "gray"}>
                    {data.inside
                      ? "Estas en el laboratorio"
                      : "Fuera del laboratorio"}
                  </Badge>
                  <h2>
                    {data.inside ? "Entrada registrada" : "Sin entrada activa"}
                  </h2>
                </div>
                <div className="attendance-buttons">
                  <button
                    className="btn primary"
                    disabled={busy || data.inside}
                    onClick={() => act("check-in", {}, false)}
                  >
                    <LogIn size={18} />
                    Registrar entrada
                  </button>
                  <button
                    className="btn"
                    disabled={busy || !data.inside}
                    onClick={() => act("check-out", {}, false)}
                  >
                    <LogOut size={18} />
                    Registrar salida
                  </button>
                </div>
              </section>
              {activeVisits.filter((v) => v.host_id === user.id).length > 0 && (
                <div className="notice">
                  <UserRoundCheck size={18} />
                  Tienes visitas abiertas. Recuerda registrar su salida.
                  <button
                    className="text-button"
                    onClick={() => navigate("visits")}
                  >
                    Ver visitas
                  </button>
                </div>
              )}
              <div className="section-heading standalone">
                <h2>{admin ? "Registro de asistencia" : "Mi historial"}</h2>
                <button
                  className="btn"
                  onClick={() => download(data.attendance, "asistencia")}
                >
                  <Download size={16} />
                  Exportar
                </button>
              </div>
              <section className="panel">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {admin && <th>Persona</th>}
                        <th>Fecha</th>
                        <th>Entrada</th>
                        <th>Salida</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.attendance.map((a) => (
                        <tr key={a.id}>
                          {admin && (
                            <td>
                              <strong>{a.name}</strong>
                              <small>{roles[a.role]}</small>
                            </td>
                          )}
                          <td>{date(a.entered)}</td>
                          <td>{hour(a.entered)}</td>
                          <td>{hour(a.exited)}</td>
                          <td>
                            <Badge tone={a.exited ? "gray" : "green"}>
                              {a.exited ? "Finalizada" : "Dentro"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.attendance.length && <Empty />}
              </section>
            </>
          )}
          {page === "inventory" && !external && (
            <>
              <PageHeading
                title="Inventario"
                subtitle={`${items.length} referencias`}
                action={
                  admin && (
                    <button
                      className="btn primary"
                      onClick={() => open({ type: "item" })}
                    >
                      <Plus size={17} />
                      Nuevo articulo
                    </button>
                  )
                }
              />
              <div className="toolbar">
                <div className="search-input">
                  <Search size={17} />
                  <input
                    placeholder="Buscar articulo, codigo o ubicacion…"
                    aria-label="Buscar articulos"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Categoria"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {["Todos", ...new Set(items.map((i) => i.category))].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
                <div className="view-toggle">
                  <IconButton
                    icon={LayoutDashboard}
                    label="Vista cuadricula"
                    onClick={() => setView("grid")}
                    aria-pressed={view === "grid"}
                  />
                  <IconButton
                    icon={Menu}
                    label="Vista lista"
                    onClick={() => setView("list")}
                    aria-pressed={view === "list"}
                  />
                </div>
              </div>
              <div
                className={
                  view === "grid" ? "inventory-grid" : "inventory-list"
                }
              >
                {filteredItems.map((i) => (
                  <article className="item-card" key={i.id}>
                    {productImage(i)}
                    <div className="item-info">
                      <span className="item-code">
                        {i.code} <span>{i.category}</span>
                      </span>
                      <h3>{i.name}</h3>
                      <p>{i.location}</p>
                      <div className="stock-line">
                        <Badge
                          tone={i.available <= i.minimum ? "amber" : "green"}
                        >
                          {i.available} disponibles
                        </Badge>
                        <small>
                          {i.consumable ? "Consumible" : "Reutilizable"}
                        </small>
                      </div>
                      <div className="item-actions">
                        <button
                          className={`btn ${cart[i.id] ? "selected" : ""}`}
                          disabled={!i.available}
                          onClick={() =>
                            setCart((c) => {
                              const n = { ...c };
                              if (n[i.id]) delete n[i.id];
                              else n[i.id] = 1;
                              return n;
                            })
                          }
                        >
                          {cart[i.id] ? (
                            <Check size={15} />
                          ) : (
                            <Plus size={15} />
                          )}{" "}
                          {cart[i.id] ? "Seleccionado" : "Seleccionar"}
                        </button>
                        {admin && (
                          <IconButton
                            icon={SlidersHorizontal}
                            label={`Ajustar ${i.name}`}
                            onClick={() => open({ type: "stock", item: i })}
                          />
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!filteredItems.length && (
                <Empty text="No se encontraron articulos." />
              )}
              {Object.keys(cart).length > 0 && (
                <div className="cart-bar">
                  <span>
                    <Boxes size={20} />
                    <strong>
                      {Object.keys(cart).length} articulos seleccionados
                    </strong>
                  </span>
                  <button className="text-button" onClick={() => setCart({})}>
                    Limpiar
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => open({ type: "checkout" })}
                  >
                    Registrar retiro
                    <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </>
          )}
          {page === "loans" && !external && (
            <>
              <PageHeading
                title={admin ? "Prestamos" : "Mis prestamos"}
                subtitle={`${pending.length} prestamos pendientes de devolucion.`}
                action={
                  <button
                    className="btn primary"
                    onClick={() => navigate("inventory")}
                  >
                    <Plus size={17} />
                    Retirar articulos
                  </button>
                }
              />
              <section className="panel">{loanTable(loans)}</section>
            </>
          )}
          {page === "visits" && !external && (
            <>
              <PageHeading
                title="Visitas"
                subtitle={`${activeVisits.length} visitas en curso.`}
                action={
                  <button
                    className="btn primary"
                    onClick={() => open({ type: "visit" })}
                  >
                    <Plus size={17} />
                    Registrar visita
                  </button>
                }
              />
              <section className="panel">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Visitante</th>
                        <th>Motivo</th>
                        <th>Anfitrion</th>
                        <th>Entrada</th>
                        <th>Salida</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {visits.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <strong>{v.name}</strong>
                            <Badge tone={v.exited ? "gray" : "green"}>
                              {v.exited ? "Finalizada" : "Dentro"}
                            </Badge>
                          </td>
                          <td>{v.reason}</td>
                          <td>{v.host}</td>
                          <td>
                            {date(v.entered)}
                            <small>{hour(v.entered)}</small>
                          </td>
                          <td>{hour(v.exited)}</td>
                          <td>
                            {!v.exited && (
                              <button
                                className="btn small-btn"
                                disabled={busy}
                                onClick={() =>
                                  act("visit-close", { id: v.id }, false)
                                }
                              >
                                Registrar salida
                                <LogOut size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!visits.length && <Empty text="No hay visitas registradas." />}
              </section>
            </>
          )}
          {page === "people" && admin && (
            <>
              <PageHeading
                title="Personas"
                subtitle={`${people.filter((p) => p.active).length} cuentas activas · ${people.filter((p) => p.active && p.role === "admin").length} administradores · ${people.filter((p) => p.active && p.role === "member").length} miembros${people.some((p) => p.active && p.role === "external") ? ` · ${people.filter((p) => p.active && p.role === "external").length} externos` : ""}`}
                action={
                  <>
                    <button
                      className="btn"
                      onClick={() => {
                        setImportRows(null);
                        open({ type: "import" });
                      }}
                    >
                      <Upload size={16} />
                      Importar Excel
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => open({ type: "person" })}
                    >
                      <Plus size={17} />
                      Agregar persona
                    </button>
                  </>
                }
              />
              {data.mail_pending > 0 && (
                <div className="notice">
                  <Mail size={17} />
                  {data.mail_pending} correo(s) pendientes de envio. Revisa la
                  configuracion del servicio.
                </div>
              )}
              <div className="toolbar">
                <div className="search-input">
                  <Search size={17} />
                  <input
                    placeholder="Buscar por nombre o DNI…"
                    aria-label="Buscar personas"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filtrar rol"
                  value={peopleFilter}
                  onChange={(e) => setPeopleFilter(e.target.value)}
                >
                  <option value="all">Todos los roles</option>
                  {Object.entries(roles).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <section className="panel">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Persona</th>
                        <th>DNI</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {people
                        .filter(
                          (p) =>
                            (peopleFilter === "all" ||
                              p.role === peopleFilter) &&
                            `${p.name} ${p.dni}`
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                        )
                        .map((p) => (
                          <tr key={p.id}>
                            <td>
                              <div className="person-inline">
                                <Avatar name={p.name} />
                                <div>
                                  <strong>{p.name}</strong>
                                  <small>{p.email}</small>
                                </div>
                              </div>
                            </td>
                            <td className="mono">{p.dni}</td>
                            <td>
                              <Badge
                                tone={
                                  p.role === "admin"
                                    ? "purple"
                                    : p.role === "external"
                                      ? "gray"
                                      : "green"
                                }
                              >
                                {roles[p.role]}
                              </Badge>
                            </td>
                            <td>
                              <Badge tone={p.active ? "green" : "gray"}>
                                {p.active ? "Activo" : "Inactivo"}
                              </Badge>
                            </td>
                            <td>
                              <div className="row-actions">
                                {p.active && (
                                  <IconButton
                                    icon={Mail}
                                    label={`Enviar acceso a ${p.name}`}
                                    onClick={() =>
                                      act("invite", { id: p.id }, false)
                                    }
                                    disabled={busy}
                                  />
                                )}
                                <button
                                  className="text-button"
                                  disabled={p.id === user.id || busy}
                                  onClick={() =>
                                    open({ type: "toggle", person: p })
                                  }
                                >
                                  {p.active ? "Desactivar" : "Activar"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {page === "notifications" && admin && (
            <>
              <PageHeading
                title="Notificaciones"
                subtitle={`${unread} sin leer`}
                action={
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => act("notifications-read", {}, false)}
                  >
                    <CheckCheck size={16} />
                    Marcar todas como leidas
                  </button>
                }
              />
              <section className="panel">
                {notifications.map((n) => (
                  <div
                    className={`notification-row ${n.read ? "" : "unread"}`}
                    key={n.id}
                  >
                    <span className="event-icon">
                      <ArrowUpRight size={18} />
                    </span>
                    <div>
                      <strong>{n.name}</strong>
                      <p>{n.text}</p>
                      <small>
                        {date(n.created)} · {hour(n.created)}
                      </small>
                    </div>
                    {!n.read && <span className="status-dot" />}
                  </div>
                ))}
                {!notifications.length && (
                  <Empty text="No hay notificaciones." />
                )}
              </section>
            </>
          )}
          {page === "history" && admin && (
            <>
              <PageHeading
                title="Actividad"
                subtitle="Entradas, retiros y cambios registrados por el equipo."
              />
              <section className="panel">
                {data.events.map((e) => (
                  <div className="activity-row" key={e.id}>
                    <Avatar name={e.name} />
                    <div>
                      <strong>{e.name}</strong>
                      <p>{e.text}</p>
                    </div>
                    <time>
                      {date(e.created)} · {hour(e.created)}
                    </time>
                  </div>
                ))}
              </section>
            </>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <IconButton
            icon={X}
            label="Cerrar aviso"
            onClick={() => setToast("")}
          />
        </div>
      )}
      {modal && (
        <Modal
          title={
            {
              checkout: "Registrar retiro",
              return: "Devolver articulo",
              visit: "Nueva visita",
              person: "Agregar persona",
              item: "Nuevo articulo",
              stock: "Movimiento de inventario",
              toggle: modal.person?.active
                ? "Desactivar cuenta"
                : "Activar cuenta",
              import: "Importar personas",
            }[modal.type]
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              let ok = false;
              if (modal.type === "checkout") {
                ok = await act("checkout", {
                  reason: f.reason,
                  due: f.due ? new Date(f.due).toISOString() : null,
                  items: Object.entries(cart).map(([id, quantity]) => ({
                    id: Number(id),
                    quantity: Number(quantity),
                  })),
                });
                if (ok) setCart({});
              }
              if (modal.type === "return")
                await act("return", {
                  id: modal.loan.id,
                  quantity: Number(f.quantity),
                  damaged: f.damaged === "on",
                });
              if (modal.type === "visit") await act("visit-create", f);
              if (modal.type === "person") await act("person-create", f);
              if (modal.type === "item")
                await act("item-create", {
                  ...f,
                  quantity: Number(f.quantity),
                  minimum: Number(f.minimum),
                  consumable: f.consumable === "on",
                });
              if (modal.type === "stock")
                await act("stock", {
                  ...f,
                  id: modal.item.id,
                  quantity: Number(f.quantity),
                });
              if (modal.type === "toggle")
                await act("person-toggle", { id: modal.person.id });
              if (modal.type === "import")
                await act("import-people", { rows: importRows });
            }}
          >
            <div className="modal-body">
              {modal.type === "checkout" && (
                <>
                  {Object.entries(cart).map(([id, q]) => {
                    const i = items.find((i) => i.id === Number(id));
                    return (
                      i && (
                        <div className="checkout-line" key={id}>
                          <div>
                            <strong>{i.name}</strong>
                            <small>
                              {i.available} disponibles ·{" "}
                              {i.consumable ? "Consumible" : "Prestamo"}
                            </small>
                          </div>
                          <input
                            aria-label={`Cantidad ${i.name}`}
                            type="number"
                            min="1"
                            max={i.available}
                            required
                            value={q}
                            onChange={(e) =>
                              setCart({ ...cart, [id]: e.target.value })
                            }
                          />
                        </div>
                      )
                    );
                  })}
                  <Field label="Motivo del retiro">
                    <textarea
                      name="reason"
                      required
                      maxLength={300}
                      placeholder="Proyecto o actividad"
                    />
                  </Field>
                  {Object.keys(cart).some(
                    (id) => !items.find((i) => i.id === Number(id))?.consumable,
                  ) && (
                    <Field
                      label="Fecha y hora de devolucion"
                      name="due"
                      type="datetime-local"
                      required
                    />
                  )}
                </>
              )}
              {modal.type === "return" && (
                <>
                  <p>
                    <strong>{modal.loan.item}</strong>
                  </p>
                  <Field
                    label="Cantidad que devuelves"
                    name="quantity"
                    type="number"
                    min="1"
                    max={modal.loan.quantity - modal.loan.returned}
                    defaultValue={modal.loan.quantity - modal.loan.returned}
                    required
                  />
                  <label className="check-field">
                    <input type="checkbox" name="damaged" />
                    El articulo tiene danos o requiere revision
                  </label>
                </>
              )}
              {modal.type === "visit" && (
                <>
                  <Field
                    label="Nombre del visitante"
                    name="name"
                    required
                    maxLength={100}
                  />
                  <Field label="Razon de la visita">
                    <textarea name="reason" required maxLength={300} />
                  </Field>
                </>
              )}
              {modal.type === "person" && (
                <>
                  <Field
                    label="Nombre completo"
                    name="name"
                    required
                    maxLength={100}
                  />
                  <div className="form-grid">
                    <Field
                      label="DNI"
                      name="dni"
                      inputMode="numeric"
                      pattern="[0-9]{8}"
                      maxLength={8}
                      required
                    />
                    <Field label="Rol">
                      <select name="role" defaultValue="member">
                        {Object.entries(roles).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field
                    label="Correo personal"
                    name="email"
                    type="email"
                    required
                  />
                </>
              )}
              {modal.type === "item" && (
                <>
                  <Field
                    label="Nombre del articulo"
                    name="name"
                    required
                    maxLength={120}
                  />
                  <div className="form-grid">
                    <Field label="Codigo" name="code" required maxLength={30} />
                    <Field
                      label="Categoria"
                      name="category"
                      required
                      list="categories"
                      maxLength={50}
                    />
                    <datalist id="categories">
                      {[
                        "Componentes",
                        "Camaras",
                        "Actuadores",
                        "Herramientas",
                        "Sensores",
                        "Consumibles",
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </datalist>
                  </div>
                  <Field
                    label="Ubicacion"
                    name="location"
                    required
                    maxLength={100}
                  />
                  <div className="form-grid">
                    <Field
                      label="Cantidad inicial"
                      name="quantity"
                      type="number"
                      min="0"
                      defaultValue="1"
                      required
                    />
                    <Field
                      label="Stock minimo"
                      name="minimum"
                      type="number"
                      min="0"
                      defaultValue="2"
                      required
                    />
                  </div>
                  <Field
                    label="URL de imagen (opcional)"
                    name="image"
                    type="url"
                    placeholder="https://…"
                  />
                  <label className="check-field">
                    <input type="checkbox" name="consumable" />
                    Consumible (sin devolucion)
                  </label>
                </>
              )}
              {modal.type === "stock" && (
                <>
                  <p>
                    <strong>{modal.item.name}</strong>
                  </p>
                  <Field label="Tipo de movimiento">
                    <select name="operation">
                      <option value="add">Ingreso de stock</option>
                      <option value="remove">Baja de stock disponible</option>
                      <option value="repair">
                        Volver a disponible tras reparacion
                      </option>
                    </select>
                  </Field>
                  <Field
                    label="Cantidad"
                    name="quantity"
                    type="number"
                    min="1"
                    required
                  />
                  <Field label="Motivo">
                    <textarea name="reason" required maxLength={300} />
                  </Field>
                </>
              )}
              {modal.type === "toggle" && (
                <p>
                  {modal.person.active
                    ? `Se desactivara el acceso de ${modal.person.name}. Se conservaran sus registros y prestamos pendientes.`
                    : `Se reactivara la cuenta de ${modal.person.name} y se enviara un enlace para crear su contrasena.`}
                </p>
              )}
              {modal.type === "import" && (
                <>
                  <Field label="Excel (.xlsx) o CSV">
                    <input
                      type="file"
                      accept=".xlsx,.csv"
                      onChange={async (e) => {
                        if (!e.target.files[0]) return;
                        setImportBusy(true);
                        setError("");
                        const f = new FormData();
                        f.append("file", e.target.files[0]);
                        try {
                          const r = await api("import-preview", f, true);
                          setImportRows(r.rows);
                        } catch (err) {
                          setError(err.message);
                        } finally {
                          setImportBusy(false);
                        }
                      }}
                    />
                  </Field>
                  <p className="muted">
                    Columnas: DNI, nombre, correo y rol (opcional).
                  </p>
                  {importBusy && <p>Revisando archivo…</p>}
                  {importRows && (
                    <div className="import-preview">
                      {importRows.map((r, i) => (
                        <div key={i}>
                          <strong>{r.name || `Fila ${i + 2}`}</strong>
                          <small>
                            {r.dni} · {r.email}
                          </small>
                          {r.error ? (
                            <span className="form-error">{r.error}</span>
                          ) : (
                            <Badge>{roles[r.role]}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                className="btn primary"
                disabled={
                  busy ||
                  (modal.type === "import" &&
                    (!importRows?.length ||
                      importRows.some((r) => r.error) ||
                      importBusy))
                }
              >
                {busy
                  ? "Guardando…"
                  : modal.type === "checkout"
                    ? "Confirmar retiro"
                    : modal.type === "import"
                      ? "Importar personas"
                      : "Confirmar"}
                <Check size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
function PageHeading({ title, subtitle, action }) {
  return (
    <div className="page-heading">
      <div>
        <h1>
          {title}
          <span className="heading-dot">.</span>
        </h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </div>
  );
}
function Metric({ label, value, icon: Icon, detail, green, amber }) {
  return (
    <section className={`metric ${green ? "highlight" : ""}`}>
      <div>
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>
        {value}
        <span className="metric-unit">
          {label === "Personas en el lab" ? "/ ahora" : ""}
        </span>
      </strong>
      <p className={amber ? "amber-text" : ""}>
        {amber && <Clock3 size={12} />} {detail}
      </p>
    </section>
  );
}
createRoot(document.getElementById("root")).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js");
