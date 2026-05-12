# SETU - Sistema de Evaluación de Ternas Universitarias

SETU es una plataforma web diseñada para digitalizar y optimizar el proceso de calificación de defensas de tesis y proyectos de grado. El sistema permite centralizar la información de estudiantes, automatizar el cálculo de notas ponderadas y facilitar la evaluación en tiempo real para los jurados.

## 1. Información General

- **Asignatura:** 862 Tecnologías Emergentes
- **Catedrático:** Ing. Gerson Velasquez
- **Semana:** 2 (Avance 3)
- **Fecha:** 4 de mayo de 2026

## 2. Equipo de Desarrollo

- Allan Reynaldo Andrews Mayorquin - 32241172
- Aldair Alessandro Burgos Villalobos - 61911698
- Fernanda Nicole Dubón - 62311253

## 3. Estado del Proyecto (Avance 3 - Tarea 3.1)

En esta etapa, se ha consolidado la infraestructura base y la conexión con el backend. Se han cumplido los siguientes requisitos técnicos:

### 🛠️ Implementación Técnica

- **Conexión a Firebase:** Integración completa mediante API Keys en Angular. Base de datos Firestore habilitada y operativa.
- **Servicios en Angular:**
  - `EstudiantesService`: Maneja la persistencia de los datos de los candidatos.
  - `EvaluadoresService`: Gestiona el registro de los docentes jurados.
- **Operaciones CRUD:** Implementación completa (Crear, Leer, Actualizar, Eliminar) para las colecciones de Estudiantes y Evaluadores.
- **Versionamiento:** Uso estricto de ramas (`feature/`) y Pull Requests para el flujo de trabajo.

### 🚀 Despliegue

La aplicación se encuentra publicada y funcional en el siguiente enlace:
- **Firebase Hosting:** [INSERTAR-URL-AQUÍ]

## 4. Alcance del Sistema (Visión Final)

El sistema completo integrará los siguientes módulos:

- **Módulo Administrativo:** Configuración de eventos, definición de rúbricas con escala 1-5, y monitor de progreso en tiempo real.
- **Módulo de Evaluación:** Portal optimizado para dispositivos móviles (Mobile-First) donde los jurados califican mediante formularios ágiles.
- **Motor de Ponderación:** Cálculo automático basado en la fórmula:
  $$Nota Final = \frac{\sum_{i=1}^{n} (\frac{S_i}{C \times 5})}{n} \times P_{max}$$

## 5. Requisitos del Sistema

Para ejecutar este proyecto localmente:

1.  Clonar el repositorio.
2.  Ejecutar `npm install` para instalar las dependencias.
3.  Configurar el archivo `src/environments/environment.ts` con las credenciales de Firebase.
4.  Correr el servidor local con `ng serve`.

## 6. Estructura de Datos (Firestore)

- **Estudiantes:** `nombre`, `asesorTecnico`, `asesorTematico`, `urlTesis`, `idTerna`.
- **Evaluadores:** `nombre`, `idTerna`.
- **Ternas:** `nombreTerna`, `fecha`, `ponderacionMax`.
