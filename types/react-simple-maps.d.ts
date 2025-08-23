declare module 'react-simple-maps' {
  import type { JSX } from 'react';

  // Minimal, no-any typings to satisfy TS without restricting usage
  export function ComposableMap(props: Record<string, unknown>): JSX.Element;
  export function Geographies(props: Record<string, unknown>): JSX.Element;
  export function Geography(props: Record<string, unknown>): JSX.Element;
}
