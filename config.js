// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                ARCHIVO DE CONFIGURACIÓN - config.js                          ║
// ║                   Sistema Electoral Bolivia 2026                             ║
// ║                                                                              ║
// ║  Este archivo contiene todas las configuraciones necesarias para conectar   ║
// ║  el sistema con Google Sheets.                                               ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const CONFIG = {
    
    // ══════════════════════════════════════════════════════════════════════════
    // ID DEL DOCUMENTO DE GOOGLE SHEETS
    // ══════════════════════════════════════════════════════════════════════════
    GOOGLE_SHEET_ID: '1FX9nniq3Caw6GEq-x1SWOvgrjQ5bchEaxGVxOxTvJgA',
    
    // ══════════════════════════════════════════════════════════════════════════
    // CREDENCIALES DE GOOGLE API
    // ══════════════════════════════════════════════════════════════════════════
    CLIENT_ID: '814005655098-8csk41qts3okv4b2fjnq7ls4qc2kq0vc.apps.googleusercontent.com',
    API_KEY: 'AIzaSyAOhGTjJXHhuUhqf1g2DPCla59xNzftb-Q',
    
    // ══════════════════════════════════════════════════════════════════════════
    // NOMBRES DE LAS HOJAS DE LA BASE DE DATOS
    // ══════════════════════════════════════════════════════════════════════════
    SHEETS: {
        RESULTADOS: 'Resultados',
        FOTOS: 'Fotos',
        CANDIDATOS: 'Candidatos',
        LOG: 'Log'
    }
};
