/** Contrato congelado 09/11/2026 — cambios solo mediante revisión del integrador. */
export const API = {
 auth: {login:'/api/auth/login',logout:'/api/auth/logout',me:'/api/auth/me'},
 tickets:{list:'/api/tickets',create:'/api/tickets',detail:(id:number)=>`/api/tickets/${id}`,decision:(id:number)=>`/api/tickets/${id}/decision`,history:(id:number)=>`/api/tickets/${id}/historial`,state:(id:number)=>`/api/tickets/${id}/estado`},
 triaje:{catalogs:'/api/triaje/catalogos',suggest:'/api/triaje/sugerir'},
 admin:{metrics:'/api/admin/metricas',tryPhrase:'/api/admin/probar-frase'},
} as const;
