(function () {
  "use strict";

  var reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var punteroFino = window.matchMedia("(pointer: fine)").matches;
  var anchoGrande = window.innerWidth >= 900;

  var tareas = [];
  var corriendo = false;

  function sumarTarea(fn) {
    tareas.push(fn);
    if (!corriendo) {
      corriendo = true;
      requestAnimationFrame(latir);
    }
  }

  function latir(t) {
    for (var i = 0; i < tareas.length; i++) tareas[i](t);
    requestAnimationFrame(latir);
  }

  function aurora() {
    if (reducido) return;
    // Inicio: hero plano verdecito clarito, sin blur/aurora.
    if (document.body.classList.contains("pagina-inicio")) return;
    var hero = document.querySelector("main section");
    if (!hero || hero.querySelector(".aurora")) return;
    hero.classList.add("tiene-aurora");

    var lienzo = document.createElement("canvas");
    lienzo.className = "aurora";
    hero.insertBefore(lienzo, hero.firstChild);

    var gl = null;
    try {
      gl = lienzo.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: false });
    } catch (e) {
      gl = null;
    }

    if (!gl || !anchoGrande) {
      lienzo.classList.add("aurora-css", "viva");
      return;
    }

    var vertice = [
      "attribute vec2 pos;",
      "void main(){ gl_Position = vec4(pos, 0.0, 1.0); }"
    ].join("\n");

    var esPrepagas = document.body.classList.contains("pagina-prepagas");
    var esReferencias = document.body.classList.contains("pagina-referencias");
    var colHielo = esReferencias ? "vec3(0.94, 0.93, 1.0)" : esPrepagas ? "vec3(0.965, 0.94, 1.0)" : "vec3(0.898, 0.969, 0.949)";
    var colAgua = esReferencias ? "vec3(0.62, 0.60, 0.92)" : esPrepagas ? "vec3(0.82, 0.65, 0.88)" : "vec3(0.310, 0.741, 0.698)";
    var colMenta = esReferencias ? "vec3(0.42, 0.36, 0.78)" : esPrepagas ? "vec3(0.78, 0.32, 0.58)" : "vec3(0.055, 0.486, 0.447)";
    var fragmento = [
      "precision highp float;",
      "uniform vec2 tam;",
      "uniform float tiempo;",
      "uniform vec2 puntero;",
      "uniform float scroll;",
      "float ruido(vec2 p){",
      "  return sin(p.x) * sin(p.y);",
      "}",
      "float capas(vec2 p){",
      "  float v = 0.0;",
      "  float a = 0.55;",
      "  for(int i = 0; i < 5; i++){",
      "    v += a * ruido(p);",
      "    p = p * 1.9 + vec2(1.3, -2.1);",
      "    a *= 0.55;",
      "  }",
      "  return v;",
      "}",
      "void main(){",
      "  vec2 uv = gl_FragCoord.xy / tam;",
      "  vec2 c = (uv - 0.5) * vec2(tam.x / tam.y, 1.0);",
      "  vec2 m = (puntero - 0.5) * vec2(tam.x / tam.y, 1.0);",
      "  float d = length(c - m);",
      "  float t = tiempo * 0.18 + scroll * 1.4;",
      "  vec2 q = c * 3.2 + vec2(t, -t * 0.7);",
      "  q += vec2(capas(q + t * 0.4), capas(q.yx - t * 0.3)) * 0.55;",
      "  q -= (c - m) * exp(-d * 3.0) * 1.1;",
      "  float f = capas(q);",
      "  vec3 hielo = " + colHielo + ";",
      "  vec3 agua = " + colAgua + ";",
      "  vec3 menta = " + colMenta + ";",
      "  vec3 col = mix(hielo, agua, smoothstep(-0.4, 0.9, f));",
      "  col = mix(col, menta, smoothstep(0.35, 1.25, f + 0.35 * exp(-d * 2.4)));",
      "  float halo = exp(-d * 2.2) * 0.22;",
      "  col += halo;",
      "  float vin = smoothstep(1.25, 0.15, length(c));",
      "  float alfa = (0.5 + 0.35 * smoothstep(-0.5, 1.0, f)) * vin;",
      "  gl_FragColor = vec4(col, alfa);",
      "}"
    ].join("\n");

    function compilar(tipo, fuente) {
      var s = gl.createShader(tipo);
      gl.shaderSource(s, fuente);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
      return s;
    }

    var vs = compilar(gl.VERTEX_SHADER, vertice);
    var fs = compilar(gl.FRAGMENT_SHADER, fragmento);
    if (!vs || !fs) {
      lienzo.classList.add("aurora-css", "viva");
      return;
    }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      lienzo.classList.add("aurora-css", "viva");
      return;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var uTam = gl.getUniformLocation(prog, "tam");
    var uTiempo = gl.getUniformLocation(prog, "tiempo");
    var uPuntero = gl.getUniformLocation(prog, "puntero");
    var uScroll = gl.getUniformLocation(prog, "scroll");

    var raton = { x: 0.5, y: 0.55 };
    var suave = { x: 0.5, y: 0.55 };

    window.addEventListener(
      "pointermove",
      function (e) {
        var r = lienzo.getBoundingClientRect();
        raton.x = (e.clientX - r.left) / r.width;
        raton.y = 1 - (e.clientY - r.top) / r.height;
      },
      { passive: true }
    );

    function medir() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var r = lienzo.getBoundingClientRect();
      lienzo.width = Math.max(1, Math.round(r.width * dpr));
      lienzo.height = Math.max(1, Math.round(r.height * dpr));
      gl.viewport(0, 0, lienzo.width, lienzo.height);
    }

    medir();
    window.addEventListener("resize", medir);
    requestAnimationFrame(function () {
      lienzo.classList.add("viva");
    });

    var lento = 0;
    var previo = 0;

    sumarTarea(function (t) {
      var r = lienzo.getBoundingClientRect();
      if (r.bottom < 0) return;
      if (previo) {
        var dt = t - previo;
        if (dt > 34) lento++;
        else lento = Math.max(0, lento - 1);
        if (lento > 90) {
          lienzo.classList.add("aurora-css");
          lienzo.style.display = "none";
          hero.style.background = "";
          return;
        }
      }
      previo = t;
      suave.x += (raton.x - suave.x) * 0.05;
      suave.y += (raton.y - suave.y) * 0.05;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      gl.uniform2f(uTam, lienzo.width, lienzo.height);
      gl.uniform1f(uTiempo, t / 1000);
      gl.uniform2f(uPuntero, suave.x, suave.y);
      gl.uniform1f(uScroll, max > 0 ? window.scrollY / max : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
  }

  function relieve() {
    if (reducido || !punteroFino) return;
    [].forEach.call(document.querySelectorAll(".tarjeta"), function (el) {
      if (el.dataset.relieve) return;
      el.dataset.relieve = "1";
      el.classList.add("relieve");
      var destino = { x: 0, y: 0 };
      var actual = { x: 0, y: 0 };
      var activa = false;

      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        destino.x = (py - 0.5) * -9;
        destino.y = (px - 0.5) * 9;
        el.style.setProperty("--luz-x", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--luz-y", (py * 100).toFixed(1) + "%");
        if (!activa) {
          activa = true;
          el.classList.add("encendida");
          animar();
        }
      });

      el.addEventListener("pointerleave", function () {
        destino.x = 0;
        destino.y = 0;
        el.classList.remove("encendida");
      });

      function animar() {
        actual.x += (destino.x - actual.x) * 0.12;
        actual.y += (destino.y - actual.y) * 0.12;
        el.style.transform =
          "perspective(900px) rotateX(" + actual.x.toFixed(2) + "deg) rotateY(" + actual.y.toFixed(2) + "deg)";
        if (Math.abs(destino.x - actual.x) > 0.02 || Math.abs(destino.y - actual.y) > 0.02) {
          requestAnimationFrame(animar);
        } else {
          el.style.transform = "";
          activa = false;
        }
      }
    });
  }

  function mezcla() {
    if (reducido || !punteroFino) return;
    var abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var nodos = document.querySelectorAll(".menu-texto, .marca-logo, .etiqueta");
    [].forEach.call(nodos, function (el) {
      if (el.dataset.mezcla) return;
      el.dataset.mezcla = "1";
      el.classList.add("mezcla");
      var original = el.textContent;
      var timer = null;

      el.addEventListener("pointerenter", function () {
        var vuelta = 0;
        clearInterval(timer);
        timer = setInterval(function () {
          el.textContent = original
            .split("")
            .map(function (c, i) {
              if (i < vuelta || c === " ") return original[i];
              return abc[Math.floor(Math.random() * abc.length)];
            })
            .join("");
          vuelta += original.length / 12;
          if (vuelta >= original.length) {
            clearInterval(timer);
            el.textContent = original;
          }
        }, 34);
      });

      el.addEventListener("pointerleave", function () {
        clearInterval(timer);
        el.textContent = original;
      });
    });
  }

  function contadores() {
    var nodos = document.querySelectorAll("[data-cuenta]");
    if (!nodos.length) return;
    var io = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          io.unobserve(entrada.target);
          var el = entrada.target;
          var fin = parseFloat(el.dataset.cuenta);
          var sufijo = el.dataset.sufijo || "";
          if (reducido) {
            el.textContent = fin + sufijo;
            return;
          }
          var t0 = performance.now();
          (function paso(t) {
            var p = Math.min(1, (t - t0) / 1400);
            var e = 1 - Math.pow(1 - p, 4);
            el.textContent = Math.round(fin * e) + sufijo;
            if (p < 1) requestAnimationFrame(paso);
          })(t0);
        });
      },
      { rootMargin: "0px 0px -15% 0px" }
    );
    [].forEach.call(nodos, function (el) {
      io.observe(el);
    });
  }

  function seccionActual() {
    var cabecera = document.querySelector(".cabecera-derecha");
    if (!cabecera) return;
    var chip = cabecera.querySelector(".seccion-actual");
    if (!chip) {
      chip = document.createElement("span");
      chip.className = "seccion-actual";
      chip.innerHTML = "<span></span>";
      cabecera.insertBefore(chip, cabecera.firstChild);
    }
    var texto = chip.querySelector("span");
    var secciones = [].slice.call(document.querySelectorAll("main section"));
    if (!secciones.length) return;
    var ultimo = "";

    sumarTarea(function () {
      var medio = window.innerHeight * 0.35;
      var nombre = "";
      for (var i = 0; i < secciones.length; i++) {
        var r = secciones[i].getBoundingClientRect();
        if (r.top <= medio && r.bottom > medio) {
          var titulo = secciones[i].querySelector("h1, h2, .titulo-mediano");
          if (titulo) {
            nombre = (titulo.innerText || titulo.textContent).replace(/\s+/g, " ").trim();
            if (nombre.length > 24) nombre = nombre.slice(0, 23).trim() + "\u2026";
          }
          break;
        }
      }
      if (nombre === ultimo) return;
      ultimo = nombre;
      texto.style.transform = "translateY(-110%)";
      setTimeout(function () {
        texto.textContent = nombre;
        texto.style.transition = "none";
        texto.style.transform = "translateY(110%)";
        requestAnimationFrame(function () {
          texto.style.transition = "";
          texto.style.transform = "translateY(0)";
        });
      }, 320);
    });
  }

  function profundidad() {
    if (reducido || !anchoGrande) return;
    var tarjetas = [].slice.call(document.querySelectorAll(".tarjeta"));
    if (!tarjetas.length) return;
    sumarTarea(function () {
      var vh = window.innerHeight;
      for (var i = 0; i < tarjetas.length; i++) {
        var el = tarjetas[i];
        if (el.classList.contains("encendida")) continue;
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        var p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.9)));
        var y = (1 - p) * 18;
        el.style.setProperty("--hondo", y.toFixed(2) + "px");
      }
    });
  }

  function transicion() {
    if (reducido) return;
    var velo = document.querySelector(".velo");
    if (!velo) {
      velo = document.createElement("div");
      velo.className = "velo";
      document.body.appendChild(velo);
    }
    var navegando = false;

    function pintar(html, url, empuje) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var nuevo = doc.querySelector("main");
      var viejo = document.querySelector("main");
      if (!nuevo || !viejo) {
        window.location.href = url;
        return;
      }
      viejo.replaceWith(nuevo);
      document.title = doc.title;
      var etiqueta = doc.querySelector(".pagina-actual");
      var actual = document.querySelector(".pagina-actual");
      if (etiqueta && actual) actual.textContent = etiqueta.textContent;
      [].forEach.call(document.querySelectorAll(".menu-enlace"), function (a) {
        a.classList.toggle("activo", a.getAttribute("href") === url.split("/").pop());
      });
      if (empuje) history.pushState({ sitio: true }, "", url);
      window.scrollTo(0, 0);
      if (window.sitio) window.sitio.recargar();
      if (window.extras) window.extras.recargar();
      recargar();
    }

    function ir(url, x, y, empuje) {
      if (navegando) return;
      navegando = true;
      velo.style.setProperty("--vx", x + "px");
      velo.style.setProperty("--vy", y + "px");
      velo.classList.remove("sale");
      velo.classList.add("entra");
      var listo = fetch(url, { headers: { "x-parcial": "1" } }).then(function (r) {
        if (!r.ok) throw new Error("fallo");
        return r.text();
      });
      var espera = new Promise(function (res) {
        setTimeout(res, 620);
      });
      Promise.all([listo, espera])
        .then(function (v) {
          pintar(v[0], url, empuje);
          requestAnimationFrame(function () {
            velo.classList.remove("entra");
            velo.classList.add("sale");
            setTimeout(function () {
              navegando = false;
            }, 720);
          });
        })
        .catch(function () {
          window.location.href = url;
        });
    }

    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || a.target === "_blank" || href.charAt(0) === "#") return;
      if (/^(https?:|mailto:|tel:)/.test(href)) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      var abierto = document.querySelector(".menu.abierto");
      if (abierto) {
        var boton = document.querySelector("[data-menu-btn]");
        if (boton) boton.click();
      }
      ir(href, e.clientX, e.clientY, true);
    });

    window.addEventListener("popstate", function () {
      ir(window.location.pathname.split("/").pop() || "index.html", window.innerWidth / 2, window.innerHeight / 2, false);
    });
  }

  function recargar() {
    aurora();
    relieve();
    mezcla();
    contadores();
    profundidad();
  }

  function arrancar() {
    recargar();
    seccionActual();
    transicion();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
