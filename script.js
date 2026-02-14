// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                 SISTEMA DE LLENADO ELECTORAL - script.js                    ║
// ║                      Versión Corregida - Mapa Funcional                      ║
// ╚════════════════════════════════════════════════════════════════════════════╝

// ══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE GOOGLE API (desde config.js)
// ══════════════════════════════════════════════════════════════════════════

const CLIENT_ID = CONFIG.CLIENT_ID;
const API_KEY = CONFIG.API_KEY;
const SPREADSHEET_ID = CONFIG.GOOGLE_SHEET_ID;
const SHEETS = CONFIG.SHEETS;

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

const SCOPES =
    'https://www.googleapis.com/auth/spreadsheets ' +
    'https://www.googleapis.com/auth/userinfo.profile ' +
    'https://www.googleapis.com/auth/userinfo.email';

// ══════════════════════════════════════════════════════════════════════════
// VARIABLES DE ESTADO
// ══════════════════════════════════════════════════════════════════════════

let tokenClient;
let gapiInited = false;
let gisInited = false;
let usuarioGoogle = false;
let emailUsuario = '';

// Cache de candidatos
let candidatosPorMunicipio = {};

// Estado del mapa y datos
let recintos = [];
let datosLlenados = {};
let recintoActual = null;
let mesaActual = 1;

// Mapa Leaflet - SE INICIALIZA DESPUÉS DEL DOM
let map = null;
let markersLayer = null;

// ══════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN DEL MAPA (DESPUÉS DE QUE EL DOM ESTÉ LISTO)
// ══════════════════════════════════════════════════════════════════════════

function inicializarMapa() {
    console.log('🗺️ Inicializando mapa...');
    
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('❌ Elemento #map no encontrado');
        return;
    }

    try {
        map = L.map('map', {
            zoomControl: true,
            attributionControl: false
        }).setView([-16.5, -64.5], 6);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: ''
        }).addTo(map);

        markersLayer = L.layerGroup().addTo(map);
        
        console.log('✅ Mapa inicializado correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar mapa:', error);
        showToast('Error al cargar el mapa', 'error');
    }
}

// ══════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN DE GOOGLE API
// ══════════════════════════════════════════════════════════════════════════

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC]
        });
        gapiInited = true;
        console.log('✅ Google API inicializada');
        checkReady();
    } catch (e) {
        console.error('❌ Error GAPI:', e);
        showToast('Error al inicializar Google API', 'error');
    }
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleTokenResponse
    });
    gisInited = true;
    console.log('✅ Google Identity Services cargado');
    checkReady();
}

function checkReady() {
    if (gapiInited && gisInited) {
        console.log('🗳️ Sistema Electoral listo');
        const savedToken = localStorage.getItem('electoral_google_token');
        if (savedToken) {
            gapi.client.setToken({ access_token: savedToken });
            verificarToken();
        } else {
            updateConnectionStatus(false);
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════
// AUTENTICACIÓN CON GOOGLE
// ══════════════════════════════════════════════════════════════════════════

function handleGoogleAuth() {
    if (usuarioGoogle) {
        // Desconectar
        const token = gapi.client.getToken();
        if (token) {
            google.accounts.oauth2.revoke(token.access_token, () => {
                gapi.client.setToken(null);
                localStorage.removeItem('electoral_google_token');
                usuarioGoogle = false;
                emailUsuario = '';
                updateConnectionStatus(false);
                showToast('Sesión cerrada correctamente', 'success');
            });
        }
    } else {
        // Conectar
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }
}

async function handleTokenResponse(response) {
    if (response.error !== undefined) {
        console.error('Error en token:', response);
        showToast('Error de autenticación: ' + response.error, 'error');
        return;
    }

    const token = gapi.client.getToken().access_token;
    localStorage.setItem('electoral_google_token', token);
    
    await obtenerInfoUsuario();
    usuarioGoogle = true;
    updateConnectionStatus(true);
    
    showToast(`✅ Conectado como ${emailUsuario}`, 'success');
    
    // Cargar datos
    await cargarCandidatos();
    await cargarDatosExistentes();
}

async function verificarToken() {
    try {
        const token = gapi.client.getToken();
        if (!token) {
            updateConnectionStatus(false);
            return;
        }

        const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token.access_token);
        
        if (response.ok) {
            await obtenerInfoUsuario();
            usuarioGoogle = true;
            updateConnectionStatus(true);
            await cargarCandidatos();
            await cargarDatosExistentes();
        } else {
            localStorage.removeItem('electoral_google_token');
            gapi.client.setToken(null);
            updateConnectionStatus(false);
        }
    } catch (e) {
        console.error('Error verificando token:', e);
        updateConnectionStatus(false);
    }
}

async function obtenerInfoUsuario() {
    try {
        const token = gapi.client.getToken().access_token;
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        emailUsuario = data.email;
        document.getElementById('userEmail').textContent = emailUsuario;
    } catch (e) {
        console.error('Error obteniendo info:', e);
        emailUsuario = 'Usuario';
    }
}

function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const btnGoogle = document.getElementById('btnGoogle');
    const btnText = document.getElementById('btnGoogleText');
    const userEmail = document.getElementById('userEmail');

    if (connected) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Conectado';
        btnText.textContent = 'Desconectar';
        userEmail.style.display = 'inline-block';
    } else {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Desconectado';
        btnText.textContent = 'Conectar';
        userEmail.style.display = 'none';
        userEmail.textContent = '';
    }
}

// ══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE GOOGLE SHEETS
// ══════════════════════════════════════════════════════════════════════════

async function leerHojaCompleta(nombreHoja) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: nombreHoja
        });

        const rows = response.result.values;
        if (!rows || rows.length === 0) return [];

        const headers = rows[0].map(h => h.toLowerCase().trim());
        const data = rows.slice(1);

        return data.map(row => {
            const obj = {};
            headers.forEach((header, i) => {
                obj[header] = row[i] || '';
            });
            return obj;
        });
    } catch (e) {
        console.error(`Error leyendo ${nombreHoja}:`, e);
        throw e;
    }
}

async function agregarFilas(nombreHoja, filas) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${nombreHoja}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: filas }
        });
        return response;
    } catch (e) {
        console.error(`Error agregando a ${nombreHoja}:`, e);
        throw e;
    }
}

// ══════════════════════════════════════════════════════════════════════════
// CANDIDATOS
// ══════════════════════════════════════════════════════════════════════════

const candidatosPredeterminados = [
    { partido: 'IH', nombre: 'Innovación Humana', color: '#8B5CF6', orden: 1 },
    { partido: 'MAS-IPSP', nombre: 'MAS-IPSP', color: '#1E3A8A', orden: 2 },
    { partido: 'CC', nombre: 'Comunidad Ciudadana', color: '#F97316', orden: 3 },
    { partido: 'CREEMOS', nombre: 'CREEMOS', color: '#15803D', orden: 4 },
    { partido: 'FPV', nombre: 'Frente Para la Victoria', color: '#DC2626', orden: 5 }
];

async function cargarCandidatos() {
    if (!usuarioGoogle) return;

    showLoading('Cargando candidatos...');

    try {
        const candidatos = await leerHojaCompleta(SHEETS.CANDIDATOS);

        candidatosPorMunicipio = {};

        if (candidatos && candidatos.length > 0) {
            candidatos.forEach(c => {
                const muni = (c.municipio || '').trim();
                const partido = (c.partido || '').trim();
                const nombre = (c.candidato || '').trim();
                const color = (c.color || '').trim();
                const orden = parseInt(c.orden || 999);

                if (!muni || !partido) return;

                if (!candidatosPorMunicipio[muni]) {
                    candidatosPorMunicipio[muni] = [];
                }

                candidatosPorMunicipio[muni].push({
                    partido,
                    nombre: nombre || partido,
                    color: color || '#6B7280',
                    orden
                });
            });

            Object.keys(candidatosPorMunicipio).forEach(muni => {
                candidatosPorMunicipio[muni].sort((a, b) => a.orden - b.orden);
            });

            console.log(`✅ Candidatos cargados: ${Object.keys(candidatosPorMunicipio).length} municipios`);
        }

        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('Error cargando candidatos:', error);
        showToast('No se pudieron cargar candidatos, usando predeterminados', 'warning');
    }
}

function obtenerCandidatosMunicipio(municipio) {
    return candidatosPorMunicipio[municipio] || candidatosPredeterminados;
}

// ══════════════════════════════════════════════════════════════════════════
// RENDERIZADO DEL MAPA
// ══════════════════════════════════════════════════════════════════════════

function renderizarMapa() {
    if (!map || !markersLayer) {
        console.warn('⚠️ Mapa no inicializado todavía');
        return;
    }

    markersLayer.clearLayers();

    const depSeleccionado = document.getElementById('selDep').value;
    const estadoSeleccionado = document.getElementById('selEstado').value;
    const busqueda = document.getElementById('searchRecinto').value.toLowerCase();

    const recintosFiltrados = recintos.filter(r => {
        const matchDep = depSeleccionado === 'Todos' || r.d === depSeleccionado;
        const matchEstado = estadoSeleccionado === 'Todos' || getEstadoRecinto(r.c) === estadoSeleccionado;
        const matchBusq = !busqueda ||
            r.c.toLowerCase().includes(busqueda) ||
            r.r.toLowerCase().includes(busqueda) ||
            r.m.toLowerCase().includes(busqueda);
        return matchDep && matchEstado && matchBusq;
    });

    recintosFiltrados.forEach(r => {
        const estado = getEstadoRecinto(r.c);
        let color = '#9CA3AF';
        if (estado === 'Completado') color = '#10B981';
        else if (estado === 'Parcial') color = '#F59E0B';

        const marker = L.circleMarker([r.la, r.lo], {
            radius: 6,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        marker.bindPopup(`
            <div style="min-width:200px">
                <strong>${r.r}</strong><br>
                <small>${r.m}, ${r.d}</small><br>
                <small>Código: ${r.c}</small><br>
                <small>Mesas: ${r.ms || 1}</small><br>
                <small>Estado: ${estado}</small>
            </div>
        `);

        marker.on('click', () => abrirModal(r));
        marker.addTo(markersLayer);
    });

    actualizarEstadisticas();
}

function getEstadoRecinto(codigo) {
    const datos = datosLlenados[codigo];
    if (!datos || !datos.mesas || Object.keys(datos.mesas).length === 0) {
        return 'Pendiente';
    }

    const recinto = recintos.find(r => r.c === codigo);
    if (!recinto) return 'Pendiente';

    const totalMesas = recinto.ms || 1;
    const mesasConDatos = Object.keys(datos.mesas).length;

    if (mesasConDatos >= totalMesas) return 'Completado';
    if (mesasConDatos > 0) return 'Parcial';
    return 'Pendiente';
}

// ══════════════════════════════════════════════════════════════════════════
// MODAL DE LLENADO
// ══════════════════════════════════════════════════════════════════════════

function abrirModal(recinto) {
    recintoActual = recinto;
    mesaActual = 1;

    document.getElementById('modalTitle').textContent = recinto.r;
    document.getElementById('modalSubtitle').textContent = `${recinto.m}, ${recinto.d} · Código: ${recinto.c}`;

    renderizarFormularioModal();

    document.getElementById('modalLlenado').classList.add('open');
}

function renderizarFormularioModal() {
    if (!recintoActual) return;

    const candidatos = obtenerCandidatosMunicipio(recintoActual.m);
    const totalMesas = recintoActual.ms || 1;

    if (!datosLlenados[recintoActual.c]) {
        datosLlenados[recintoActual.c] = { mesas: {}, totales: {} };
    }

    const datosMesa = datosLlenados[recintoActual.c].mesas[mesaActual] || { votos: {}, fotos: [] };

    let html = `
        <div class="modal-tabs">
            ${Array.from({ length: totalMesas }, (_, i) => {
                const num = i + 1;
                const activa = num === mesaActual ? 'active' : '';
                const tieneDatos = datosLlenados[recintoActual.c].mesas[num] ? 'has-data' : '';
                return `<button class="tab-btn ${activa} ${tieneDatos}" onclick="cambiarMesa(${num})">Mesa ${num}</button>`;
            }).join('')}
        </div>

        <div class="form-group">
            <label class="form-label">Votos por candidato</label>
            ${candidatos.map(c => `
                <div class="input-row">
                    <div class="partido-badge" style="background: ${c.color}20; color: ${c.color}">
                        ${c.partido}
                    </div>
                    <input 
                        type="number" 
                        min="0" 
                        value="${datosMesa.votos[c.partido] || ''}"
                        placeholder="0"
                        class="form-input"
                        id="voto_${c.partido}"
                        onchange="guardarVoto('${c.partido}', this.value)"
                    />
                </div>
            `).join('')}
        </div>

        <div class="form-group">
            <label class="form-label">Fotos de actas</label>
            <input 
                type="file" 
                accept="image/*" 
                multiple 
                class="file-input" 
                id="inputFotos"
                onchange="procesarFotos(this.files)"
            />
            <div class="fotos-preview" id="fotosPreview">
                ${(datosMesa.fotos || []).map((url, i) => `
                    <div class="foto-item">
                        <img src="${url}" alt="Foto ${i + 1}">
                        <button onclick="eliminarFoto(${i})" class="btn-delete-foto">✕</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('modalBody').innerHTML = html;
}

function cambiarMesa(numero) {
    mesaActual = numero;
    renderizarFormularioModal();
}

function guardarVoto(partido, valor) {
    if (!datosLlenados[recintoActual.c].mesas[mesaActual]) {
        datosLlenados[recintoActual.c].mesas[mesaActual] = { votos: {}, fotos: [] };
    }

    const votos = parseInt(valor) || 0;
    if (votos > 0) {
        datosLlenados[recintoActual.c].mesas[mesaActual].votos[partido] = votos;
    } else {
        delete datosLlenados[recintoActual.c].mesas[mesaActual].votos[partido];
    }
}

async function procesarFotos(files) {
    if (!files || files.length === 0) return;

    showLoading('Subiendo fotos...');

    if (!datosLlenados[recintoActual.c].mesas[mesaActual]) {
        datosLlenados[recintoActual.c].mesas[mesaActual] = { votos: {}, fotos: [] };
    }

    for (const file of files) {
        const reader = new FileReader();
        reader.onload = e => {
            const base64 = e.target.result;
            datosLlenados[recintoActual.c].mesas[mesaActual].fotos.push(base64);
            renderizarFormularioModal();
        };
        reader.readAsDataURL(file);
    }

    hideLoading();
    showToast(`✅ ${files.length} foto(s) agregada(s)`, 'success');
}

function eliminarFoto(index) {
    if (datosLlenados[recintoActual.c].mesas[mesaActual]) {
        datosLlenados[recintoActual.c].mesas[mesaActual].fotos.splice(index, 1);
        renderizarFormularioModal();
        showToast('Foto eliminada', 'success');
    }
}

function calcularTotales(codigo) {
    const datos = datosLlenados[codigo];
    if (!datos || !datos.mesas) return {};

    const totales = {};
    Object.values(datos.mesas).forEach(mesa => {
        Object.entries(mesa.votos || {}).forEach(([partido, votos]) => {
            totales[partido] = (totales[partido] || 0) + parseInt(votos || 0);
        });
    });

    datosLlenados[codigo].totales = totales;
    return totales;
}

// ══════════════════════════════════════════════════════════════════════════
// GUARDAR DATOS
// ══════════════════════════════════════════════════════════════════════════

async function guardarDatos() {
    if (!usuarioGoogle) {
        showToast('⚠️ Debes conectarte con Google primero', 'warning');
        return;
    }

    const codigo = recintoActual.c;
    const datos = datosLlenados[codigo];

    if (!datos || !datos.mesas || Object.keys(datos.mesas).length === 0) {
        showToast('⚠️ No hay datos para guardar', 'warning');
        return;
    }

    showLoading('Guardando en Google Sheets...');

    try {
        const totales = calcularTotales(codigo);
        const candidatos = obtenerCandidatosMunicipio(recintoActual.m);
        const timestamp = new Date().toLocaleString('es-BO');

        // Preparar resultados
        const filasResultados = [];
        Object.entries(totales).forEach(([partido, votos]) => {
            const cand = candidatos.find(c => c.partido === partido);
            const totalVotos = Object.values(totales).reduce((a, b) => a + b, 0);
            const porcentaje = totalVotos > 0 ? ((votos / totalVotos) * 100).toFixed(2) : 0;

            filasResultados.push([
                codigo,
                recintoActual.m,
                partido,
                cand?.nombre || partido,
                votos,
                porcentaje,
                timestamp
            ]);
        });

        // Preparar fotos
        const filasFotos = [];
        Object.entries(datos.mesas).forEach(([numMesa, mesa]) => {
            if (mesa.fotos && mesa.fotos.length > 0) {
                mesa.fotos.forEach(url => {
                    filasFotos.push([
                        codigo,
                        `Mesa ${numMesa}`,
                        url,
                        timestamp,
                        emailUsuario || 'Sistema Web'
                    ]);
                });
            }
        });

        // Guardar
        const promesas = [];

        if (filasResultados.length > 0) {
            promesas.push(agregarFilas(SHEETS.RESULTADOS, filasResultados));
        }

        if (filasFotos.length > 0) {
            promesas.push(agregarFilas(SHEETS.FOTOS, filasFotos));
        }

        // Log
        const filaLog = [[
            timestamp,
            codigo,
            'GUARDADO',
            emailUsuario || 'Sistema Web',
            `${filasResultados.length} resultados, ${filasFotos.length} fotos`
        ]];
        promesas.push(agregarFilas(SHEETS.LOG, filaLog));

        await Promise.all(promesas);

        hideLoading();
        const totalVotos = Object.values(totales).reduce((a, b) => a + b, 0);
        showToast(`✅ Datos guardados: ${totalVotos} votos totales`, 'success');

        cerrarModal();
        renderizarMapa();

    } catch (error) {
        hideLoading();
        showToast('❌ Error al guardar: ' + error.message, 'error');
        console.error('Error:', error);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// CARGAR DATOS EXISTENTES
// ══════════════════════════════════════════════════════════════════════════

async function cargarDatosExistentes() {
    if (!usuarioGoogle) {
        showToast('Conecta con Google primero', 'warning');
        return;
    }

    showLoading('Cargando datos...');

    try {
        datosLlenados = {};

        const resultados = await leerHojaCompleta(SHEETS.RESULTADOS);
        if (resultados && resultados.length > 0) {
            resultados.forEach(r => {
                const codigo = String(r.codigo || '').trim();
                const partido = (r.partido || '').trim();
                const votos = parseInt(r.votos || 0);

                if (!codigo || !partido) return;

                if (!datosLlenados[codigo]) {
                    datosLlenados[codigo] = { mesas: {}, totales: {} };
                }
                if (!datosLlenados[codigo].mesas[1]) {
                    datosLlenados[codigo].mesas[1] = { votos: {}, fotos: [] };
                }
                datosLlenados[codigo].mesas[1].votos[partido] = votos;
            });
        }

        const fotosData = await leerHojaCompleta(SHEETS.FOTOS);
        if (fotosData && fotosData.length > 0) {
            fotosData.forEach(f => {
                const codigo = String(f.codigo || '').trim();
                const url = (f.url_foto || '').trim();
                const mesa = (f.mesa || 'Mesa 1').trim();
                const numMesa = parseInt(mesa.match(/\d+/)?.[0] || '1');

                if (!codigo || !url) return;

                if (!datosLlenados[codigo]) {
                    datosLlenados[codigo] = { mesas: {}, totales: {} };
                }
                if (!datosLlenados[codigo].mesas[numMesa]) {
                    datosLlenados[codigo].mesas[numMesa] = { votos: {}, fotos: [] };
                }
                datosLlenados[codigo].mesas[numMesa].fotos.push(url);
            });
        }

        Object.keys(datosLlenados).forEach(codigo => {
            const recinto = recintos.find(r => r.c === codigo);
            if (recinto) {
                recintoActual = recinto;
                calcularTotales(codigo);
            }
        });

        hideLoading();
        const numCargados = Object.keys(datosLlenados).length;

        renderizarMapa();
        showToast(`✅ Datos cargados: ${numCargados} recintos`, 'success');

    } catch (error) {
        hideLoading();
        showToast('Error al cargar datos', 'error');
        console.error(error);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// ESTADÍSTICAS Y FILTROS
// ══════════════════════════════════════════════════════════════════════════

function actualizarEstadisticas() {
    const completados = recintos.filter(r => getEstadoRecinto(r.c) === 'Completado').length;
    const pendientes = recintos.filter(r => getEstadoRecinto(r.c) === 'Pendiente').length;

    document.getElementById('statCargados').textContent = `${completados} recintos cargados`;
    document.getElementById('statPendientes').textContent = `${pendientes} pendientes`;

    if (completados > 0) {
        document.getElementById('statCargados').className = 'hdr-pill ok';
    }
}

function llenarFiltros() {
    const deps = [...new Set(recintos.map(r => r.d))].sort();
    const selDep = document.getElementById('selDep');
    selDep.innerHTML = '<option value="Todos">Todos los departamentos</option>';
    deps.forEach(d => {
        selDep.innerHTML += `<option value="${d}">${d}</option>`;
    });
}

// ══════════════════════════════════════════════════════════════════════════
// MODAL Y EVENTOS
// ══════════════════════════════════════════════════════════════════════════

function cerrarModal() {
    document.getElementById('modalLlenado').classList.remove('open');
    recintoActual = null;
    mesaActual = 1;
}

// ══════════════════════════════════════════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════════════════════════════════════════

function showLoading(text = 'Cargando...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    icon.textContent = icons[type] || icons.info;
    msg.textContent = message;

    toast.className = 'toast show ' + type;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ══════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN GLOBAL - ESPERAR A QUE EL DOM ESTÉ LISTO
// ══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM cargado, iniciando sistema...');
    
    // Inicializar mapa
    inicializarMapa();
    
    // Cargar datos de recintos
    if (typeof R !== 'undefined' && R.length > 0) {
        recintos = R.map(r => ({ ...r }));
        
        llenarFiltros();
        renderizarMapa();
        
        console.log(`✅ ${recintos.length} recintos cargados`);
    } else {
        console.error('❌ No se encontraron datos de recintos');
        showToast('Error: No se encontraron datos de recintos', 'error');
    }
    
    // Event listeners
    document.getElementById('btnCloseModal')?.addEventListener('click', cerrarModal);
    document.getElementById('btnCancelar')?.addEventListener('click', cerrarModal);
    document.getElementById('btnGuardar')?.addEventListener('click', guardarDatos);

    document.getElementById('selDep')?.addEventListener('change', renderizarMapa);
    document.getElementById('selEstado')?.addEventListener('change', renderizarMapa);
    document.getElementById('searchRecinto')?.addEventListener('input', renderizarMapa);

    document.getElementById('btnToggleSidebar')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('show');
        document.getElementById('btnToggleSidebar').classList.toggle('active');
    });

    document.addEventListener('click', e => {
        if (window.innerWidth <= 768) {
            if (!e.target.closest('.sidebar') && !e.target.closest('#btnToggleSidebar')) {
                document.getElementById('sidebar').classList.remove('show');
                document.getElementById('btnToggleSidebar')?.classList.remove('active');
            }
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.getElementById('modalLlenado').classList.contains('open')) {
            cerrarModal();
        }
    });
});
