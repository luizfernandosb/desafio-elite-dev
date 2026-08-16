import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, useToast } from '../../../components'
import { cancelTicket, ticketKeys, type TicketDetail } from '../api'
import { cancelErrorMessage } from '../error-messages'
import styles from './CancelTicketButton.module.css'

interface CancelTicketButtonProps {
  ticket: TicketDetail
}

// Confirmação simples de um clique -- mesmo padrão de RevokeShareDialog
// (ShareButton.tsx), não a confirmação por digitação do nome que o cancelamento de
// EVENTO usa no painel do organizador. Lá é uma ação sobre terceiros (todos os
// compradores da sessão); aqui é o próprio cliente cancelando o próprio ingresso.
export function CancelTicketButton({ ticket }: CancelTicketButtonProps) {
  const [open, setOpen] = useState(false)
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => cancelTicket(ticket.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(ticketKeys.detail(ticket.id), updated)
      // só a LISTA, nunca `ticketKeys.all` -- esse prefixo casaria com a própria
      // query de detalhe que acabei de atualizar acima e disparia um refetch dela,
      // que corre contra o `setQueryData` (mesma armadilha documentada no padrão de
      // `CancelEventDialog`, organizador)
      void queryClient.invalidateQueries({ queryKey: [...ticketKeys.all, 'list'] })
      showToast('Ingresso cancelado.', 'success')
      setOpen(false)
    },
  })

  return (
    <Dialog
      trigger={<Button variant="danger">Cancelar ingresso</Button>}
      title="Cancelar ingresso?"
      description="O assento volta a ficar disponível para outros clientes e o valor pago por ele é estornado."
      open={open}
      onOpenChange={setOpen}
    >
      {error && (
        <p role="alert" className={styles.error}>
          {cancelErrorMessage(error)}
        </p>
      )}
      <Button variant="danger" loading={isPending} onClick={() => mutate()}>
        Confirmar cancelamento
      </Button>
    </Dialog>
  )
}
