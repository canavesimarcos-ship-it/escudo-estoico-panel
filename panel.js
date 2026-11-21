// Escudo Estoico — panel diario.
//
// El contenido (semana que viene) es público en esta página; lo que publica y conecta
// pasa por Supabase y solo funciona con una cuenta de administrador (la misma que en
// el panel de Che Clima). Las llaves de Instagram y Canva nunca llegan a esta página.

const C = window.EE;
const db = window.supabase ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
}) : null; // si no carga Supabase, el contenido del día se ve igual

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const MANUALES = [["tt", "Reel publicado en TikTok"], ["yt", "Reel publicado en Shorts"], ["vid", "Video generado en Gemini"]];
const PLANTILLA_CARRUSEL = "DAHbLfWduP4";

let DIAS_DATOS = [], porIso = {}, cur = null;
let admin = false, usuario = null, pubs = [];

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const isoDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deIso = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
const hoyIso = () => isoDe(new Date());
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const guardado = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

function promptGemini(e) {
  return `Formato VERTICAL 9:16 (retrato, como un reel de celular), NO horizontal. 8 segundos.
Estilo: usá la imagen adjunta (plantilla de Escudo Estoico) como referencia. Blanco y negro, alto contraste, sombras profundas, estética de mármol y cine clásico.
Escena: ${e.vis}.
Cámara: un solo plano, movimiento lento y continuo (acercamiento suave o paneo lento), sin cortes.
Luz: dramática y lateral, grano de película sutil.
Clima: sereno, firme, contemplativo.
Audio: ${e.mus}.
Importante: sin texto, sin letras, sin subtítulos ni logos. Dejá el centro y el tercio superior con espacio limpio para agregar texto después.`;
}

// ------------------------------------------------------------------ contenido

function render() {
  const e = porIso[cur];
  const d = deIso(cur);
  const dia = DIAS[d.getDay()];
  $("title").textContent = `${dia[0].toUpperCase() + dia.slice(1)} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  $("pick").value = cur;
  if (!e) {
    $("meta").textContent = "Este día no está en el panel (se muestran 3 semanas: la pasada y las dos que vienen).";
    document.querySelector(".grid").style.display = "none";
    renderSemana();
    return;
  }
  document.querySelector(".grid").style.display = "";
  $("meta").textContent = `Día ${e.n} de 365 · ${e.mes} · ${e.tema}`;
  $("slides").innerHTML = `
    <div class="sl dark"><span class="n">1</span>${esc(e.gancho)}</div>
    <div class="sl light"><span class="n">2</span>${esc(e.idea)}<small>“${esc(e.cita)}” — ${esc(e.autor)}</small></div>
    <div class="sl light"><span class="n">3</span><small style="font-style:normal;opacity:.6;margin:0 0 6px">Práctica de hoy</small>${esc(e.practica)}</div>
    <div class="sl light"><span class="n">4</span>${esc(e.pregunta)}</div>`;
  $("canvaRow").innerHTML = e.canva
    ? `<a class="btn" href="https://www.canva.com/design/${e.canva}/edit" target="_blank" rel="noopener">Ver carrusel en Canva ↗</a>`
    : `<a class="btn" href="https://www.canva.com/design/${PLANTILLA_CARRUSEL}/edit" target="_blank" rel="noopener">Abrir plantilla de carrusel ↗</a><span class="note" style="margin:0">Todavía no hay diseño en Canva para este día: no va a salir solo.</span>`;
  $("cap").textContent = e.cap;
  $("reelSub").textContent = `8 segundos · ${e.fmt} · IG Reels, TikTok y Shorts`;
  $("prompt").textContent = promptGemini(e);
  $("t1").textContent = e.t1;
  $("t2").textContent = e.t2;
  $("mus").textContent = e.mus;
  $("rcap").textContent = e.rcap;

  const marcas = guardado.get("ee:" + cur) || {};
  $("checks").innerHTML = MANUALES.map(([k, l]) =>
    `<label class="ck ${marcas[k] ? "on" : ""}"><input type="checkbox" data-k="${k}" ${marcas[k] ? "checked" : ""}>${l}</label>`).join("");
  $("checks").querySelectorAll("input").forEach(i => i.onchange = () => {
    const m = guardado.get("ee:" + cur) || {}; m[i.dataset.k] = i.checked; guardado.set("ee:" + cur, m);
    i.parentElement.classList.toggle("on", i.checked);
  });

  renderEstados();
  renderSemana();
}

function pubDe(iso, tipo) {
  return pubs.find(p => p.fecha === iso && p.tipo === tipo && p.estado !== "cancelada");
}

const NOMBRE_ESTADO = { pendiente: "Programado", publicando: "Publicando…", publicada: "Publicado", error: "Con error" };
const horaTxt = t => new Date(t).toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

function cajaEstado(p, tipo) {
  if (!p) return "";
  const enlace = p.enlace ? ` · <a href="${esc(p.enlace)}" target="_blank" rel="noopener">ver en Instagram ↗</a>` : "";
  const det = p.detalle ? `<div class="det">${esc(p.detalle)}${p.estado === "pendiente" && p.intentos ? ` (se reintenta en la próxima corrida)` : ""}</div>` : "";
  let botones = "";
  if (admin && p.estado === "error") botones += `<button data-accion="reintentar" data-id="${p.id}">Reintentar ahora</button>`;
  if (admin && tipo === "reel" && ["pendiente", "error"].includes(p.estado)) botones += `<button data-accion="cancelar" data-id="${p.id}">Cancelar</button>`;
  return `<div class="estado ${p.estado}"><span class="dot ${p.estado}"></span><b>${NOMBRE_ESTADO[p.estado] || p.estado}</b>
    · ${horaTxt(p.hora)}${enlace}${det}${botones ? `<div class="row" style="margin-top:8px">${botones}</div>` : ""}</div>`;
}

function renderEstados() {
  if (!usuario || !admin) { $("estadoCarrusel").innerHTML = ""; $("reelProg").innerHTML = ""; return; }
  const car = pubDe(cur, "carrusel");
  const e = porIso[cur];
  $("estadoCarrusel").innerHTML = car ? cajaEstado(car, "carrusel")
    : `<div class="estado"><span class="dot"></span>${cur < hoyIso() ? "No se publicó" : e && e.canva ? "Sale solo ese día a las 9:00" : "Sin diseño en Canva: no va a salir"}</div>`;
  const reel = pubDe(cur, "reel");
  if (reel) {
    $("reelProg").innerHTML = `<div class="section-title" style="margin-top:20px">Reel en Instagram</div>` + cajaEstado(reel, "reel")
      + (reel.archivo ? `<div class="vista" id="vistaReel"><span class="note">Cargando vista previa…</span></div>` : "");
    if (reel.archivo) mostrarVideo(reel, porIso[cur]);
  } else if (cur >= hoyIso()) {
    $("reelProg").innerHTML = `<div class="section-title" style="margin-top:20px">Subir el video del reel</div>
      <div class="note">Subí el video de Gemini tal cual: al publicarlo, el sistema le agrega el Texto 1, el Texto 2 y @escudo.estoico, y lo sube a Instagram a la hora elegida con el caption de arriba.</div>
      <div class="row"><input type="file" id="video" accept="video/mp4,video/quicktime">
      <input type="time" id="horaReel" value="${C.HORA_REEL}"><button class="primary" id="subirReel">Subir y programar</button></div>
      <label class="note" style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="yaListo"> El video ya tiene los textos (lo armé en Canva): publicarlo tal cual</label>
      <div class="note" id="msgReel"></div>`;
    $("subirReel").onclick = subirReel;
  } else {
    $("reelProg").innerHTML = "";
  }
  document.querySelectorAll("[data-accion]").forEach(b => b.onclick = () => accion(b.dataset.accion, Number(b.dataset.id), b));
}

const rutaFinal = p => `reels/final/${p.fecha}-${p.id}.mp4`;
const botonBajar = url => `<div class="row" style="justify-content:center;margin-top:8px"><a class="btn primary" href="${esc(url)}">⬇ Descargar reel con textos</a></div>
  <div class="note" style="text-align:center">Para subirlo a mano a TikTok y Shorts. Queda disponible 7 días.</div>`;

async function mostrarVideo(p, e) {
  const caja = $("vistaReel");
  if (!caja) return;
  const almacen = db.storage.from("escudo");
  const nombre = `escudo-estoico-${p.fecha}.mp4`;
  const yaListo = p.archivo.endsWith("-listo.mp4");
  // 1) ¿Ya está hecha la versión con textos? Se muestra la real y se puede bajar.
  if (!yaListo) {
    const [ver, bajar] = await Promise.all([almacen.createSignedUrl(rutaFinal(p), 3600), almacen.createSignedUrl(rutaFinal(p), 3600, { download: nombre })]);
    if (!ver.error && ver.data) {
      caja.innerHTML = `<div class="marco"><video src="${esc(ver.data.signedUrl)}" controls playsinline muted loop autoplay preload="metadata"></video></div>
        <div class="note" style="text-align:center">Versión final: así sale en Instagram.</div>` + (bajar.data ? botonBajar(bajar.data.signedUrl) : "");
      return;
    }
  }
  // 2) Publicado y sin versión guardada: ya venció (o se subió con los textos hechos).
  if (p.estado === "publicada") { caja.innerHTML = yaListo ? "" : `<span class="note">La versión para descargar ya venció (se guarda 7 días).</span>`; return; }
  // 3) Todavía no está: vista aproximada del original.
  const r = await almacen.createSignedUrl(p.archivo, 3600);
  if (r.error || !r.data) { caja.innerHTML = `<span class="note">No se pudo cargar la vista previa (${esc(r.error ? r.error.message : "sin enlace")}).</span>`; return; }
  const conTextos = !yaListo && e;
  let pie = "Se publica tal cual.";
  if (yaListo) {
    const d = await almacen.createSignedUrl(p.archivo, 3600, { download: nombre });
    if (d.data) pie += botonBajar(d.data.signedUrl).replace("Descargar reel con textos", "Descargar reel");
  } else {
    pie = `Vista previa aproximada. Se está armando la versión final con los textos para descargar (tarda 1 o 2 minutos).
      <div class="row" style="justify-content:center;margin-top:8px"><button id="revisarFinal">Revisar de nuevo</button></div>`;
  }
  caja.innerHTML = `<div class="marco"><video src="${esc(r.data.signedUrl)}" controls playsinline muted loop autoplay preload="metadata"></video>
    ${conTextos ? `<div class="sobre" id="sobreTexto"></div><div class="manija">@escudo.estoico</div>` : ""}</div>
    <div class="note" style="text-align:center">${pie}</div>`;
  if ($("revisarFinal")) $("revisarFinal").onclick = () => { caja.innerHTML = `<span class="note">Revisando…</span>`; mostrarVideo(p, e); };
  if (!conTextos) return;
  const v = caja.querySelector("video"), sobre = $("sobreTexto");
  const firma = /^[—-]/.test((e.t2 || "").trim());
  const pintar = () => {
    const mitad = (v.duration || 8) / 2, segunda = v.currentTime >= mitad;
    sobre.innerHTML = firma
      ? `${esc(e.t1)}${segunda ? `<small>${esc(e.t2)}</small>` : ""}`
      : esc(segunda ? e.t2 : e.t1);
  };
  v.addEventListener("timeupdate", pintar); pintar();
}

function renderSemana() {
  const w = $("week");
  const base = deIso(cur);
  let html = "";
  for (let i = -3; i <= 3; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i);
    const iso = isoDe(d), e = porIso[iso];
    const car = pubDe(iso, "carrusel"), reel = pubDe(iso, "reel");
    const st = usuario && admin ? `<div class="st"><span><span class="dot ${car ? car.estado : ""}"></span>carr.</span><span><span class="dot ${reel ? reel.estado : ""}"></span>reel</span></div>` : "";
    html += `<button class="wd ${iso === cur ? "on" : ""}" data-iso="${iso}">
      <div class="d">${iso === hoyIso() ? "Hoy · " : ""}${DIAS[d.getDay()].slice(0, 3)} ${d.getDate()}/${d.getMonth() + 1}</div>
      <div class="t">${esc(e ? e.gancho : "—")}</div>${st}</button>`;
  }
  w.innerHTML = html;
  w.querySelectorAll(".wd").forEach(b => b.onclick = () => { cur = b.dataset.iso; render(); });
}

// ------------------------------------------------------------------ Supabase

async function cargarPublicaciones() {
  if (!usuario || !admin || !DIAS_DATOS.length) { pubs = []; return; }
  const { data, error } = await db.from("ee_publicaciones").select("*")
    .gte("fecha", DIAS_DATOS[0].iso).lte("fecha", DIAS_DATOS[DIAS_DATOS.length - 1].iso).order("creada");
  pubs = error ? [] : data;
}

async function subirReel() {
  const archivo = $("video").files[0], msg = $("msgReel"), boton = $("subirReel");
  if (!archivo) { msg.textContent = "Elegí el video primero."; return; }
  if (archivo.size > 100 * 1024 * 1024) { msg.textContent = "El video pesa más de 100 MB."; return; }
  const e = porIso[cur];
  const [hh, mm] = $("horaReel").value.split(":").map(Number);
  const cuando = deIso(cur); cuando.setHours(hh, mm, 0, 0);
  boton.disabled = true; msg.textContent = "Subiendo el video…";
  const ruta = `reels/${cur}-${Date.now()}${$("yaListo").checked ? "-listo" : ""}.mp4`;
  const sub = await db.storage.from("escudo").upload(ruta, archivo, { contentType: archivo.type || "video/mp4" });
  if (sub.error) { msg.textContent = "No se pudo subir: " + sub.error.message; boton.disabled = false; return; }
  const ins = await db.from("ee_publicaciones").insert({ fecha: cur, tipo: "reel", hora: cuando.toISOString(), texto: e.rcap, archivo: ruta });
  if (ins.error) {
    await db.storage.from("escudo").remove([ruta]);
    msg.textContent = ins.error.code === "23505" ? "Ya hay un reel programado para ese día: cancelalo primero." : "No se pudo programar: " + ins.error.message;
    boton.disabled = false; return;
  }
  // Se pide una corrida ya: si es la hora, publica; si no, arma la versión con textos para verla y bajarla
  await db.rpc("ee_publicar_ya");
  msg.textContent = cuando <= new Date() ? "Listo: se está publicando ahora." : `Listo: sale el ${horaTxt(cuando)}. En 1 o 2 minutos vas a poder bajar la versión con textos.`;
  await cargarPublicaciones(); render();
}

async function accion(tipo, id, boton) {
  boton.disabled = true;
  const p = pubs.find(x => x.id === id);
  if (tipo === "cancelar") {
    await db.from("ee_publicaciones").update({ estado: "cancelada" }).eq("id", id);
    if (p && p.archivo) await db.storage.from("escudo").remove([p.archivo]);
  } else if (tipo === "reintentar") {
    await db.from("ee_publicaciones").update({ estado: "pendiente", intentos: 0, detalle: null }).eq("id", id);
    await db.rpc("ee_publicar_ya");
  }
  await cargarPublicaciones(); render();
}

// ------------------------------------------------------------------ crecimiento

let metricas = [], periodo = guardado.get("ee:periodo") || 7;
const REDES = [["instagram", "Instagram", "seguidores"], ["tiktok", "TikTok", "seguidores"], ["youtube", "YouTube", "suscriptores"]];
const num = n => n == null ? "—" : Number(n).toLocaleString("es-AR");
const conSigno = n => n == null ? "—" : (n > 0 ? "+" : "") + Number(n).toLocaleString("es-AR");
const fechaCorta = iso => { const d = deIso(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };

async function cargarMetricas() {
  metricas = [];
  if (!usuario || !admin) return;
  const desde = new Date(); desde.setDate(desde.getDate() - 70);
  const r = await db.from("ee_metricas").select("*").gte("fecha", isoDe(desde)).order("fecha");
  if (!r.error) metricas = r.data || [];
  else if (/relation|does not exist|schema cache/i.test(r.error.message)) metricas = null;   // falta correr supabase/metricas.sql
}

// Diferencia entre el último valor y el de hace N días (o el primero que haya)
function diferencia(filas, campo, desdeIso) {
  const con = filas.filter(f => f[campo] != null);
  if (!con.length) return { valor: null };
  const fin = con[con.length - 1];
  const antes = con.filter(f => f.fecha <= desdeIso);
  const base = antes.length ? antes[antes.length - 1] : con[0];
  if (base === fin) return { valor: null, desde: null };
  return { valor: fin[campo] - base[campo], desde: antes.length ? null : base.fecha };
}

function resumenRed(red) {
  const filas = metricas.filter(f => f.red === red);
  const d = new Date(); d.setDate(d.getDate() - periodo);
  const desdeIso = isoDe(d);
  const enPeriodo = filas.filter(f => f.fecha > desdeIso);
  const ult = [...filas].reverse().find(f => f.seguidores != null);
  const sumar = campo => enPeriodo.some(f => f[campo] != null) ? { valor: enPeriodo.reduce((a, f) => a + (f[campo] || 0), 0) } : null;
  return {
    actual: ult ? ult.seguidores : null,
    ganados: diferencia(filas, "seguidores", desdeIso),
    vistas: sumar("vistas_dia") || diferencia(filas, "vistas_total", desdeIso),
    meGusta: sumar("me_gusta_dia") || diferencia(filas, "me_gusta_total", desdeIso),
    serie: filas.filter(f => f.fecha > desdeIso && f.seguidores != null).map(f => f.seguidores),
    detalle: ([...filas].reverse().find(f => f.detalle) || {}).detalle || [],
    actualizada: filas.length ? filas[filas.length - 1].actualizada : null,
  };
}

function linea(serie) {
  if (serie.length < 2) return "";
  const min = Math.min(...serie), max = Math.max(...serie), rango = max - min || 1;
  const pts = serie.map((v, i) => `${(i / (serie.length - 1) * 100).toFixed(1)},${(28 - (v - min) / rango * 24).toFixed(1)}`).join(" ");
  return `<svg class="linea" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" /></svg>`;
}

function renderCrecimiento() {
  const zona = $("zonaCrecimiento");
  if (!usuario || !admin) { zona.innerHTML = ""; return; }
  if (metricas === null) {
    zona.innerHTML = `<div class="section-title">Crecimiento</div><div class="estado error"><span class="dot error"></span>Falta un paso: pegar <b>supabase/metricas.sql</b> en Supabase → SQL Editor → Run.</div>`;
    return;
  }
  const aclara = r => r && r.desde ? ` <span class="desde">desde el ${fechaCorta(r.desde)}</span>` : "";
  const tarjetas = REDES.map(([red, nombre, palabra]) => {
    const r = resumenRed(red);
    let pie = "";
    if (red === "tiktok") {
      pie = `<details class="carga"><summary class="note" style="margin:0;cursor:pointer">Se lee solo de tu perfil público. Si un día no se actualiza, cargalo a mano</summary>
        <div class="row" style="margin:0"><input type="number" min="0" id="ttSeg" placeholder="Seguidores"><input type="number" min="0" id="ttLikes" placeholder="Me gusta (total)">
        <input type="number" min="0" id="ttVistas" placeholder="Vistas (opcional)"><button id="ttGuardar">Guardar</button></div><div class="note" id="ttMsg"></div></details>`;
    } else if (r.actual == null) {
      pie = `<div class="note">${red === "youtube" ? "Falta la llave de YouTube (ver abajo)." : "Se actualiza en la próxima corrida."}</div>`;
    }
    return `<div class="metrica"><div class="red">${nombre}</div>
      <div class="grande">${num(r.actual)} <span>${palabra}</span></div>${linea(r.serie)}
      <div class="cifras"><div><b class="${r.ganados.valor > 0 ? "sube" : r.ganados.valor < 0 ? "baja" : ""}">${conSigno(r.ganados.valor)}</b>${palabra} ganados${aclara(r.ganados)}</div>
      <div><b>${num(r.vistas && r.vistas.valor)}</b>vistas${aclara(r.vistas)}</div>
      <div><b>${num(r.meGusta && r.meGusta.valor)}</b>me gusta${aclara(r.meGusta)}</div></div>${pie}</div>`;
  }).join("");
  const ultimas = ["instagram", "youtube"].flatMap(red => resumenRed(red).detalle.map(p => ({ ...p, red })))
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).slice(0, 10);
  const tabla = ultimas.length ? `<div class="section-title" style="margin-top:18px">Últimas publicaciones</div>
    <table class="tabla"><thead><tr><th>Fecha</th><th>Red</th><th>Publicación</th><th>Vistas</th><th>Me gusta</th><th>Coment.</th></tr></thead><tbody>
    ${ultimas.map(p => `<tr><td>${p.fecha ? fechaCorta(p.fecha) : ""}</td><td>${p.red === "instagram" ? "IG" : "YT"} · ${esc(p.tipo)}</td>
      <td>${p.enlace ? `<a href="${esc(p.enlace)}" target="_blank" rel="noopener">${esc(p.texto || "ver")}</a>` : esc(p.texto)}</td>
      <td>${num(p.vistas)}</td><td>${num(p.me_gusta)}</td><td>${num(p.comentarios)}</td></tr>`).join("")}</tbody></table>` : "";
  const botones = [7, 30].map(n => `<button data-periodo="${n}" class="${n === periodo ? "primary" : ""}">Últimos ${n} días</button>`).join("");
  zona.innerHTML = `<div class="section-title">Crecimiento</div><div class="row" style="margin-top:0">${botones}</div>
    <div class="metricas">${tarjetas}</div>${tabla}
    <div class="note">Instagram, TikTok y YouTube se actualizan solos una vez por día, a las 00:00 (TikTok: seguidores y me gusta; sus vistas no son públicas). Las vistas y me gusta son los del período elegido.</div>`;
  zona.querySelectorAll("[data-periodo]").forEach(b => b.onclick = () => { periodo = Number(b.dataset.periodo); guardado.set("ee:periodo", periodo); renderCrecimiento(); });
  if ($("ttGuardar")) $("ttGuardar").onclick = guardarTiktok;
}

async function guardarTiktok() {
  const val = id => $(id).value === "" ? null : Math.max(0, Math.round(Number($(id).value)));
  const fila = { fecha: hoyIso(), red: "tiktok", seguidores: val("ttSeg"), me_gusta_total: val("ttLikes"), vistas_total: val("ttVistas"), actualizada: new Date().toISOString() };
  if (fila.seguidores == null) { $("ttMsg").textContent = "Poné al menos los seguidores."; return; }
  $("ttGuardar").disabled = true;
  const r = await db.from("ee_metricas").upsert(fila, { onConflict: "fecha,red" });
  if (r.error) { $("ttMsg").textContent = "No se pudo guardar: " + r.error.message; $("ttGuardar").disabled = false; return; }
  await cargarMetricas(); renderCrecimiento();
}

// ------------------------------------------------------------------ conexiones

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function conectarCanva() {
  const verificador = base64url(crypto.getRandomValues(new Uint8Array(48)));
  const desafio = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verificador))));
  const estado = "canva-" + base64url(crypto.getRandomValues(new Uint8Array(12)));
  guardado.set("ee:canva", { verificador, estado });
  const p = new URLSearchParams({
    code_challenge_method: "s256", response_type: "code", client_id: C.CANVA_CLIENT_ID,
    redirect_uri: C.VUELTA, scope: "design:content:read design:meta:read profile:read",
    code_challenge: desafio, state: estado,
  });
  location.href = "https://www.canva.com/api/oauth/authorize?" + p.toString();
}

function enlaceInstagram() {
  const p = new URLSearchParams({
    force_reauth: "true", client_id: C.INSTAGRAM_APP_ID, redirect_uri: C.VUELTA, response_type: "code",
    scope: "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights", state: "instagram",
  });
  return "https://www.instagram.com/oauth/authorize?" + p.toString();
}

async function renderConexiones() {
  const zona = $("zonaConexiones");
  if (!usuario || !admin) { zona.innerHTML = ""; return; }
  const { data } = await db.rpc("ee_conexiones");
  const de = s => (data || []).find(x => x.servicio === s);
  const caja = (servicio, nombre, boton) => {
    const c = de(servicio);
    let estado = "No conectado", clase = "";
    if (c && c.estado === "conectado") { estado = `Conectado${c.cuenta ? " · " + esc(c.cuenta) : ""}`; clase = "publicada"; }
    else if (c && c.estado === "conectando") { estado = "Conectando… (tarda 1 o 2 minutos)"; clase = "pendiente"; }
    else if (c) { estado = esc(c.estado); clase = "error"; }
    return `<div class="estado ${clase}"><span class="dot ${clase}"></span><b>${nombre}</b> · ${estado}<div class="row" style="margin-top:8px">${boton}</div></div>`;
  };
  const botonCanva = C.CANVA_CLIENT_ID ? `<button id="conCanva">${de("canva") ? "Volver a conectar" : "Conectar Canva"}</button>`
    : `<span class="note" style="margin:0">Falta cargar el Client ID de Canva en config.js</span>`;
  zona.innerHTML = `<div class="section-title">Conexiones</div><div class="conex">
    ${caja("instagram", "Instagram", `<a class="btn" href="${enlaceInstagram()}">${de("instagram") ? "Volver a conectar" : "Conectar Instagram"}</a>`)}
    ${caja("canva", "Canva", botonCanva)}</div>
    <div class="note">Para conectar Instagram, entrá antes a instagram.com con la cuenta @escudo.estoico.</div>`;
  if ($("conCanva")) $("conCanva").onclick = conectarCanva;
}

async function renderSesion() {
  const barra = $("sesion");
  if (!db) { barra.innerHTML = "<span>No se pudo conectar con el servidor: se ve el contenido, pero no el estado de las publicaciones.</span>"; return; }
  if (!usuario) {
    barra.innerHTML = `<span>Entrá para ver qué se publicó, subir reels y conectar las redes.</span><button class="primary" id="entrar">Entrar con Google</button>`;
    $("entrar").onclick = () => db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
    return;
  }
  if (!admin) {
    barra.innerHTML = `<span>${esc(usuario.email)} no es administrador.</span><button id="salir">Salir</button>`;
  } else {
    barra.innerHTML = `<span>${esc(usuario.email)}</span><span class="row" style="margin:0"><button id="ahora">Publicar ahora lo pendiente</button><button id="salir">Salir</button></span>`;
    $("ahora").onclick = async () => { $("ahora").disabled = true; await db.rpc("ee_publicar_ya"); $("ahora").textContent = "Pedido: tarda 1 o 2 minutos"; };
  }
  $("salir").onclick = async () => { await db.auth.signOut(); usuario = null; admin = false; pubs = []; metricas = []; await renderSesion(); render(); renderConexiones(); renderCrecimiento(); };
}

// ------------------------------------------------------------------ arranque

document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-copy]"); if (!b) return;
  const txt = $(b.dataset.copy).textContent;
  try { await navigator.clipboard.writeText(txt); b.textContent = "Copiado"; b.classList.add("done"); }
  catch (e) { const r = document.createRange(); r.selectNodeContents($(b.dataset.copy)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Seleccionado"; }
  setTimeout(() => { b.textContent = "Copiar"; b.classList.remove("done"); }, 1600);
});
$("prev").onclick = () => { const d = deIso(cur); d.setDate(d.getDate() - 1); cur = isoDe(d); render(); };
$("next").onclick = () => { const d = deIso(cur); d.setDate(d.getDate() + 1); cur = isoDe(d); render(); };
$("today").onclick = () => { cur = hoyIso(); render(); };
$("pick").onchange = ev => { if (ev.target.value) { cur = ev.target.value; render(); } };

(async () => {
  cur = hoyIso();
  try {
    const r = await fetch("datos/semana.json", { cache: "no-store" });
    const j = await r.json();
    DIAS_DATOS = j.dias; DIAS_DATOS.forEach(e => porIso[e.iso] = e);
  } catch (e) {
    document.querySelector(".grid").innerHTML = '<div class="err">No se pudieron cargar los datos del panel.</div>';
  }
  try {
    if (!db) throw new Error("sin Supabase");
    const { data } = await db.auth.getSession();
    usuario = data.session ? data.session.user : null;
    if (usuario) { const r = await db.rpc("es_admin"); admin = r.data === true; }
  } catch (e) { usuario = null; }
  await cargarPublicaciones();
  await renderSesion();
  render();
  renderConexiones();
  await cargarMetricas();
  renderCrecimiento();
})();
