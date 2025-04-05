# NextForge - React to Next.js Converter

## Overview
**NextForge**  
A migration tool that converts React applications to Next.js frameworks through automated processes and intelligent analysis

## Core Features
### Conversion Engine
- Automated React-to-Next.js code transformation
- File structure generation following Next.js conventions
- Component adaptation for Next.js compatibility

### Routing System
- React Router detection and conversion
- Automatic page creation in `/pages` or `/app` directory

### Project Analysis
- Code structure diagnostics
- Dependency mapping and compatibility checks
- Validation system (Zod integration)

### Output Management
- Browser-based file upload/download interface
- ZIP package generation (JSZip integration)
- Visual project structure preview

## Technical Architecture
### Core Technologies
- React (UI Framework)
- TypeScript (Language)
- Vite (Build Tool)
- Tailwind CSS (Styling)
- shadcn/ui (Component Library)

### Key Processes
1. File ingestion via drag & drop/selection
2. AST-based code analysis
3. Route mapping transformation
4. File structure reorganization
5. Dependency manifest updating
6. ZIP package compilation

## User Workflow
1. **Input**  
   - Upload React project (ZIP/file tree)
2. **Processing**  
   - Automatic code conversion
   - Route transformation
3. **Output**  
   - Preview converted structure
   - Download Next.js project package
   - Receive dependency recommendations

## Development Stack
### Frontend
- React + TypeScript
- Tailwind CSS + shadcn components
- File upload handlers
- Project structure visualizer

### Backend Processing
- Code transformation engine
- Routing system adapter
- Dependency analyzer
- Validation layer (Zod)
- ZIP packaging system (JSZip)

## Conversion Targets
- JSX → Next.js page components
- React Router → Next.js routing
- Webpack/Vite config → Next.js config
- CSS-in-JS → CSS Modules/Tailwind
- State management adaptation
- API route migration

