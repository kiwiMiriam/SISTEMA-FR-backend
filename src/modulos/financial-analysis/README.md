# 📊 Financial Analysis API - Analista de Valor Fundamental

## 🏗️ Arquitectura Hexagonal

Este módulo implementa una API completa para análisis de valor fundamental usando **arquitectura hexagonal** con separación clara de responsabilidades:

```
src/modulos/financial-analysis/
├── domain/                     # 🎯 Capa de Dominio
│   ├── entities/              # Entidades de negocio
│   ├── services/              # Servicios de dominio
│   └── repositories/          # Interfaces (puertos)
├── application/               # 🔄 Capa de Aplicación
│   └── use-cases/            # Casos de uso
└── infrastructure/           # 🔧 Capa de Infraestructura
    ├── controllers/          # Controladores REST
    ├── repositories/         # Implementaciones de repositorios
    ├── adapters/            # Adaptadores para APIs externas
    ├── services/            # Servicios de infraestructura
    └── dto/                 # DTOs para validación
```

## 📈 Cálculos Financieros Implementados

### 1. **Piotroski F-Score (0-9)**
Evalúa la fortaleza financiera en 3 categorías:
- **Rentabilidad**: Utilidad neta positiva, flujo de efectivo operativo positivo, ROA mejorado
- **Apalancamiento**: Reducción de deuda, mejora en ratio corriente, no emisión de acciones
- **Eficiencia**: Mejora en margen bruto, mejora en rotación de activos

### 2. **Altman Z-Score**
Predictor de bancarrota empresarial:
- **Manufactureras**: Z = 1.2A + 1.4B + 3.3C + 0.6D + 1.0E
- **No Manufactureras**: Z = 6.56A + 3.26B + 6.72C + 1.05D
- **Interpretación**: SAFE (>2.99), GREY_ZONE (1.8-2.99), DISTRESS (<1.8)

### 3. **Beneish M-Score**
Detector de manipulación contable (8 variables):
- DSRI, GMI, AQI, SGI, DEPI, SGAI, TATA, LVGI
- **Interpretación**: LOW_RISK (<-2.22), MODERATE_RISK (-2.22 a -1.78), HIGH_RISK (>-1.78)

## 🚀 Endpoints Principales

### **GET** `/api/v1/financial-analysis/analyze/:ticker`
Análisis principal por ticker con caché inteligente (24h)

**Query Parameters:**
- `forceRefresh`: Forzar actualización (ignorar caché)
- `isManufacturing`: Tipo de empresa para Altman Z-Score

**Ejemplo de Respuesta:**
```json
{
  "success": true,
  "data": {
    "ticker": "AAPL",
    "companyName": "Apple Inc.",
    "piotroskiScore": {
      "totalScore": 8,
      "profitability": { "positiveNetIncome": 1, "positiveOperatingCashFlow": 1 },
      "leverage": { "decreasingLongTermDebt": 1 },
      "efficiency": { "improvingGrossMargin": 1 }
    },
    "altmanZScore": {
      "totalScore": 3.25,
      "interpretation": "SAFE"
    },
    "beneishMScore": {
      "totalScore": -2.5,
      "interpretation": "LOW_RISK"
    },
    "overallRating": "EXCELLENT",
    "riskLevel": "LOW"
  },
  "fromCache": false
}
```

### **POST** `/api/v1/financial-analysis/analyze/manual`
Análisis de datos manuales para empresas que no cotizan

### **POST** `/api/v1/financial-analysis/upload-report`
Upload de archivos Excel/CSV con estados financieros

### **GET** `/api/v1/financial-analysis/history/:ticker`
Histórico de análisis para comparar evolución de scores

## 🔧 Características Técnicas

### **Sistema de Caché Redis**
- TTL configurable (24h por defecto)
- Invalidación inteligente
- Optimización de costos de API

### **Rate Limiting**
- 3 requests/segundo
- 20 requests/10 segundos  
- 100 requests/minuto

### **Integración con APIs Externas**
- Financial Modeling Prep API
- Manejo robusto de errores
- Retry automático con backoff

### **Seguridad**
- Autenticación JWT obligatoria
- Validación exhaustiva de datos
- Helmet.js para headers de seguridad
- CORS restrictivo

## 🛠️ Configuración

### Variables de Entorno
```bash
# API Externa
FMP_API_KEY=your_financial_modeling_prep_api_key

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Base de Datos
DATABASE_URL=postgresql://user:password@host:port/database
```

### Instalación de Dependencias
```bash
npm install redis @nestjs/cache-manager cache-manager-redis-store @nestjs/throttler axios helmet
```

## 📊 Uso de la API

### 1. Análisis Básico
```bash
curl -X GET "http://localhost:3000/api/v1/financial-analysis/analyze/AAPL" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Análisis Manual
```bash
curl -X POST "http://localhost:3000/api/v1/financial-analysis/analyze/manual" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentData": {
      "revenue": 1000000,
      "netIncome": 100000,
      "totalAssets": 2000000,
      "totalLiabilities": 800000,
      "operatingCashFlow": 150000,
      "currentAssets": 500000,
      "currentLiabilities": 300000
    },
    "companyName": "Mi Empresa S.A.",
    "isManufacturing": true
  }'
```

### 3. Histórico
```bash
curl -X GET "http://localhost:3000/api/v1/financial-analysis/history/AAPL?periods=4" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔍 Monitoreo y Logs

- Logs estructurados con Winston
- Métricas de performance
- Alertas de rate limiting
- Monitoreo de APIs externas

## 🧪 Testing

```bash
# Tests unitarios
npm run test

# Tests de integración
npm run test:e2e

# Coverage
npm run test:cov
```

## 📈 Roadmap

- [ ] Integración con más proveedores de datos (Alpha Vantage, Yahoo Finance)
- [ ] Análisis de sectores y comparaciones
- [ ] Alertas automáticas por cambios en scores
- [ ] Dashboard web para visualización
- [ ] API de webhooks para notificaciones
- [ ] Análisis de sentimiento de noticias
- [ ] Machine Learning para predicciones

## 🤝 Contribución

1. Fork del repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

---

**🚀 ¡Listo para analizar el valor fundamental de cualquier empresa!**
