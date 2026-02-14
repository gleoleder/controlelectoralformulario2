# 🗄️ CONFIGURACIÓN DE GOOGLE SHEETS
## Sistema de Control Electoral 2026

---

## 📋 ESTRUCTURA DE LA BASE DE DATOS

Tu Google Sheet debe tener **4 hojas** con los siguientes nombres EXACTOS y columnas:

---

### 1️⃣ HOJA "Resultados"

Almacena los votos totales por recinto y partido.

**Columnas (en este orden):**

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| codigo | municipio | partido | candidato | votos | porcentaje | timestamp |

**Ejemplo de datos:**

```
codigo    municipio      partido    candidato              votos   porcentaje   timestamp
2954.1    La Paz        IH         Innovación Humana      155     56.4         2026-03-08 18:30
2954.1    La Paz        MAS-IPSP   MAS-IPSP              93      33.8         2026-03-08 18:30
2954.1    La Paz        CC         Comunidad Ciudadana   67      24.4         2026-03-08 18:30
```

**Notas:**
- `codigo`: Código del recinto (ej: 2954.1)
- `municipio`: Nombre del municipio
- `partido`: Sigla del partido político
- `candidato`: Nombre completo del candidato o partido
- `votos`: Total de votos (suma de todas las mesas)
- `porcentaje`: Porcentaje sobre el total
- `timestamp`: Fecha y hora del registro

---

### 2️⃣ HOJA "Fotos"

Almacena las URLs de las fotos de actas por mesa.

**Columnas (en este orden):**

| A | B | C | D | E |
|---|---|---|---|---|
| codigo | mesa | url_foto | timestamp | usuario |

**Ejemplo de datos:**

```
codigo    mesa     url_foto                                                    timestamp           usuario
2954.1    Mesa 1   https://drive.google.com/uc?id=1aBcDeFgHiJkLmN              2026-03-08 18:30   Sistema Web
2954.1    Mesa 2   https://drive.google.com/uc?id=2cDeFgHiJkLmNo              2026-03-08 18:35   Sistema Web
2954.1    Mesa 3   https://drive.google.com/uc?id=3eFgHiJkLmNoPq              2026-03-08 18:40   Sistema Web
```

**Notas:**
- `codigo`: Código del recinto
- `mesa`: Número de mesa (ej: "Mesa 1", "Mesa 2")
- `url_foto`: URL pública de la imagen
- `timestamp`: Fecha y hora de subida
- `usuario`: Quién subió la foto

---

### 3️⃣ HOJA "Candidatos" ⭐ CRÍTICA

Esta hoja define qué candidatos aparecen en cada municipio.

**Columnas (en este orden):**

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| municipio | partido | candidato | cargo | color | orden |

**Ejemplo de datos:**

```
municipio         partido    candidato                 cargo      color      orden
La Paz           IH         Iván Arias                Alcalde    #8B5CF6    1
La Paz           MAS-IPSP   David Apaza              Alcalde    #1E3A8A    2
La Paz           CC         María Fernández          Alcalde    #F97316    3
La Paz           CREEMOS    Roberto Gómez            Alcalde    #15803D    4
El Alto          IH         Eva Copa                  Alcalde    #8B5CF6    1
El Alto          MAS-IPSP   Zacarías Maquera         Alcalde    #1E3A8A    2
Cochabamba       IH         Manfred Reyes Villa      Alcalde    #8B5CF6    1
Cochabamba       MAS-IPSP   José María Leyes         Alcalde    #1E3A8A    2
Santa Cruz       IH         Percy Fernández          Alcalde    #8B5CF6    1
Santa Cruz       MAS-IPSP   Angélica Sosa            Alcalde    #1E3A8A    2
```

**Notas:**
- `municipio`: Nombre EXACTO del municipio (debe coincidir con los datos de recintos)
- `partido`: Sigla del partido
- `candidato`: Nombre completo del candidato
- `cargo`: Cargo al que postula (Alcalde, Concejal, etc.)
- `color`: Color en formato HEX (#RRGGBB)
- `orden`: Orden de aparición en el formulario (1, 2, 3...)

**⚠️ MUY IMPORTANTE:**
- El nombre del municipio debe ser IDÉNTICO al que aparece en `data.js`
- Si un municipio no está en esta hoja, se usarán candidatos predeterminados
- El color se usa para la visualización en gráficos

---

### 4️⃣ HOJA "Log"

Registro de auditoría de todas las operaciones.

**Columnas (en este orden):**

| A | B | C | D | E |
|---|---|---|---|---|
| timestamp | codigo | accion | usuario | detalles |

**Ejemplo de datos:**

```
timestamp           codigo    accion      usuario        detalles
2026-03-08 18:30   2954.1    GUARDADO    Sistema Web    3 resultados, 3 fotos
2026-03-08 18:45   2955.2    GUARDADO    Sistema Web    5 resultados, 5 fotos
2026-03-08 19:00   2954.1    EDICION     Sistema Web    Actualización de votos
```

---

## 🎨 COLORES SUGERIDOS PARA PARTIDOS

Usa estos colores HEX para consistencia visual:

```
IH              #8B5CF6   (Violeta)
MAS-IPSP        #1E3A8A   (Azul oscuro)
CC              #F97316   (Naranja)
CREEMOS         #15803D   (Verde)
FPV             #DC2626   (Rojo)
PDC             #07626B   (Teal)
MTS             #0891B2   (Cyan)
ASP             #E8532E   (Naranja rojizo)
SOL.BO          #F59E0B   (Amarillo)
PAN-BOL         #BE185D   (Rosa)
UCS             #0284C7   (Azul cielo)
UN              #6366F1   (Índigo)
UNIDOS          #059669   (Verde esmeralda)
ADN             #A16207   (Amarillo oscuro)
LIBRE           #E65152   (Rojo claro)
UNIDAD          #FEB44B   (Amarillo dorado)
AP              #03B4F0   (Celeste)
APB-SUMATE      #420855   (Morado oscuro)
```

---

## 📝 PASOS DE CONFIGURACIÓN

### 1. Crear las hojas

1. Abre tu Google Sheet: https://docs.google.com/spreadsheets/d/1FX9nniq3Caw6GEq-x1SWOvgrjQ5bchEaxGVxOxTvJgA/
2. Crea 4 hojas con los nombres exactos: `Resultados`, `Fotos`, `Candidatos`, `Log`
3. Agrega los encabezados en la fila 1 de cada hoja (ver arriba)

### 2. Formatear encabezados

Para cada hoja:
1. Selecciona la fila 1 (encabezados)
2. Formato → Negrita
3. Formato → Color de fondo → Violeta claro (#E9D5FF)

### 3. Llenar la hoja "Candidatos"

Esta es la hoja MÁS IMPORTANTE. Debes agregar todos los candidatos de todos los municipios.

**Ejemplo para 3 municipios:**

```csv
municipio,partido,candidato,cargo,color,orden
La Paz,IH,Iván Arias,Alcalde,#8B5CF6,1
La Paz,MAS-IPSP,David Apaza,Alcalde,#1E3A8A,2
La Paz,CC,María Fernández,Alcalde,#F97316,3
El Alto,IH,Eva Copa,Alcalde,#8B5CF6,1
El Alto,MAS-IPSP,Zacarías Maquera,Alcalde,#1E3A8A,2
Cochabamba,IH,Manfred Reyes Villa,Alcalde,#8B5CF6,1
Cochabamba,MAS-IPSP,José María Leyes,Alcalde,#1E3A8A,2
```

**📥 Tip:** Puedes copiar esto a Excel, completarlo, y pegarlo en Google Sheets.

### 4. Publicar la hoja

**CRÍTICO:** Para que el sistema pueda leer los datos:

1. Archivo → Compartir → Publicar en la web
2. En "Documento completo"
3. Formato: "Página web"
4. Click "Publicar"
5. Confirmar

### 5. Habilitar Google Sheets API

**IMPORTANTE:** Ya tienes la API Key, solo asegúrate de que:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Busca tu proyecto
3. APIs & Services → Library
4. Busca "Google Sheets API"
5. Asegúrate que esté HABILITADA ✅

---

## 🔧 VERIFICACIÓN DE FUNCIONAMIENTO

### Test 1: Leer datos

Abre la consola del navegador (F12) y ejecuta:

```javascript
// Debería devolver los candidatos
fetch('https://sheets.googleapis.com/v4/spreadsheets/1FX9nniq3Caw6GEq-x1SWOvgrjQ5bchEaxGVxOxTvJgA/values/Candidatos?key=AIzaSyAOhGTjJXHhuUhqf1g2DPCla59xNzftb-Q')
  .then(r => r.json())
  .then(d => console.log(d))
```

Si funciona, verás:
```json
{
  "values": [
    ["municipio", "partido", "candidato", ...],
    ["La Paz", "IH", "Iván Arias", ...]
  ]
}
```

### Test 2: Escribir datos

Para escribir necesitas usar la API con POST. El sistema ya lo hace automáticamente.

---

## 🚨 PROBLEMAS COMUNES

### Error 403: Permission Denied

**Causa:** La sheet no está publicada
**Solución:** Archivo → Publicar en la web

### Error 404: Sheet not found

**Causa:** Nombre de hoja incorrecto
**Solución:** Verifica que los nombres sean EXACTOS (mayúsculas/minúsculas importan)

### No carga candidatos

**Causa:** Columna "municipio" no coincide con data.js
**Solución:** Revisa que los nombres de municipios sean idénticos

### Candidatos predeterminados

**Causa:** No encontró el municipio en la hoja "Candidatos"
**Solución:** Agrega el municipio con sus candidatos

---

## 📊 EJEMPLO COMPLETO DE ESTRUCTURA

```
TU GOOGLE SHEET
├─ Resultados (7 columnas)
│  └─ codigo | municipio | partido | candidato | votos | porcentaje | timestamp
│
├─ Fotos (5 columnas)
│  └─ codigo | mesa | url_foto | timestamp | usuario
│
├─ Candidatos (6 columnas) ⭐
│  └─ municipio | partido | candidato | cargo | color | orden
│
└─ Log (5 columnas)
   └─ timestamp | codigo | accion | usuario | detalles
```

---

## 💡 TIPS AVANZADOS

### Agregar validación de datos

En Google Sheets:
1. Selecciona columna "partido" en Candidatos
2. Datos → Validación de datos
3. Lista de elementos: `IH,MAS-IPSP,CC,CREEMOS,FPV,...`

### Formato condicional

Para la columna "votos" en Resultados:
1. Selecciona columna E
2. Formato → Formato condicional
3. Color según el valor (verde para más votos)

### Proteger encabezados

1. Selecciona fila 1
2. Datos → Proteger hojas y rangos
3. Solo tú puedes editar

---

## 🎯 CHECKLIST FINAL

Antes de usar el sistema, verifica:

- [ ] 4 hojas creadas: Resultados, Fotos, Candidatos, Log
- [ ] Encabezados correctos en cada hoja
- [ ] Hoja "Candidatos" llena con al menos 3 municipios
- [ ] Sheet publicada en la web
- [ ] Google Sheets API habilitada
- [ ] API Key válida: AIzaSyAOhGTjJXHhuUhqf1g2DPCla59xNzftb-Q
- [ ] Sheet ID correcto: 1FX9nniq3Caw6GEq-x1SWOvgrjQ5bchEaxGVxOxTvJgA

---

¡Todo listo! El sistema ahora:

✅ Carga candidatos dinámicamente por municipio
✅ Guarda datos directamente en Google Sheets
✅ Mantiene registro de auditoría
✅ Funciona sin localStorage

---

*Sistema de Control Electoral · Innovación Humana 2026*
