# ADR 0002: Base Modal con Radix Dialog

## Estado
Aprobado

## Contexto
La UI admin requiere formularios de creacion (simuladores, preguntas, temas, opciones) en modal y reutilizacion de un componente base.

## Decision
Se agrega la dependencia `@radix-ui/react-dialog` para construir un componente reutilizable `BaseModal` en `components/ui/base-modal.tsx`.

## Consecuencias
- Beneficio: comportamiento de modal consistente en todas las pantallas admin.
- Beneficio: accesibilidad base (focus trap, escape, overlay) via Radix.
- Costo: una dependencia adicional en frontend.
