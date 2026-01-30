# Comandos para commit y push

Si aparece el error `index.lock`: cierra Cursor/VS Code u otras ventanas que usen Git, o borra el archivo `.git/index.lock` y vuelve a ejecutar.

## 1. Ir al proyecto
```powershell
cd "c:\Users\Frank Duran\OneDrive - Partequipos S.A.S\Escritorio\TransporteMaquinaria\project"
```

## 2. Añadir los archivos modificados (filtro operation-hours / overtime)
```powershell
git add src/hooks/useOperationHours.ts src/hooks/useOvertimeTracking.ts src/organisms/Sidebar.tsx src/pages/OperationHoursPage.tsx
```

## 3. Commit
```powershell
git commit -m "feat: filtrar operation-hours y overtime por departamento (estándar vs logística)"
```

## 4. Push
```powershell
git push origin main
```

---

**Si quieres incluir todos los cambios pendientes:**
```powershell
git add -A
git commit -m "feat: filtrar operation-hours y overtime por departamento (estándar vs logística)"
git push origin main
```
