// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                 SISTEMA DE LLENADO ELECTORAL - script.js                    ║
// ║                      Versión Mejorada - Con Provincia                        ║
// ╚════════════════════════════════════════════════════════════════════════════╝

// ══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE GOOGLE API (desde config.js)
// ══════════════════════════════════════════════════════════════════════════

const CLIENT_ID = CONFIG.CLIENT_ID;
const API_KEY = CONFIG.API_KEY;
const SPREADSHEET_ID = CONFIG.GOOGLE_SHEET_ID;
const SHEETS = CONFIG.SHEETS;

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const DRIVE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

const SCOPES =
    'https://www.googleapis.com/auth/spreadsheets ' +
    'https://www.googleapis.com/auth/drive.file ' +
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

// Cache de candidatos - AHORA CON CLAVE ÚNICA: departamento-provincia-municipio
let candidatosPorUbicacion = {};

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
        
        // Configurar eventos de zoom
        configurarEventosZoom();
        
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
            discoveryDocs: [DISCOVERY_DOC, DRIVE_DISCOVERY_DOC]
        });
        gapiInited = true;
        console.log('✅ Google API inicializada (Sheets + Drive)');
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
// CANDIDATOS - NUEVO SISTEMA CON DEPARTAMENTO-PROVINCIA-MUNICIPIO
// ══════════════════════════════════════════════════════════════════════════

async function cargarCandidatos() {
    if (!usuarioGoogle) return;

    showLoading('Cargando candidatos desde Google Sheets...');

    try {
        const candidatos = await leerHojaCompleta(SHEETS.CANDIDATOS);

        candidatosPorUbicacion = {};

        if (!candidatos || candidatos.length === 0) {
            hideLoading();
            showToast('⚠️ No hay candidatos en Google Sheets. Debes agregar candidatos primero.', 'error');
            return;
        }

        let errores = [];
        let procesados = 0;

        candidatos.forEach((c, index) => {
            const depto = (c.departamento || '').trim();
            const prov = (c.provincia || '').trim();
            const muni = (c.municipio || '').trim();
            const partido = (c.partido || '').trim();
            const nombre = (c.candidato || '').trim();
            const color = (c.color || '').trim();
            const orden = parseInt(c.orden || 999);

            // Validar campos obligatorios
            if (!depto || !prov || !muni || !partido) {
                errores.push(`Fila ${index + 2}: Faltan campos obligatorios (departamento, provincia, municipio o partido)`);
                return;
            }

            // Crear clave única: Departamento-Provincia-Municipio
            const clave = `${depto}|${prov}|${muni}`;

            if (!candidatosPorUbicacion[clave]) {
                candidatosPorUbicacion[clave] = [];
            }

            candidatosPorUbicacion[clave].push({
                partido,
                nombre: nombre || partido,
                color: color || '#6B7280',
                orden
            });

            procesados++;
        });

        // Ordenar candidatos por orden
        Object.keys(candidatosPorUbicacion).forEach(clave => {
            candidatosPorUbicacion[clave].sort((a, b) => a.orden - b.orden);
        });

        hideLoading();

        if (errores.length > 0) {
            console.warn('⚠️ Errores al cargar candidatos:', errores);
        }

        const numUbicaciones = Object.keys(candidatosPorUbicacion).length;
        console.log(`✅ Candidatos cargados: ${procesados} candidatos en ${numUbicaciones} ubicaciones`);
        showToast(`✅ ${procesados} candidatos cargados en ${numUbicaciones} ubicaciones`, 'success');

    } catch (error) {
        hideLoading();
        console.error('Error cargando candidatos:', error);
        showToast('❌ Error al cargar candidatos. Verifica la hoja "Candidatos" en Google Sheets.', 'error');
    }
}

function obtenerCandidatosRecinto(recinto) {
    // Crear clave única con departamento, provincia y municipio
    const clave = `${recinto.d}|${recinto.p}|${recinto.m}`;
    
    const candidatos = candidatosPorUbicacion[clave];
    
    if (!candidatos || candidatos.length === 0) {
        // No hay candidatos configurados para esta ubicación
        console.warn(`⚠️ No hay candidatos para: ${recinto.d} > ${recinto.p} > ${recinto.m}`);
        return null;
    }
    
    return candidatos;
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

    // Obtener nivel de zoom actual
    const zoom = map.getZoom();
    
    // Calcular radio del marcador según zoom - MÁS PEQUEÑOS para evitar sobreposición
    let radius;
    if (zoom <= 6) {
        radius = 1.5;  // Bolivia completa - muy pequeños
    } else if (zoom <= 7) {
        radius = 2;    // Vista general
    } else if (zoom <= 8) {
        radius = 2.5;  // Departamento
    } else if (zoom <= 10) {
        radius = 3.5;  // Provincia
    } else if (zoom <= 12) {
        radius = 5;    // Municipio
    } else if (zoom <= 14) {
        radius = 6;    // Cerca
    } else {
        radius = 8;    // Muy cerca
    }

    recintosFiltrados.forEach(r => {
        const estado = getEstadoRecinto(r.c);
        let color = '#5C6370';
        
        // Si tiene datos, colorear según el partido ganador
        if (estado === 'Completado' || estado === 'Parcial') {
            const partidoGanador = obtenerPartidoGanador(r.c);
            if (partidoGanador) {
                color = partidoGanador.color;
            } else {
                color = estado === 'Completado' ? '#10B981' : '#F59E0B';
            }
        }

        const marker = L.circleMarker([r.la, r.lo], {
            radius: radius,
            fillColor: color,
            color: 'none',
            weight: 0,
            opacity: 0.9,
            fillOpacity: 0.85,
            bubblingMouseEvents: false
        });

        // Click: abrir formulario directamente (stop propagation to prevent map pan)
        marker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            abrirModal(r);
        });
        
        marker.addTo(markersLayer);
    });

    actualizarEstadisticas();
}

// Nueva función para obtener el partido ganador
function obtenerPartidoGanador(codigo) {
    const datos = datosLlenados[codigo];
    if (!datos || !datos.totales || Object.keys(datos.totales).length === 0) {
        return null;
    }

    const totales = datos.totales;
    const recinto = recintos.find(r => r.c === codigo);
    if (!recinto) return null;

    const candidatos = obtenerCandidatosRecinto(recinto);
    if (!candidatos) return null;

    // Encontrar el partido con más votos
    let maxVotos = 0;
    let partidoGanador = null;

    Object.entries(totales).forEach(([partido, votos]) => {
        if (votos > maxVotos) {
            maxVotos = votos;
            partidoGanador = partido;
        }
    });

    if (!partidoGanador) return null;

    // Obtener el color del partido ganador
    const cand = candidatos.find(c => c.partido === partidoGanador);
    return cand ? { partido: partidoGanador, color: cand.color } : null;
}

// Actualizar tamaño de marcadores cuando cambia el zoom (debounced)
let zoomTimeout = null;
function configurarEventosZoom() {
    map.on('zoomend', function() {
        if (zoomTimeout) clearTimeout(zoomTimeout);
        zoomTimeout = setTimeout(function() {
            renderizarMapa();
        }, 150);
    });
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
// BÚSQUEDA EN TIEMPO REAL
// ══════════════════════════════════════════════════════════════════════════

let searchTimeout = null;

function busquedaEnTiempoReal(texto, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Limpiar timeout anterior (debounce)
    if (searchTimeout) clearTimeout(searchTimeout);
    
    const query = texto.trim().toLowerCase();
    
    if (query.length < 1) {
        container.innerHTML = '';
        container.classList.remove('show');
        return;
    }
    
    searchTimeout = setTimeout(() => {
        // Buscar en recintos
        const resultados = recintos.filter(r => {
            return r.c.toLowerCase().includes(query) ||
                   r.r.toLowerCase().includes(query) ||
                   r.m.toLowerCase().includes(query) ||
                   r.d.toLowerCase().includes(query);
        }).slice(0, 15); // Máximo 15 resultados
        
        if (resultados.length === 0) {
            container.innerHTML = '<div class="search-no-results">No se encontraron recintos</div>';
            container.classList.add('show');
            return;
        }
        
        let html = '';
        resultados.forEach(r => {
            const estado = getEstadoRecinto(r.c);
            const estadoIcon = estado === 'Completado' ? '✅' : estado === 'Parcial' ? '⚠️' : '⏳';
            
            // Resaltar coincidencia
            const nombreResaltado = resaltarTexto(r.r, query);
            const codigoResaltado = resaltarTexto(r.c, query);
            
            html += `
                <div class="search-result-item" onclick="seleccionarRecintoBusqueda('${r.c}', '${containerId}')">
                    <div class="search-result-main">
                        <span class="search-result-estado">${estadoIcon}</span>
                        <div class="search-result-info">
                            <div class="search-result-nombre">${nombreResaltado}</div>
                            <div class="search-result-detalle">${codigoResaltado} · ${r.m}, ${r.d}</div>
                        </div>
                    </div>
                    <div class="search-result-mesas">${r.ms || 1} mesa${(r.ms || 1) > 1 ? 's' : ''}</div>
                </div>
            `;
        });
        
        if (recintos.filter(r => {
            return r.c.toLowerCase().includes(query) ||
                   r.r.toLowerCase().includes(query) ||
                   r.m.toLowerCase().includes(query) ||
                   r.d.toLowerCase().includes(query);
        }).length > 15) {
            html += '<div class="search-more">Mostrando 15 de más resultados...</div>';
        }
        
        container.innerHTML = html;
        container.classList.add('show');
    }, 120); // 120ms debounce
}

function resaltarTexto(texto, query) {
    if (!query) return texto;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return texto.replace(regex, '<mark>$1</mark>');
}

function seleccionarRecintoBusqueda(codigo, containerId) {
    const recinto = recintos.find(r => r.c === codigo);
    if (!recinto) return;
    
    // Cerrar resultados
    document.getElementById(containerId).innerHTML = '';
    document.getElementById(containerId).classList.remove('show');
    
    // Cerrar barra de búsqueda móvil si aplica
    document.getElementById('mobileSearchBar')?.classList.remove('show');
    
    // Cerrar sidebar en móvil
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('show');
        document.getElementById('btnToggleSidebar')?.classList.remove('active');
    }
    
    // Centrar mapa en el recinto
    map.setView([recinto.la, recinto.lo], 14, { animate: true });
    
    // Abrir modal después de centrar
    setTimeout(() => {
        abrirModal(recinto);
    }, 400);
}

// ══════════════════════════════════════════════════════════════════════════
// MODAL DE LLENADO - MEJORADO CON MEJOR CSS
// ══════════════════════════════════════════════════════════════════════════

function abrirModal(recinto) {
    // Verificar si hay candidatos para esta ubicación
    const candidatos = obtenerCandidatosRecinto(recinto);
    
    if (!candidatos) {
        showToast(`⚠️ No hay candidatos configurados para: ${recinto.d} > ${recinto.p} > ${recinto.m}. Agrégalos en Google Sheets.`, 'warning');
        return;
    }

    recintoActual = recinto;
    mesaActual = 1;

    document.getElementById('modalTitle').textContent = recinto.r;
    document.getElementById('modalSubtitle').textContent = `${recinto.m}, ${recinto.p}, ${recinto.d} · Código: ${recinto.c}`;

    renderizarFormularioModal();

    document.getElementById('modalLlenado').classList.add('open');
}

function renderizarFormularioModal() {
    if (!recintoActual) return;

    const candidatos = obtenerCandidatosRecinto(recintoActual);
    
    if (!candidatos) {
        document.getElementById('modalBody').innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h3>No hay candidatos configurados</h3>
                <p>Para este recinto: <strong>${recintoActual.d} > ${recintoActual.p} > ${recintoActual.m}</strong></p>
                <p>Por favor, agrega los candidatos en la hoja "Candidatos" de Google Sheets.</p>
            </div>
        `;
        return;
    }

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
                return `<button class="tab-btn ${activa} ${tieneDatos}" onclick="cambiarMesa(${num})">
                    <span class="tab-number">Mesa ${num}</span>
                    ${tieneDatos ? '<span class="tab-check">✓</span>' : ''}
                </button>`;
            }).join('')}
        </div>

        <div class="form-section">
            <div class="section-header">
                <div class="section-icon">🗳️</div>
                <div class="section-title">Votos por candidato</div>
            </div>
            
            <div class="candidatos-grid">
                ${candidatos.map(c => `
                    <div class="candidato-card">
                        <div class="candidato-header" style="background: ${c.color};">
                            <div class="partido-badge">
                                <span class="partido-sigla">${c.partido}</span>
                            </div>
                            <div class="candidato-nombre">${c.nombre}</div>
                        </div>
                        <div class="voto-input-wrapper">
                            <input 
                                type="number" 
                                min="0" 
                                value="${datosMesa.votos[c.partido] || ''}"
                                placeholder="0"
                                class="voto-input"
                                id="voto_${c.partido}"
                                onchange="guardarVoto('${c.partido}', this.value)"
                            />
                            <span class="voto-label">votos</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="form-section">
            <div class="section-header">
                <div class="section-icon">📸</div>
                <div class="section-title">Fotos de actas</div>
            </div>
            
            <div class="file-upload-area">
                <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    class="file-input-hidden" 
                    id="inputFotos"
                    onchange="procesarFotos(this.files)"
                />
                <label for="inputFotos" class="file-upload-label">
                    <div class="upload-icon">📁</div>
                    <div class="upload-text">
                        <strong>Click para subir fotos a Google Drive</strong>
                        <small>Se guardarán en tu carpeta de actas electorales</small>
                    </div>
                </label>
            </div>

            ${(datosMesa.fotos && datosMesa.fotos.length > 0) ? `
                <div class="fotos-grid">
                    ${datosMesa.fotos.map((url, i) => `
                        <div class="foto-card">
                            <img src="${url}" alt="Acta ${i + 1}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23f3f4f6%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-size=%2214%22>📷 Drive</text></svg>'">
                            <a href="${url.replace('uc?export=view&', 'file/d/').replace('id=', '').replace(/$/,'') }" target="_blank" class="btn-view-foto" title="Ver en Drive">
                                🔗
                            </a>
                            <button onclick="eliminarFoto(${i})" class="btn-delete-foto" title="Eliminar foto">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 6L6 18M6 6l12 12"/>
                                </svg>
                            </button>
                            <div class="foto-numero">Foto ${i + 1}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
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

    if (!usuarioGoogle) {
        showToast('⚠️ Debes conectarte con Google primero para subir fotos', 'warning');
        return;
    }

    if (!datosLlenados[recintoActual.c].mesas[mesaActual]) {
        datosLlenados[recintoActual.c].mesas[mesaActual] = { votos: {}, fotos: [] };
    }

    const totalFiles = files.length;
    let subidas = 0;
    let errores = 0;

    showLoading(`Subiendo foto 1 de ${totalFiles} a Google Drive...`);

    for (const file of files) {
        try {
            subidas++;
            document.getElementById('loadingText').textContent = 
                `Subiendo foto ${subidas} de ${totalFiles} a Google Drive...`;

            const driveUrl = await subirFotoADrive(file);
            
            if (driveUrl) {
                datosLlenados[recintoActual.c].mesas[mesaActual].fotos.push(driveUrl);
                console.log(`✅ Foto subida: ${driveUrl}`);
            } else {
                errores++;
                console.error('❌ No se obtuvo URL de Drive');
            }
        } catch (error) {
            errores++;
            console.error('❌ Error subiendo foto:', error);
        }
    }

    hideLoading();
    renderizarFormularioModal();

    if (errores > 0) {
        showToast(`⚠️ ${subidas - errores} foto(s) subida(s), ${errores} con error`, 'warning');
    } else {
        showToast(`✅ ${subidas} foto(s) subida(s) a Google Drive`, 'success');
    }
}

// ══════════════════════════════════════════════════════════════════════════
// SUBIDA DE FOTOS A GOOGLE DRIVE
// ══════════════════════════════════════════════════════════════════════════

async function subirFotoADrive(file) {
    const token = gapi.client.getToken();
    if (!token) {
        throw new Error('No hay token de autenticación');
    }

    // Generar nombre descriptivo para el archivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const codigo = recintoActual.c;
    const mesa = mesaActual;
    const nombreArchivo = `acta_${codigo}_mesa${mesa}_${timestamp}_${file.name}`;

    // Metadata del archivo para Drive
    const metadata = {
        name: nombreArchivo,
        mimeType: file.type,
        parents: [CONFIG.DRIVE_FOLDER_ID]
    };

    // Crear multipart request (metadata + archivo)
    const boundary = '-------314159265358979323846';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelimiter = '\r\n--' + boundary + '--';

    // Leer archivo como ArrayBuffer
    const fileContent = await leerArchivoComoArrayBuffer(file);
    
    // Construir el body multipart manualmente
    const metadataPart = delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata);

    const filePart = delimiter +
        'Content-Type: ' + file.type + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n';

    // Convertir ArrayBuffer a base64
    const base64Data = arrayBufferToBase64(fileContent);

    const requestBody = metadataPart + filePart + base64Data + closeDelimiter;

    // Subir a Google Drive usando fetch (multipart upload)
    const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
        {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token.access_token,
                'Content-Type': 'multipart/related; boundary=' + boundary
            },
            body: requestBody
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Error Drive API:', errorData);
        throw new Error(`Error ${response.status}: ${errorData.error?.message || 'Error desconocido'}`);
    }

    const result = await response.json();
    console.log('📁 Archivo creado en Drive:', result);

    // Hacer el archivo público para que se pueda ver
    await hacerArchivoPublico(result.id, token.access_token);

    // Retornar URL directa de la imagen
    const urlDirecta = `https://drive.google.com/uc?export=view&id=${result.id}`;
    return urlDirecta;
}

async function hacerArchivoPublico(fileId, accessToken) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role: 'reader',
                    type: 'anyone'
                })
            }
        );

        if (!response.ok) {
            console.warn('⚠️ No se pudo hacer público el archivo, pero se subió correctamente');
        } else {
            console.log('🔓 Archivo hecho público');
        }
    } catch (e) {
        console.warn('⚠️ Error al cambiar permisos:', e);
    }
}

function leerArchivoComoArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        reader.readAsArrayBuffer(file);
    });
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
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
// GUARDAR DATOS - ACTUALIZADO CON PROVINCIA
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
        const candidatos = obtenerCandidatosRecinto(recintoActual);
        const timestamp = new Date().toLocaleString('es-BO');

        // Preparar resultados - AHORA CON PROVINCIA
        const filasResultados = [];
        Object.entries(totales).forEach(([partido, votos]) => {
            const cand = candidatos.find(c => c.partido === partido);
            const totalVotos = Object.values(totales).reduce((a, b) => a + b, 0);
            const porcentaje = totalVotos > 0 ? ((votos / totalVotos) * 100).toFixed(2) : 0;

            filasResultados.push([
                codigo,
                recintoActual.d,      // Departamento
                recintoActual.p,      // Provincia
                recintoActual.m,      // Municipio
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
// CARGAR DATOS EXISTENTES - ACTUALIZADO
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
// FORMULARIO DE AGREGAR CANDIDATOS
// ══════════════════════════════════════════════════════════════════════════

function poblarListasUbicacion() {
    // Obtener valores únicos
    const departamentos = [...new Set(recintos.map(r => r.d))].sort();
    
    // Poblar departamentos
    const selDep = document.getElementById('candidatoDepartamento');
    selDep.innerHTML = '<option value="">Seleccionar...</option>';
    departamentos.forEach(d => {
        selDep.innerHTML += `<option value="${d}">${d}</option>`;
    });
}

function actualizarProvincias() {
    const depSeleccionado = document.getElementById('candidatoDepartamento').value;
    const selProv = document.getElementById('candidatoProvincia');
    const selMuni = document.getElementById('candidatoMunicipio');
    
    // Limpiar provincia y municipio
    selProv.innerHTML = '<option value="">Seleccionar...</option>';
    selMuni.innerHTML = '<option value="">Seleccionar...</option>';
    
    if (!depSeleccionado) return;
    
    // Filtrar provincias del departamento seleccionado
    const provincias = [...new Set(
        recintos
            .filter(r => r.d === depSeleccionado)
            .map(r => r.p)
    )].sort();
    
    provincias.forEach(p => {
        selProv.innerHTML += `<option value="${p}">${p}</option>`;
    });
}

function actualizarMunicipios() {
    const depSeleccionado = document.getElementById('candidatoDepartamento').value;
    const provSeleccionada = document.getElementById('candidatoProvincia').value;
    const selMuni = document.getElementById('candidatoMunicipio');
    
    // Limpiar municipios
    selMuni.innerHTML = '<option value="">Seleccionar...</option>';
    
    if (!depSeleccionado || !provSeleccionada) return;
    
    // Filtrar municipios de la provincia seleccionada
    const municipios = [...new Set(
        recintos
            .filter(r => r.d === depSeleccionado && r.p === provSeleccionada)
            .map(r => r.m)
    )].sort();
    
    municipios.forEach(m => {
        selMuni.innerHTML += `<option value="${m}">${m}</option>`;
    });
}

function sincronizarColorPicker() {
    const picker = document.getElementById('candidatoColorPicker');
    const input = document.getElementById('candidatoColor');
    
    picker.addEventListener('input', (e) => {
        input.value = e.target.value.toUpperCase();
    });
    
    input.addEventListener('input', (e) => {
        const color = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(color)) {
            picker.value = color;
        }
    });
}

async function agregarCandidato() {
    if (!usuarioGoogle) {
        showToast('⚠️ Debes conectarte con Google primero', 'warning');
        return;
    }
    
    // Obtener valores
    const departamento = document.getElementById('candidatoDepartamento').value.trim();
    const provincia = document.getElementById('candidatoProvincia').value.trim();
    const municipio = document.getElementById('candidatoMunicipio').value.trim();
    const partido = document.getElementById('candidatoPartido').value.trim();
    const candidato = document.getElementById('candidatoNombre').value.trim();
    const cargo = document.getElementById('candidatoCargo').value.trim();
    const color = document.getElementById('candidatoColor').value.trim();
    const orden = parseInt(document.getElementById('candidatoOrden').value) || 1;
    
    // Validar campos obligatorios
    if (!departamento || !provincia || !municipio || !partido) {
        showToast('⚠️ Completa todos los campos obligatorios', 'warning');
        return;
    }
    
    // Validar color HEX
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
        showToast('⚠️ El color debe ser en formato HEX (ejemplo: #8B5CF6)', 'warning');
        return;
    }
    
    showLoading('Guardando candidato...');
    
    try {
        const timestamp = new Date().toLocaleString('es-BO');
        
        // Preparar fila para agregar a Sheets
        const fila = [[
            departamento,
            provincia,
            municipio,
            partido,
            candidato || partido,
            cargo || 'Alcalde',
            color.toUpperCase(),
            orden
        ]];
        
        // Guardar en Google Sheets
        await agregarFilas(SHEETS.CANDIDATOS, fila);
        
        // Actualizar caché local
        const clave = `${departamento}|${provincia}|${municipio}`;
        if (!candidatosPorUbicacion[clave]) {
            candidatosPorUbicacion[clave] = [];
        }
        
        candidatosPorUbicacion[clave].push({
            partido,
            nombre: candidato || partido,
            color: color.toUpperCase(),
            orden
        });
        
        // Ordenar por orden
        candidatosPorUbicacion[clave].sort((a, b) => a.orden - b.orden);
        
        hideLoading();
        showToast(`✅ Candidato ${partido} agregado correctamente`, 'success');
        
        // Limpiar formulario
        document.getElementById('candidatoPartido').value = '';
        document.getElementById('candidatoNombre').value = '';
        document.getElementById('candidatoOrden').value = parseInt(document.getElementById('candidatoOrden').value) + 1;
        
        // Log
        const filaLog = [[
            timestamp,
            `${departamento}-${provincia}-${municipio}`,
            'CANDIDATO_AGREGADO',
            emailUsuario || 'Sistema Web',
            `${partido}: ${candidato || partido}`
        ]];
        agregarFilas(SHEETS.LOG, filaLog).catch(e => console.error('Error en log:', e));
        
    } catch (error) {
        hideLoading();
        showToast('❌ Error al guardar candidato: ' + error.message, 'error');
        console.error('Error:', error);
    }
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
        poblarListasUbicacion();
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
    
    // BÚSQUEDA EN TIEMPO REAL - Sidebar
    const searchInput = document.getElementById('searchRecinto');
    searchInput?.addEventListener('input', function() {
        busquedaEnTiempoReal(this.value, 'searchResults');
        renderizarMapa();
    });
    searchInput?.addEventListener('focus', function() {
        if (this.value.length >= 1) {
            busquedaEnTiempoReal(this.value, 'searchResults');
        }
    });
    
    // Cerrar resultados al hacer click fuera
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-wrapper') && !e.target.closest('.mobile-search-bar')) {
            document.getElementById('searchResults').innerHTML = '';
            document.getElementById('searchResults').classList.remove('show');
            document.getElementById('mobileSearchResults').innerHTML = '';
            document.getElementById('mobileSearchResults').classList.remove('show');
        }
    });
    
    // BÚSQUEDA MÓVIL
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    mobileSearchInput?.addEventListener('input', function() {
        busquedaEnTiempoReal(this.value, 'mobileSearchResults');
    });
    mobileSearchInput?.addEventListener('focus', function() {
        if (this.value.length >= 1) {
            busquedaEnTiempoReal(this.value, 'mobileSearchResults');
        }
    });
    
    document.getElementById('btnMobileSearch')?.addEventListener('click', function() {
        const bar = document.getElementById('mobileSearchBar');
        bar.classList.toggle('show');
        if (bar.classList.contains('show')) {
            mobileSearchInput.focus();
        }
    });
    
    document.getElementById('btnCloseMobileSearch')?.addEventListener('click', function() {
        document.getElementById('mobileSearchBar').classList.remove('show');
        mobileSearchInput.value = '';
        document.getElementById('mobileSearchResults').innerHTML = '';
        document.getElementById('mobileSearchResults').classList.remove('show');
    });

    // Event listeners para formulario de candidatos
    document.getElementById('candidatoDepartamento')?.addEventListener('change', actualizarProvincias);
    document.getElementById('candidatoProvincia')?.addEventListener('change', actualizarMunicipios);
    sincronizarColorPicker();

    document.getElementById('btnToggleSidebar')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('show');
        document.getElementById('btnToggleSidebar').classList.toggle('active');
    });

    document.addEventListener('click', e => {
        if (window.innerWidth <= 768) {
            if (!e.target.closest('.sidebar') && !e.target.closest('#btnToggleSidebar') && !e.target.closest('.mobile-search-bar')) {
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
