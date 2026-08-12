import { Button, Dialog } from '../../../components'

interface HoldExpiredModalProps {
  open: boolean
  onChooseAgain: () => void
}

// Diálogo controlado, sem gatilho visível de verdade -- abre sozinho quando o
// `HoldTimer` chega a zero (§ etapa 06, "nunca deixar o usuário preencher o checkout
// com um hold morto"). `Dialog` (etapa 02) exige um `trigger`; como este diálogo só
// abre programaticamente, o gatilho é um botão invisível que nunca é clicado de
// verdade -- mais simples que estender a API do componente compartilhado para um
// único consumidor controlado.
export function HoldExpiredModal({ open, onChooseAgain }: HoldExpiredModalProps) {
  return (
    <Dialog
      trigger={<button type="button" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />}
      title="Tempo esgotado"
      description="O tempo para finalizar a reserva acabou e os assentos foram liberados."
      open={open}
      // Esc ou clique fora fecham o Radix Dialog sem passar pelo botão -- tratados
      // igual ao clique em "Escolher de novo": nenhum caminho deixa o hold morto
      // pendurado silenciosamente.
      onOpenChange={(next) => {
        if (!next) onChooseAgain()
      }}
    >
      <Button onClick={onChooseAgain}>Escolher de novo</Button>
    </Dialog>
  )
}
