import { PlaceholderPage } from './PlaceholderPage'

// Módulo próprio (não o PlaceholderPage genérico direto) para que o `lazy()` do
// router tenha algo concreto para separar em chunk -- é aqui que o leitor de QR
// (~200 kB, @zxing/browser) entra na etapa 10, sem pesar quem só navega no catálogo.
export default function PortariaPage() {
  return <PlaceholderPage title="Portaria" etapa="etapa 10" />
}
