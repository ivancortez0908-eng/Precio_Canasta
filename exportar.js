/* Exportación de una lista: tabla para imprimir (PDF) y archivo de Excel (.xlsx). Sin dependencias. */
(function (root) {
  const C = typeof module !== "undefined" && module.exports ? require("./comparador.js") : root.Canasta;
  const COL_CANTIDAD = 3;

  // Filas de la lista: producto, presentación, cantidad, precio por tienda y dónde conviene comprar.
  // Los precios son números; una tienda sin precio queda vacía, nunca en cero.
  function tablaLista(items, tiendas, presentacion = () => "") {
    const cabecera = ["Producto", "Marca", "Presentación", "Cantidad", ...tiendas, "Más barato en", "Subtotal", "Precio consultado"];
    const filas = items.map(f => {
      const ops = tiendas.filter(s => C.precioValido(f.t[s]?.p)).sort((a, b) => f.t[a].p - f.t[b].p), mejor = ops[0];
      const fechas = Object.values(f.t).map(v => (v.f || "").slice(0, 10)).filter(Boolean).sort();
      return [f.n || "", f.m || "", presentacion(f), f.cant, ...tiendas.map(s => C.precioValido(f.t[s]?.p) ? f.t[s].p : ""),
        mejor || "Sin precio", mejor ? Math.round(f.t[mejor].p * 100) * f.cant / 100 : "",
        fechas.length ? (fechas[0] === fechas.at(-1) ? fechas[0] : `${fechas[0]} a ${fechas.at(-1)}`) : ""];
    });
    const { res, mix, sinPrecio } = C.resumir(items, tiendas);
    const n = items.length;
    const pie = [
      ["Total por tienda", "", "", items.reduce((a, f) => a + f.cant, 0), ...res.map(r => r.faltan === n ? "" : r.total), "", "", ""],
      ["Productos con precio", "", "", "", ...res.map(r => `${n - r.faltan} de ${n}${r.faltan ? " (total parcial)" : ""}`), "", "", ""],
      ["Comprando cada producto donde es más barato", "", "", "", ...tiendas.map(() => ""), sinPrecio ? `Parcial: ${sinPrecio} sin precio` : "", mix, ""]
    ];
    return { cabecera, filas, pie };
  }

  // ---------- Excel: libro mínimo en formato .xlsx (ZIP sin compresión) ----------
  const xml = s => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const columna = i => (i >= 26 ? columna(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));
  // Estilos: 0 normal, 1 moneda, 2 negrita
  function celda(v, fila, col, negrita) {
    const r = columna(col) + fila;
    if (typeof v === "number") return `<c r="${r}" s="${col === COL_CANTIDAD ? 0 : 1}"><v>${v}</v></c>`;
    if (v === "" || v == null) return "";
    return `<c r="${r}" t="inlineStr"${negrita ? ' s="2"' : ""}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }
  function hoja(titulo, nota, tabla) {
    const filas = [[titulo], [nota], [], tabla.cabecera, ...tabla.filas, [], ...tabla.pie];
    const negritas = new Set([1, 4, ...tabla.pie.map((_, i) => 6 + tabla.filas.length + i)]);
    const anchos = tabla.cabecera.map((_, i) => i === 0 ? 42 : i === tabla.cabecera.length - 1 ? 22 : i < COL_CANTIDAD ? 16 : 14);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>` +
      filas.map((f, i) => `<row r="${i + 1}">${f.map((v, c) => celda(v, i + 1, c, negritas.has(i + 1) && (i + 1 === 4 || c === 0 || i === 0))).join("")}</row>`).join("") +
      "</sheetData></worksheet>";
  }
  const ESTILOS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  function xlsx(titulo, nota, tabla) {
    const nombreHoja = xml(titulo.replace(/[\[\]:*?\/\\]/g, " ").trim().slice(0, 31) || "Lista");
    const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    return zip({
      "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><sheets><sheet name="${nombreHoja}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/></Relationships>`,
      "xl/styles.xml": ESTILOS,
      "xl/worksheets/sheet1.xml": hoja(titulo, nota, tabla)
    });
  }

  // ZIP sin compresión: suficiente para un libro pequeño y sin librerías externas
  const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(archivos) {
    const enc = new TextEncoder(), partes = [], central = [];
    let pos = 0;
    const cabecera = (tam, campos) => { const b = new Uint8Array(tam), d = new DataView(b.buffer); campos.forEach(([o, v, n]) => n === 4 ? d.setUint32(o, v, true) : d.setUint16(o, v, true)); return b; };
    for (const [nombre, texto] of Object.entries(archivos)) {
      const n = enc.encode(nombre), datos = enc.encode(texto), crc = crc32(datos);
      // versión 20, UTF-8 en nombres (bit 11), sin compresión, fecha 1/1/2026
      const comun = [[0x0800, 2], [0, 2], [0, 2], [(46 << 9) | (1 << 5) | 1, 2], [crc, 4], [datos.length, 4], [datos.length, 4], [n.length, 2], [0, 2]];
      const local = cabecera(30, [[0, 0x04034b50, 4], [4, 20, 2], ...comun.map(([v, t], i) => [6 + [0, 2, 4, 6, 8, 12, 16, 20, 22][i], v, t])]);
      partes.push(local, n, datos);
      central.push(cabecera(46, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], ...comun.map(([v, t], i) => [8 + [0, 2, 4, 6, 8, 12, 16, 20, 22][i], v, t]),
        [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, pos, 4]]), n);
      pos += local.length + n.length + datos.length;
    }
    const tamCentral = central.reduce((a, b) => a + b.length, 0), cuenta = Object.keys(archivos).length;
    const fin = cabecera(22, [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, cuenta, 2], [10, cuenta, 2], [12, tamCentral, 4], [16, pos, 4], [20, 0, 2]]);
    const todo = [...partes, ...central, fin], out = new Uint8Array(todo.reduce((a, b) => a + b.length, 0));
    let o = 0; for (const b of todo) { out.set(b, o); o += b.length; }
    return out;
  }

  const api = { tablaLista, xlsx };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Exportar = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
