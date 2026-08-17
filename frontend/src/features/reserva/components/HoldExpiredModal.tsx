import { Button, Dialog } from '../../../components'

interface HoldExpiredModalProps {
  open: boolean
  onChooseAgain: () => void
}

export function HoldExpiredModal({ open, onChooseAgain }: HoldExpiredModalProps) {
  return (
    <Dialog
      trigger={<button type="button" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />}
      title="Tempo esgotado"
      description="O tempo para finalizar a reserva acabou e os assentos foram liberados."
      open={open}
      onOpenChange={(next) => {
        if (!next) onChooseAgain()
      }}
    >
      <Button onClick={onChooseAgain}>Escolher de novo</Button>
    </Dialog>
  )
}
